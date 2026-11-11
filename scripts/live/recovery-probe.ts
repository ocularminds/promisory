/**
 * Operator-only acceptance probe. It is not imported by either application.
 * A separately reviewed ConfigMap can preload its compiled form in the owned
 * test executor. It cannot authorize a request or construct a Jira mutation.
 */
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const recoveryScope = Object.freeze({
  policyId: "436f37a4-311f-4dd5-aa07-5a197ed277ed",
  originalPolicyId: "457e04a4-0a1d-4f18-8bca-7a9a5df2adc8",
  appId: "ari:cloud:ecosystem::app/6e0430ce-9c00-425a-80c2-97b5cec1e8ae",
  environmentId:
    "ari:cloud:ecosystem::environment/6e0430ce-9c00-425a-80c2-97b5cec1e8ae/24550cf8-ab9d-4e6a-b46e-96df09cf2866",
  installationId:
    "ari:cloud:ecosystem::installation/283d450f-c6c4-43aa-85fc-aa9d05a085f8",
  cloudId: "e207942a-9edf-4952-b945-2ed6ed3707a7",
  organizationId: "124e5022-6eee-4717-ab65-a03899db6237",
  principalAccountId: "712020:2921f941-93f4-4ccb-9c03-2555a8bfe3d9",
  issueId: "10001",
  expectedDueDate: "2026-11-18",
  desiredDueDate: "2026-11-19",
  expiresAt: "2026-11-12T00:00:00.000Z",
  stateDirectory: "/var/lib/promisory",
});

