import { createHmac, randomUUID } from "node:crypto";
import { getAppContext, invokeRemote } from "@forge/api";
import type { TrustedContext } from "@promisory/contracts";
import {
  canonicalJson,
  ensure,
  UnconfiguredExecutor,
  type ExecutorPort,
} from "@promisory/domain";
import {
  dueDateLineage,
  connectionCheckRequestSchema,
  connectionCheckResultSchema,
  connectionFailureSchema,
  connectionFailureDetails,
  hostedInvocationSchema,
  authenticatedRemotePayload,
  executionResultSchema,
  serializeRemoteIntent,
  type ConnectionFailure,
} from "@promisory/integrations-decionis";

/** Included in the Forge build only when its remote is declared in the manifest. */
export async function configuredExecutor(): Promise<ExecutorPort> {
  if (process.env.PROMISORY_REMOTE_ENABLED !== "true")
    return new UnconfiguredExecutor();
  const signingKey = process.env.PROMISORY_REMOTE_SIGNING_KEY;
  if (!signingKey || signingKey.length < 32) return new UnconfiguredExecutor();
  const policy = {
    independentDueDateIntent:
      process.env.PROMISORY_SHARE_DUE_DATE_INTENT === "true",
    jiraDueDateSnapshot:
      process.env.PROMISORY_SHARE_JIRA_DATE_SNAPSHOT === "true",
  };
  if (!policy.independentDueDateIntent || !policy.jiraDueDateSnapshot)
    return new UnconfiguredExecutor();
  async function invoke(
    path:
      "/v1/actions/apply" | "/v1/actions/reconcile" | "/v1/connection/check",
    body: unknown,
    context: TrustedContext,
    observeStatus?: (status: number, ok: boolean) => void,
  ) {
    const runtime = getAppContext();
    ensure(
      runtime.appAri.toString() === context.appId &&
        runtime.environmentAri.toString() === context.environmentId &&
        runtime.installationAri.toString() === context.installationId,
      "INVALID_HOSTED_CONTEXT",
      "The current hosted invocation must match the prepared installation.",
    );
    const origin = hostedInvocationSchema.parse({
      schemaVersion: "promisory.hosted-invocation.v1",
      moduleKey: runtime.moduleKey,
      appVersion: runtime.appVersion,
      invocationId: runtime.invocationId,
    });
    const signature = createHmac("sha256", signingKey!)
      .update(authenticatedRemotePayload("POST", path, origin, body))
      .digest("hex");
    const response = await invokeRemote("promisory-executor", {
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-promisory-signature": signature,
        "x-promisory-origin": JSON.stringify(origin),
      },
      body: JSON.stringify(body),
    });
    observeStatus?.(response.status, response.ok);
    if (!response.ok) throw new Error("REMOTE_INVOCATION_FAILED");
    return { payload: await response.json(), origin };
  }
  return {
    capability: () => ({
      key: "Governed execution",
      state: "UNVERIFIED",
      detail:
        "Remote invocation is configured. Each action must obtain and claim its own Decionis grant; deployment evidence is recorded separately.",
    }),
    checkConnection: async (context) => {
      let stage: ConnectionFailure["stage"] = "PREPARE";
      let httpStatus: number | undefined;
      try {
        const startedAt = Date.now();
        const query = connectionCheckRequestSchema.parse({
          schemaVersion: "promisory.remote-connection.v1",
          context,
          requestId: randomUUID(),
          expiresAt: new Date(startedAt + 60_000).toISOString(),
        });
        stage = "TRANSPORT";
        const reply = await invoke(
          "/v1/connection/check",
          query,
          context,
          (status, ok) => {
            httpStatus = status;
            stage = ok ? "RESPONSE_CONTRACT" : "REMOTE_RESPONSE";
          },
        );
        const result = connectionCheckResultSchema.parse(reply.payload);
        stage = "RESPONSE_BINDING";
        ensure(
          result.requestId === query.requestId &&
            result.moduleKey === reply.origin.moduleKey &&
            result.appVersion === reply.origin.appVersion &&
            canonicalJson(result.context) === canonicalJson(context) &&
            Date.parse(result.checkedAt) >= startedAt - 5_000 &&
            Date.parse(result.checkedAt) <= Date.now() + 5_000,
          "INVALID_CONNECTION_CHECK",
          "The response does not verify this fresh connection check.",
        );
        // Runtime-validated verification metadata only; no OAuth, source
        // content, Graph derivatives, or execution grant enters the log.
        console.info(
          JSON.stringify({
            event: "PROMISORY_REMOTE_CONNECTION_CHECK",
            ...result,
          }),
        );
        return {
          key: "Governed execution",
          state:
            result.mode === "SHADOW"
              ? "ASSESSMENT_ONLY"
              : result.enforcementVerificationHeld || !result.dataSharingEnabled
                ? "UNVERIFIED"
                : "AVAILABLE",
          detail:
            result.mode === "SHADOW"
              ? "The connection is verified for your account. The service is in assessment mode; Jira writes are held."
              : result.enforcementVerificationHeld || !result.dataSharingEnabled
                ? "The connection is verified for your account. Jira writes remain held until the deployment verification is complete."
                : "The connection is verified for your account. Each change still requires independent review and a Decionis execution grant.",
        };
      } catch (error) {
        console.warn(
          JSON.stringify(
            connectionFailureSchema.parse({
              event: "PROMISORY_REMOTE_CONNECTION_CHECK_FAILED",
              schemaVersion: "promisory.remote-connection-diagnostic.v1",
              recordedAt: new Date().toISOString(),
              origin: "FORGE",
              stage,
              ...connectionFailureDetails(
                error,
                httpStatus !== undefined &&
                  (httpStatus < 200 || httpStatus >= 300)
                  ? "REMOTE_INVOCATION_FAILED"
                  : stage === "TRANSPORT"
                    ? "REMOTE_TRANSPORT_FAILED"
                    : "INVALID_REQUEST",
              ),
              ...(httpStatus ? { httpStatus } : {}),
            }),
          ),
        );
        return {
          key: "Governed execution",
          state: "UNAVAILABLE",
          detail:
            "The execution service could not verify your current-user connection. Start a fresh check or contact the app administrator.",
        };
      }
    },
    execute: async ({ context, proposal, operationId, idempotencyKey }) => {
      ensure(
        proposal.effectOrigin === "USER_AUTHORED",
        "RESTRICTED_EGRESS",
        "Graph-derived or agent-proposed intent cannot be exported.",
      );
      const envelope = serializeRemoteIntent(
        {
          schemaVersion: "promisory.remote.v1",
          context,
          operationId,
          proposalId: proposal.id,
          proposalHash: proposal.intentHash,
          idempotencyKey,
          expiresAt: new Date(
            Math.min(Date.now() + 60_000, Date.parse(proposal.expiresAt)),
          ).toISOString(),
          effect: proposal.effect,
        },
        dueDateLineage,
        policy,
      );
      return executionResultSchema.parse(
        (await invoke("/v1/actions/apply", envelope, context)).payload,
      );
    },
    reconcile: async ({ context, operationId }) =>
      executionResultSchema.parse(
        (
          await invoke(
            "/v1/actions/reconcile",
            { context, operationId },
            context,
          )
        ).payload,
      ),
  };
}
