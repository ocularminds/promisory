import { z } from "zod";
import {
  commitmentRecordSchema,
  configSchema,
  projectRecordSchema,
  type CommitmentRecord,
} from "@promisory/contracts";
import { hash, type Repository } from "./primitives";

const DAY = 86_400_000;
const OPEN_STAGES = new Set([
  "PREPARED",
  "EVALUATED",
  "AUTHORIZED",
  "EXECUTING",
  "RECONCILING",
]);

/**
 * When a commitment record became eligible for deletion, or undefined while it
 * must be kept. Active commitments, unresolved governed changes and pending
 * finalizations are always kept; signed Decionis records live elsewhere.
 */
export function retentionStart(record: CommitmentRecord): number | undefined {
  if (
    record.operations.some(
      (o) => OPEN_STAGES.has(o.stage) || o.finalization === "PENDING",
    )
  )
    return undefined;
  if (record.closure) return Date.parse(record.closure.closedAt);
  const current = record.versions.at(-1);
  if (!current) {
    // An abandoned candidate: measured from its last recorded activity.
    const last = record.history.at(-1)?.at;
    return last ? Date.parse(last) : undefined;
  }
  const outcome = record.outcomes
    .filter((o) => o.commitmentVersion === current.version)
    .at(-1);
  return outcome?.status === "VERIFIED"
    ? Date.parse(outcome.verifiedAt)
    : undefined;
}
export function isExpired(
  record: CommitmentRecord,
  retentionDays: number,
  now: string,
): boolean {
  const start = retentionStart(record);
  return start !== undefined && Date.parse(now) - start > retentionDays * DAY;
}

/** Field names that hold an Atlassian account ID, excluding system principals and pseudonyms. */
const isAccountField = (key: string, value: string) =>
  (/accountid$/i.test(key) || key === "proposedBy") &&
  /^[A-Za-z0-9:_-]{1,128}$/.test(value) &&
  !value.startsWith("system-") &&
  !value.startsWith("deleted-user-") &&
  !["ROVO", "UI"].includes(value);
/** Every Atlassian account ID held in a stored value, for personal-data reporting. */
export function accountIdsIn(value: unknown): Set<string> {
  const found = new Set<string>();
  const visit = (node: unknown, key?: string) => {
    if (typeof node === "string") {
      if (key && isAccountField(key, node)) found.add(node);
    } else if (Array.isArray(node)) node.forEach((n) => visit(n, key));
    else if (node && typeof node === "object")
      for (const [k, v] of Object.entries(node)) visit(v, k);
  };
  visit(value);
  return found;
}

/**
 * Replace a closed account's ID in every account-ID field with a stable
 * pseudonym. Structure, timestamps, decisions and outcomes are retained, so
 * history stays explainable without identifying the person.
 */
export function anonymizeAccount<T>(
  value: T,
  accountId: string,
  pseudonym: string,
): T {
  const replace = (node: unknown, key?: string): unknown => {
    if (typeof node === "string")
      return key && isAccountField(key, node) && node === accountId
        ? pseudonym
        : node;
    if (Array.isArray(node)) return node.map((n) => replace(n, key));
    if (node && typeof node === "object")
      return Object.fromEntries(
        Object.entries(node).map(([k, v]) => [k, replace(v, k)]),
      );
    return node;
  };
  return replace(value) as T;
}

export const pseudonymFor = async (accountId: string) =>
  `deleted-user-${(await hash(["promisory.pseudonym.v1", accountId])).slice(7, 23)}`;

/** Delete closed or fulfilled commitment records older than the retention period. */
export async function purgeExpired(repo: Repository, now: string) {
  const config = await repo.get("config", "installation", configSchema);
  if (!config) return { deleted: 0 };
  let deleted = 0;
  for (const stored of await repo.list("commitment", commitmentRecordSchema))
    if (isExpired(stored.value, config.value.retentionDays, now)) {
      try {
        await repo.remove("commitment", stored.value.id, stored.revision);
        deleted++;
      } catch {
        // Changed concurrently: reconsider on the next run.
      }
    }
  return { deleted };
}

/** Account IDs to report through the platform personal-data API. */
export async function collectAccounts(repo: Repository, now: string) {
  const accounts = new Map<string, string>();
  const add = (ids: Set<string>, at: string) => {
    for (const id of ids)
      if (!accounts.has(id) || accounts.get(id)! < at) accounts.set(id, at);
  };
  for (const c of await repo.list("commitment", commitmentRecordSchema))
    add(accountIdsIn(c.value), c.value.history.at(-1)?.at ?? now);
  for (const p of await repo.list("project", projectRecordSchema))
    add(accountIdsIn(p.value), now);
  const config = await repo.get("config", "installation", configSchema);
  if (config) add(accountIdsIn(config.value), now);
  // Inbox preferences are keyed by the account they belong to.
  for (const inbox of await repo.listKeyed("inbox", z.unknown()))
    if (isAccountField("accountId", inbox.key)) add(new Set([inbox.key]), now);
  return [...accounts.entries()].map(([accountId, updatedAt]) => ({
    accountId,
    updatedAt,
  }));
}

/** Anonymize every closed account across stored records and drop its inbox state. */
export async function anonymizeClosedAccounts(
  repo: Repository,
  closed: string[],
) {
  let changed = 0;
  for (const accountId of closed) {
    const pseudonym = await pseudonymFor(accountId);
    for (const c of await repo.list("commitment", commitmentRecordSchema)) {
      const next = anonymizeAccount(c.value, accountId, pseudonym);
      if (JSON.stringify(next) !== JSON.stringify(c.value)) {
        await repo.save(
          "commitment",
          c.value.id,
          c.revision,
          next,
          commitmentRecordSchema,
        );
        changed++;
      }
    }
    for (const p of await repo.list("project", projectRecordSchema)) {
      const next = anonymizeAccount(p.value, accountId, pseudonym);
      if (JSON.stringify(next) !== JSON.stringify(p.value)) {
        await repo.save(
          "project",
          p.value.id,
          p.revision,
          next,
          projectRecordSchema,
        );
        changed++;
      }
    }
    const config = await repo.get("config", "installation", configSchema);
    if (config) {
      const next = anonymizeAccount(config.value, accountId, pseudonym);
      if (JSON.stringify(next) !== JSON.stringify(config.value)) {
        await repo.save(
          "config",
          "installation",
          config.revision,
          next,
          configSchema,
        );
        changed++;
      }
    }
    const inbox = await repo.get("inbox", accountId, z.unknown());
    if (inbox) {
      await repo.remove("inbox", accountId, inbox.revision);
      changed++;
    }
  }
  return { changed };
}