const operationId = z
  .string()
  .regex(
    /^operation-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
export const recoveryMarkerSchema = z.strictObject({
  schemaVersion: z.literal("promisory.recovery-probe.v1"),
  policyId: z.literal(recoveryScope.policyId),
  operationId,
  phase: z.enum([
    "RESERVED",
    "ACKNOWLEDGEMENT_SUPPRESSED",
    "NON_SUCCESS_RESPONSE",
    "TRANSPORT_UNCERTAIN",
  ]),
  reservedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  httpStatus: z.number().int().min(100).max(599).optional(),
});
type Marker = z.infer<typeof recoveryMarkerSchema>;
export const recoveryMarkerName = `recovery-${recoveryScope.policyId}.json`;

export function assertRecoveryEnvironment(
  environment: Record<string, string | undefined>,
  now = Date.now(),
) {
  const expected = {
    PROMISORY_RECOVERY_PROBE: "true",
    PROMISORY_APP_ID: recoveryScope.appId,
    PROMISORY_ENVIRONMENT_ID: recoveryScope.environmentId,
    PROMISORY_INSTALLATION_ID: recoveryScope.installationId,
    PROMISORY_CLOUD_ID: recoveryScope.cloudId,
    PROMISORY_ORGANIZATION_ID: recoveryScope.organizationId,
    PROMISORY_AUTHORITY_POLICY_ID: recoveryScope.policyId,
    PROMISORY_AUTHORITY_URL: "https://api.decionis.com",
    PROMISORY_STATE_DIRECTORY: recoveryScope.stateDirectory,
    PROMISORY_MODE: "ENFORCEMENT",
    PROMISORY_ENFORCEMENT_VERIFIED: "true",
    PROMISORY_SHARE_DUE_DATE_INTENT: "true",
    PROMISORY_SHARE_JIRA_DATE_SNAPSHOT: "true",
  };
  if (
    Object.entries(expected).some(
      ([key, value]) => environment[key] !== value,
    ) ||
    !Number.isFinite(now) ||
    now >= Date.parse(recoveryScope.expiresAt)
  )
    throw new Error("RECOVERY_PROBE_CONTEXT_REFUSED");
}

const requestBodySchema = z.strictObject({
  fields: z.strictObject({ duedate: z.literal(recoveryScope.desiredDueDate) }),
  historyMetadata: z.strictObject({
    type: z.literal("promisory"),
    extraData: z.strictObject({ promisoryOperationId: operationId }),
  }),
});

export function createRecoveryRequest(
  original: typeof fetch,
  stateDirectory: string,
  now: () => number = Date.now,
): typeof fetch {
  const directory = join(stateDirectory, "recovery-tests"),
    markerPath = join(directory, recoveryMarkerName),
    target = `https://api.atlassian.com/ex/jira/${recoveryScope.cloudId}/rest/api/3/issue/${recoveryScope.issueId}`;

  async function update(marker: Marker) {
    const temporary = `${markerPath}.tmp-${randomUUID()}`;
    try {
      await writeFile(
        temporary,
        `${JSON.stringify(recoveryMarkerSchema.parse(marker))}\n`,
        { flag: "wx", mode: 0o600 },
      );
      await rename(temporary, markerPath);
    } finally {
      await rm(temporary, { force: true }).catch(() => {});
    }
  }

  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (
      method !== "PUT" ||
      url.hostname !== "api.atlassian.com" ||
      !url.pathname.startsWith("/ex/jira/")
    )
      return original(input, init);

    const requestedAt = now();
    if (
      !Number.isFinite(requestedAt) ||
      requestedAt >= Date.parse(recoveryScope.expiresAt)
    )
      throw new Error("RECOVERY_PROBE_EXPIRED");

    // The test probe narrows the already-authorized native write. Unexpected
    // Jira PUTs are refused before dispatch, not repurposed into a test write.
    let body: z.infer<typeof requestBodySchema>;
    try {
      if (url.toString() !== target || typeof init?.body !== "string")
        throw new Error();
      body = requestBodySchema.parse(JSON.parse(init.body));
    } catch {
      throw new Error("RECOVERY_PROBE_REQUEST_REFUSED");
    }

    const reservedAt = new Date(requestedAt).toISOString();
    const marker: Marker = {
      schemaVersion: "promisory.recovery-probe.v1",
      policyId: recoveryScope.policyId,
      operationId: body.historyMetadata.extraData.promisoryOperationId,
      phase: "RESERVED",
      reservedAt,
      updatedAt: reservedAt,
    };
    // An exclusive durable marker allows at most one forwarded Jira write
    // for this entire test plan, including concurrent calls and restarts.
    await mkdir(directory, { recursive: true, mode: 0o700 });
    let handle;
    try {
      handle = await open(markerPath, "wx", 0o600);
      await handle.writeFile(
        `${JSON.stringify(recoveryMarkerSchema.parse(marker))}\n`,
      );
      await handle.sync();
    } catch {
      throw new Error("RECOVERY_PROBE_RESERVATION_REFUSED");
    } finally {
      await handle?.close();
    }

    let response: Response;
    try {
      response = await original(input, init);
    } catch {
      await update({
        ...marker,
        phase: "TRANSPORT_UNCERTAIN",
        updatedAt: new Date(now()).toISOString(),
      });
      throw new TypeError("RECOVERY_PROBE_TRANSPORT_UNCERTAIN");
    }
    if (!response.ok) {
      await update({
        ...marker,
        phase: "NON_SUCCESS_RESPONSE",
        httpStatus: response.status,
        updatedAt: new Date(now()).toISOString(),
      });
      return response;
    }
    await update({
      ...marker,
      phase: "ACKNOWLEDGEMENT_SUPPRESSED",
      httpStatus: response.status,
      updatedAt: new Date(now()).toISOString(),
    });
    throw new TypeError("RECOVERY_PROBE_ACKNOWLEDGEMENT_SUPPRESSED");
  };
}

// Explicit opt-in plus exact installation/policy binding is mandatory. The
// exported factory is used only by local synthetic contract tests.
if (process.env.PROMISORY_RECOVERY_PROBE === "true") {
  assertRecoveryEnvironment(process.env);
  globalThis.fetch = createRecoveryRequest(
    globalThis.fetch.bind(globalThis),
    recoveryScope.stateDirectory,
  );
  console.info(
    JSON.stringify({
      event: "PROMISORY_RECOVERY_PROBE_READY",
      schemaVersion: "promisory.recovery-probe.v1",
      policyId: recoveryScope.policyId,
    }),
  );
} else if (
  process.env.PROMISORY_RECOVERY_PROBE !== undefined &&
  process.env.PROMISORY_RECOVERY_PROBE !== "false"
) {
  throw new Error("RECOVERY_PROBE_CONFIGURATION_REFUSED");
}
