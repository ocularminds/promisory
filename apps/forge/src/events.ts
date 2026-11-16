import { getAppContext, privacy } from "@forge/api";
import {
  CHANGE_FEED_ID,
  changeFeedSchema,
  changeSignalSchema,
  configSchema,
  commitmentRecordSchema,
  type TrustedContext,
} from "@promisory/contracts";
import {
  anonymizeClosedAccounts,
  appendChange,
  collectAccounts,
  DomainError,
  purgeExpired,
  Repository,
  hash,
} from "@promisory/domain";
import { parseSourceEvent } from "@promisory/integrations-atlassian";
import { ForgeSqlStore, migrate } from "./storage";

export const installed = async () => ({ migrations: await migrate() });
/**
 * Record a metadata-only change signal. Events never make source bodies,
 * field values, author identities, or issue counts available to a viewer:
 * each reader's notices are joined against their own current access.
 */
export async function sourceChanged(event: unknown) {
  const runtime = getAppContext(),
    cloudId = runtime.installation?.contexts.find((c) => c.cloudId)?.cloudId;
  if (!cloudId) return { queued: false, reason: "NO_INSTALLATION_CONTEXT" };
  const ctx: TrustedContext = {
    appId: runtime.appAri.toString(),
    environmentId: runtime.environmentAri.toString(),
    installationId: runtime.installationAri.toString(),
    cloudId,
    principalAccountId: "system-event",
  };
  const repo = new Repository(new ForgeSqlStore(), ctx),
    config = await repo.get("config", "installation", configSchema);
  if (!config?.value.enabled) return { queued: false, reason: "DISCONNECTED" };
  const now = new Date().toISOString();
  const parsed = parseSourceEvent(event, now);
  if (!parsed) return { queued: false, reason: "UNSUPPORTED_EVENT" };
  const signal = changeSignalSchema.parse({
    ...parsed,
    id: await hash([parsed.source, parsed.sourceId, parsed.kind, now]),
  });
  // Single-aggregate compare-and-set; concurrent deliveries retry on conflict.
  for (let attempt = 0; attempt < 4; attempt++) {
    const stored = await repo.get("event", CHANGE_FEED_ID, changeFeedSchema);
    try {
      await repo.save(
        "event",
        CHANGE_FEED_ID,
        stored?.revision ?? 0,
        appendChange(stored?.value, signal, now),
        changeFeedSchema,
      );
      return { queued: true, source: signal.source, kind: signal.kind };
    } catch (error) {
      if (!(error instanceof DomainError) || error.code !== "CONFLICT")
        throw error;
    }
  }
  return { queued: false, reason: "CONTENDED" };
}
/** An expired local lease becomes explicit uncertainty. No user OAuth token is stored or replayed. */
export async function reconcileSchedule() {
  await migrate();
  const runtime = getAppContext(),
    cloudId = runtime.installation?.contexts.find((c) => c.cloudId)?.cloudId;
  if (!cloudId) return { changed: 0 };
  const ctx: TrustedContext = {
    appId: runtime.appAri.toString(),
    environmentId: runtime.environmentAri.toString(),
    installationId: runtime.installationAri.toString(),
    cloudId,
    principalAccountId: "system-schedule",
  };
  const repo = new Repository(new ForgeSqlStore(), ctx),
    config = await repo.get("config", "installation", configSchema);
  if (!config?.value.enabled) return { changed: 0 };
  let changed = 0;
  for (const stored of await repo.list("commitment", commitmentRecordSchema)) {
    let dirty = false;
    for (const operation of stored.value.operations)
      if (
        operation.stage === "EXECUTING" &&
        operation.leaseUntil &&
        Date.parse(operation.leaseUntil) < Date.now()
      ) {
        operation.stage = "RECONCILING";
        operation.message =
          "The invocation ended without a confirmed result. The original user needs to reconcile it.";
        operation.finalization = "PENDING";
        operation.updatedAt = new Date().toISOString();
        delete operation.leaseUntil;
        dirty = true;
      }
    if (dirty) {
      await repo.save(
        "commitment",
        stored.value.id,
        stored.revision,
        stored.value,
        commitmentRecordSchema,
      );
      changed++;
    }
  }
  // Retention: delete closed or fulfilled records past the configured period.
  const { deleted } = await purgeExpired(repo, new Date().toISOString());
  return { changed, deleted };
}

/**
 * Daily personal-data reporting. Closed Atlassian accounts are replaced by a
 * stable pseudonym in stored records, and their inbox state is deleted.
 */
export async function privacySchedule() {
  await migrate();
  const runtime = getAppContext(),
    cloudId = runtime.installation?.contexts.find((c) => c.cloudId)?.cloudId;
  if (!cloudId) return { reported: 0, closed: 0 };
  const repo = new Repository(new ForgeSqlStore(), {
    appId: runtime.appAri.toString(),
    environmentId: runtime.environmentAri.toString(),
    installationId: runtime.installationAri.toString(),
    cloudId,
    principalAccountId: "system-privacy",
  });
  const accounts = await collectAccounts(repo, new Date().toISOString());
  const closed: string[] = [];
  for (let i = 0; i < accounts.length; i += 90) {
    const updates = await privacy.reportPersonalData(accounts.slice(i, i + 90));
    for (const update of updates ?? [])
      if (update.status === "closed") closed.push(update.accountId);
  }
  const { changed } = await anonymizeClosedAccounts(repo, closed);
  return { reported: accounts.length, closed: closed.length, changed };
}
