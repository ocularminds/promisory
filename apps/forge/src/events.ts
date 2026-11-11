import { getAppContext } from "@forge/api";
import { z } from "zod";
import {
  configSchema,
  commitmentRecordSchema,
  type TrustedContext,
} from "@promisory/contracts";
import { Repository, hash } from "@promisory/domain";
import { ForgeSqlStore, migrate } from "./storage";

export const installed = async () => ({ migrations: await migrate() });
/** Events never make source bodies, author identities, or issue counts available to a viewer. */
export async function sourceChanged(event: unknown) {
  const value = z
    .object({
      issue: z.object({ id: z.string() }).optional(),
      content: z.object({ id: z.string() }).optional(),
    })
    .parse(event);
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
  const id = await hash([
    value.issue ? "JIRA" : "CONFLUENCE",
    value.issue?.id ?? value.content?.id ?? "unknown",
  ]);
  const schema = z.strictObject({
    source: z.enum(["JIRA", "CONFLUENCE"]),
    sourceId: z.string(),
    observedAt: z.string(),
  });
  const old = await repo.get("event", id, schema);
  await repo.save(
    "event",
    id,
    old?.revision ?? 0,
    {
      source: value.issue ? "JIRA" : "CONFLUENCE",
      sourceId: value.issue?.id ?? value.content?.id ?? "unknown",
      observedAt: new Date().toISOString(),
    },
    schema,
  );
  return { queued: true };
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
  return { changed };
}
