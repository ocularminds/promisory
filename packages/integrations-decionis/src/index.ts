import { z } from "zod";
import {
  effectSchema,
  id,
  instant,
  digest,
  trustedContextSchema,
  type JiraDueDateEffect,
  type TrustedContext,
} from "@promisory/contracts";
import { canonicalJson, ensure, type ExecutionResult } from "@promisory/domain";
import { executorModuleKeySchema } from "./hosted-invocation";
import {
  ActionRegistry,
  DecionisGate,
  DecionisGrantVerifier,
  IntentCapture,
  SafeExecutor,
  PreDispatchRefusal,
  ProviderRefusal,
  type DecisionAuthority,
  type AuthorizationVerifier,
  type VerifiedAuthorization,
} from "@decionis/agent-safe-pipeline";
import {
  durableVerifier,
  recoverClaim,
  reportDurableReconciliation,
  reconciliationReportSchema,
  type ClaimVault,
  type ReconciliationReport,
} from "./recovery";
import { effectObserverIdSchema, jiraEffectDigest } from "./effects";
export * from "./recovery";
export * from "./effects";
export * from "./connection-diagnostics";
export * from "./hosted-invocation";

// Only server-derived context and fresh correlation metadata cross this
// diagnostic boundary. It accepts no work content, graph data, or action.
export const connectionCheckRequestSchema = z.strictObject({
  schemaVersion: z.literal("promisory.remote-connection.v1"),
  context: trustedContextSchema,
  requestId: z.uuid(),
  expiresAt: instant,
});
export const connectionCheckResultSchema = z
  .strictObject({
    schemaVersion: z.literal("promisory.remote-connection.v2"),
    context: trustedContextSchema,
    requestId: z.uuid(),
    checkedAt: instant,
    moduleKey: executorModuleKeySchema,
    fitModuleKey: executorModuleKeySchema.nullable(),
    moduleVerification: z.enum(["FIT_AND_HOSTED_CONTEXT", "HOSTED_CONTEXT"]),
    appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    currentUserVerified: z.literal(true),
    readOnly: z.literal(true),
    mode: z.enum(["SHADOW", "ENFORCEMENT"]),
    enforcementVerificationHeld: z.boolean(),
    dataSharingEnabled: z.boolean(),
  })
  .refine(
    (value) =>
      value.moduleVerification === "FIT_AND_HOSTED_CONTEXT"
        ? value.fitModuleKey === value.moduleKey
        : value.fitModuleKey === null,
    "Module evidence must describe its actual source.",
  );
export type ConnectionCheckResult = z.infer<typeof connectionCheckResultSchema>;

export const remoteEnvelopeSchema = z.strictObject({
  schemaVersion: z.literal("promisory.remote.v1"),
  context: trustedContextSchema,
  operationId: id,
  proposalId: id,
  proposalHash: digest,
  idempotencyKey: id,
  expiresAt: instant,
  effect: effectSchema,
});
export type RemoteEnvelope = z.infer<typeof remoteEnvelopeSchema>;
export type RemoteFieldLineage =
  | "TRUSTED_CONTEXT"
  | "INDEPENDENT_INTENT"
  | "PERMITTED_REST_EVIDENCE"
  | "ATLASSIAN_ONLY";
export interface DataSharingPolicy {
  independentDueDateIntent: boolean;
  jiraDueDateSnapshot: boolean;
}
/** Enumerate every external field. Neither extra metadata nor graph derivatives can ride along. */
export function serializeRemoteIntent(
  input: unknown,
  lineage: Record<string, RemoteFieldLineage>,
  policy: DataSharingPolicy,
): RemoteEnvelope {
  const value = remoteEnvelopeSchema.parse(input);
  ensure(
    policy.independentDueDateIntent && policy.jiraDueDateSnapshot,
    "DATA_SHARING_DISABLED",
    "The explicit external action data policy is not enabled.",
  );
  const expected: Record<string, RemoteFieldLineage> = {
    schemaVersion: "TRUSTED_CONTEXT",
    context: "TRUSTED_CONTEXT",
    operationId: "TRUSTED_CONTEXT",
    proposalId: "TRUSTED_CONTEXT",
    proposalHash: "TRUSTED_CONTEXT",
    idempotencyKey: "TRUSTED_CONTEXT",
    expiresAt: "TRUSTED_CONTEXT",
    "effect.kind": "INDEPENDENT_INTENT",
    "effect.cloudId": "TRUSTED_CONTEXT",
    "effect.issueId": "INDEPENDENT_INTENT",
    "effect.desiredDueDate": "INDEPENDENT_INTENT",
    "effect.expectedUpdatedAt": "PERMITTED_REST_EVIDENCE",
    "effect.expectedDueDate": "PERMITTED_REST_EVIDENCE",
  };
  ensure(
    Object.keys(lineage).length === Object.keys(expected).length &&
      Object.entries(expected).every(
        ([field, origin]) => lineage[field] === origin,
      ),
    "RESTRICTED_EGRESS",
    "A field has missing or restricted provenance. Graph context cannot leave Atlassian.",
  );
  return value;
}
export const dueDateLineage: Record<string, RemoteFieldLineage> = {
  schemaVersion: "TRUSTED_CONTEXT",
  context: "TRUSTED_CONTEXT",
  operationId: "TRUSTED_CONTEXT",
  proposalId: "TRUSTED_CONTEXT",
  proposalHash: "TRUSTED_CONTEXT",
  idempotencyKey: "TRUSTED_CONTEXT",
  expiresAt: "TRUSTED_CONTEXT",
  "effect.kind": "INDEPENDENT_INTENT",
  "effect.cloudId": "TRUSTED_CONTEXT",
  "effect.issueId": "INDEPENDENT_INTENT",
  "effect.desiredDueDate": "INDEPENDENT_INTENT",
  "effect.expectedUpdatedAt": "PERMITTED_REST_EVIDENCE",
  "effect.expectedDueDate": "PERMITTED_REST_EVIDENCE",
};
export const executionResultSchema = z.strictObject({
  stage: z.enum(["HELD", "BLOCKED", "SUCCEEDED", "FAILED", "RECONCILING"]),
  mode: z.enum(["UNKNOWN", "SHADOW", "ENFORCEMENT"]),
  message: z.string().min(1).max(4000),
  evaluationReference: id.optional(),
  grantReference: id.optional(),
  externalReceiptReference: id.optional(),
  observed: z
    .enum(["MATCHED_EFFECT", "NO_EFFECT", "CONFLICT", "UNKNOWN"])
    .optional(),
  finalization: z.enum(["NOT_REQUIRED", "RECORDED", "PENDING"]),
});
export interface RemoteJira {
  read(issueId: string): Promise<{ updatedAt: string; dueDate: string | null }>;
  canEdit(issueId: string): Promise<boolean>;
  /** Implementations must use the current invocation's opaque user token and reject redirects. */
  setDueDate(
    effect: JiraDueDateEffect,
    operationId: string,
    timeoutMs: number,
  ): Promise<{ status: number }>;
  receipt(effect: JiraDueDateEffect, operationId: string): Promise<boolean>;
}
export interface JournalRecord {
  envelope: RemoteEnvelope;
  state: "STARTED" | "DISPATCHED" | "SETTLED";
  acknowledged: boolean;
  authorization?: {
    decisionId: string;
    dossierId: string;
    grantId: string;
    intentHash: string;
    expiresAt: string;
  };
  result?: ExecutionResult;
}
export const journalRecordSchema = z.strictObject({
  envelope: remoteEnvelopeSchema,
  state: z.enum(["STARTED", "DISPATCHED", "SETTLED"]),
  acknowledged: z.boolean(),
  authorization: z
    .strictObject({
      decisionId: id,
      dossierId: id,
      grantId: id,
      intentHash: digest,
      expiresAt: instant,
    })
    .optional(),
  result: executionResultSchema.optional(),
});
export interface ExecutionJournal {
  get(
    installationId: string,
    operationId: string,
  ): Promise<JournalRecord | undefined>;
  /** An atomic create-if-absent. Must be durable before evaluating/dispatching. */
  start(record: JournalRecord): Promise<boolean>;
  save(record: JournalRecord): Promise<void>;
}
export const authorityPolicyIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]{0,99}$/);
export interface AuthorityBinding {
  organizationId: string;
  /** Trusted host configuration, captured in the hashed intent; never supplied by the caller. */
  policyId: string;
  mode: "ENFORCEMENT" | "SHADOW";
  authorityUrl: string;
  apiKey: () => string;
  effectObserverId: string;
  independentlyVerifiedEnforcement: boolean;
  dataPolicy: DataSharingPolicy;
}
export class AgentSafeExecutor {
  constructor(
    private journal: ExecutionJournal,
    private binding: AuthorityBinding,
    private providers?: {
      authority: DecisionAuthority;
      verifier: AuthorizationVerifier;
    },
    private vault?: ClaimVault,
    private reportRecovery?: (event: {
      event: "PROMISORY_AUTHORITY_RECOVERY";
      recordedAt: string;
      operationId: string;
      report: ReconciliationReport;
    }) => void,
  ) {
    authorityPolicyIdSchema.parse(binding.policyId);
    effectObserverIdSchema.parse(binding.effectObserverId);
  }
  private verifier() {
    return (
      this.providers?.verifier ??
      new DecionisGrantVerifier({
        baseUrl: this.binding.authorityUrl,
        apiKey: this.binding.apiKey,
        timeoutMs: 4000,
      })
    );
  }
  async execute(
    envelope: RemoteEnvelope,
    jira: RemoteJira,
  ): Promise<ExecutionResult> {
    remoteEnvelopeSchema.parse(envelope);
    const prior = await this.journal.get(
      envelope.context.installationId,
      envelope.operationId,
    );
    if (prior) {
      ensure(
        canonicalJson(prior.envelope) === canonicalJson(envelope),
        "REPLAY_MISMATCH",
        "This operation already belongs to a different intent.",
      );
      return (
        prior.result ?? {
          stage: "RECONCILING",
          mode: this.binding.mode,
          message:
            "An earlier attempt exists. Reconcile its result before another action.",
          observed: "UNKNOWN",
          finalization: "PENDING",
        }
      );
    }
    if (this.binding.mode === "SHADOW")
      return {
        stage: "HELD",
        mode: "SHADOW",
        message:
          "Assessment only. This connection does not enforce, and Promisory did not dispatch the change.",
        finalization: "NOT_REQUIRED",
      };
    if (!this.binding.independentlyVerifiedEnforcement)
      return {
        stage: "HELD",
        mode: "UNKNOWN",
        message:
          "The enforcement deployment has not been verified. No change was dispatched.",
        finalization: "NOT_REQUIRED",
      };
    if (!this.vault)
      return {
        stage: "HELD",
        mode: "UNKNOWN",
        message:
          "A durable encrypted claim vault is required before execution. No change was dispatched.",
        finalization: "NOT_REQUIRED",
      };
    ensure(
      Date.parse(envelope.expiresAt) > Date.now(),
      "EXPIRED",
      "The prepared remote invocation expired.",
    );
    const record: JournalRecord = {
      envelope,
      state: "STARTED",
      acknowledged: false,
    };
    ensure(
      await this.journal.start(record),
      "REPLAY",
      "Another invocation already owns this operation. Reconcile its result.",
    );
    const authority =
      this.providers?.authority ??
      new DecionisGate({
        baseUrl: this.binding.authorityUrl,
        apiKey: this.binding.apiKey,
        mode: "ENFORCEMENT",
        timeoutMs: 4000,
      });
    const verifier = durableVerifier(
      this.verifier(),
      this.vault,
      envelope.context,
      envelope.operationId,
    );
    const capture = new IntentCapture({
      ttlSeconds: Math.min(
        60,
        Math.max(
          1,
          Math.floor((Date.parse(envelope.expiresAt) - Date.now()) / 1000),
        ),
      ),
    });
    const parameters = {
      policy_id: this.binding.policyId,
      issueId: envelope.effect.issueId,
      expectedUpdatedAt: envelope.effect.expectedUpdatedAt,
      expectedDueDate: envelope.effect.expectedDueDate,
      desiredDueDate: envelope.effect.desiredDueDate,
      operationId: envelope.operationId,
      cloudId: envelope.effect.cloudId,
    };
    const captured = capture.capture(
      {
        action: "jira.issue.set_due_date",
        target: `jira:${envelope.effect.cloudId}:${envelope.effect.issueId}`,
        parameters,
      },
      {
        tenantId: this.binding.organizationId,
        actor: {
          id: envelope.context.principalAccountId,
          type: "atlassian_user",
          runtime: "promisory-forge",
        },
        downstreamTarget: {
          system: "jira",
          operation: "set_due_date",
          environment: envelope.context.environmentId,
        },
        context: {
          installation_id: envelope.context.installationId,
          proposal_hash: envelope.proposalHash,
        },
        idempotencyKey: envelope.idempotencyKey,
        expectedEffectDigest: await jiraEffectDigest(
          envelope.context,
          envelope.operationId,
          envelope.effect,
        ),
      },
    );
    const parameterSchema = z.strictObject({
      policy_id: z.literal(this.binding.policyId),
      issueId: id,
      expectedUpdatedAt: instant,
      expectedDueDate: z.string().nullable(),
      desiredDueDate: z.string(),
      operationId: id,
      cloudId: z.uuid(),
    });
    const registry = new ActionRegistry()
      .register("jira.issue.set_due_date", {
        parametersSchema: parameterSchema,
        execute: async ({ parameters: bound, authorization, dispatch }) => {
          const current = await jira.read(bound.issueId);
          if (
            current.updatedAt !== bound.expectedUpdatedAt ||
            current.dueDate !== bound.expectedDueDate
          )
            throw new PreDispatchRefusal("SOURCE_CHANGED");
          if (!(await jira.canEdit(bound.issueId)))
            throw new PreDispatchRefusal("USER_PERMISSION_MISSING");
          // Leave a bounded read-back/finalization window inside the grant lease.
          const budget = Math.min(
            8000,
            Date.parse(authorization.expiresAt) - Date.now() - 8000,
            authorization.leaseExpiresAt
              ? Date.parse(authorization.leaseExpiresAt) - Date.now() - 8000
              : 8000,
          );
          if (budget < 1000)
            throw new PreDispatchRefusal("AUTHORIZATION_EXPIRED");
          record.state = "DISPATCHED";
          record.authorization = this.safeAuthorization(authorization);
          await this.journal.save(record);
          const response = await dispatch.run(() =>
            jira.setDueDate(envelope.effect, envelope.operationId, budget),
          );
          if (response.status >= 400 && response.status < 500)
            throw new ProviderRefusal("JIRA_REFUSED");
          if (response.status < 200 || response.status >= 300)
            throw new Error("JIRA_OUTCOME_UNKNOWN");
          record.acknowledged = true;
          await this.journal.save(record);
          const observed = await jira.read(bound.issueId);
          if (observed.dueDate !== bound.desiredDueDate)
            throw new Error("READBACK_CONFLICT");
          return { matched: true };
        },
      })
      .seal();
    const decision = await authority.evaluate(captured);
    if (
      decision.verdict !== "ALLOW" ||
      decision.failClosed ||
      !decision.authorization
    ) {
      const result: ExecutionResult = {
        stage: decision.verdict === "BLOCK" ? "BLOCKED" : "HELD",
        mode: "ENFORCEMENT",
        message:
          decision.verdict === "BLOCK"
            ? "Decionis did not authorize this request. No change was dispatched."
            : "Decionis requires further authority. No change was dispatched.",
        evaluationReference: decision.decisionId,
        finalization: "NOT_REQUIRED",
      };
      record.state = "SETTLED";
      record.result = result;
      await this.journal.save(record);
      return result;
    }
    const executed = await new SafeExecutor(registry, verifier).run(
      captured,
      decision,
    );
    const result: ExecutionResult = {
      stage:
        executed.outcome === "COMPLETED"
          ? "SUCCEEDED"
          : executed.outcome === "UNKNOWN_AFTER_DISPATCH"
            ? "RECONCILING"
            : executed.outcome === "BLOCKED"
              ? "BLOCKED"
              : "FAILED",
      mode: "ENFORCEMENT",
      message:
        executed.outcome === "COMPLETED"
          ? "Jira accepted the due-date change and its value was read back. The commitment deadline remains unchanged."
          : executed.outcome === "UNKNOWN_AFTER_DISPATCH"
            ? "The dispatched result is uncertain. Reconciliation is required before another attempt."
            : "The change was not completed. The authority claim or source check refused this attempt.",
      evaluationReference: decision.decisionId,
      ...("authorization" in executed && executed.authorization
        ? { grantReference: executed.authorization.grantId }
        : {}),
      observed:
        executed.outcome === "COMPLETED"
          ? "MATCHED_EFFECT"
          : executed.outcome === "UNKNOWN_AFTER_DISPATCH"
            ? "UNKNOWN"
            : "NO_EFFECT",
      finalization:
        "finalization" in executed
          ? executed.finalization === "RECORDED"
            ? "RECORDED"
            : "PENDING"
          : "NOT_REQUIRED",
    };
    record.state = "SETTLED";
    record.result = result;
    await this.journal.save(record);
    return result;
  }
  async reconcile(
    context: TrustedContext,
    operationId: string,
    jira: RemoteJira,
  ): Promise<ExecutionResult> {
    const record = await this.journal.get(context.installationId, operationId);
    ensure(
      record &&
        canonicalJson(record.envelope.context) === canonicalJson(context),
      "NOT_FOUND",
      "No matching executor receipt is available.",
    );
    if (
      record.result &&
      record.result.stage !== "RECONCILING" &&
      record.result.finalization !== "PENDING"
    )
      return record.result;
    ensure(
      record.state === "SETTLED" ||
        Date.parse(record.envelope.expiresAt) + 10_000 <= Date.now(),
      "IN_PROGRESS",
      "Wait for the original invocation window to close before reconciling.",
    );
    const observed = await jira.read(record.envelope.effect.issueId);
    const matched = observed.dueDate === record.envelope.effect.desiredDueDate;
    const receipt =
      record.acknowledged ||
      (await jira.receipt(record.envelope.effect, operationId));
    let finalization = record.result?.finalization ?? "PENDING";
    let recoveryReport: ReconciliationReport | undefined;
    if (this.vault) {
      try {
        finalization =
          (await recoverClaim(
            this.verifier(),
            this.vault,
            context,
            operationId,
            matched && receipt,
            async (snapshot) => {
              recoveryReport = await reportDurableReconciliation(
                snapshot,
                this.binding.authorityUrl,
                this.binding.apiKey,
                {
                  schemaVersion: "promisory.jira-recovery-observation.v1",
                  context,
                  operationId,
                  effect: record.envelope.effect,
                  observedDueDate: observed.dueDate,
                  sourceUpdatedAt: observed.updatedAt,
                  observedAt: new Date().toISOString(),
                  receipt: record.acknowledged
                    ? "ACKNOWLEDGED_WRITE"
                    : "OPERATION_HISTORY",
                },
                this.binding.effectObserverId,
              );
              try {
                this.reportRecovery?.({
                  event: "PROMISORY_AUTHORITY_RECOVERY",
                  recordedAt: new Date().toISOString(),
                  operationId,
                  report: reconciliationReportSchema.parse(recoveryReport),
                });
              } catch {
                // Telemetry must not replace an authority result.
              }
              return recoveryReport.finalization;
            },
          )) ?? finalization;
      } catch {
        finalization = "PENDING";
      }
    }
    // An unchanged field is not proof that a timed-out request never ran or cannot still arrive.
    const previousSuccess = record.result?.stage === "SUCCEEDED";
    const result: ExecutionResult = {
      stage:
        (matched && receipt) || previousSuccess ? "SUCCEEDED" : "RECONCILING",
      mode: this.binding.mode,
      message:
        recoveryReport?.reason === "EFFECT_BINDING_MISSING"
          ? "Jira confirms this change, but its original authorization omitted the effect fingerprint required for authority reconciliation. An administrator must review this record; another result check cannot add that missing commitment."
          : matched && receipt
            ? "The operation receipt and current Jira value confirm the change."
            : previousSuccess
              ? "The original change succeeded; the current Jira value has since changed."
              : matched
                ? "The desired value is present, but no matching operation receipt confirms this attempt."
                : "The operation remains uncertain. A later native edit or in-flight request cannot be ruled out.",
      observed: matched
        ? "MATCHED_EFFECT"
        : previousSuccess
          ? "CONFLICT"
          : "UNKNOWN",
      finalization,
      ...(record.authorization
        ? {
            evaluationReference: record.authorization.decisionId,
            grantReference: record.authorization.grantId,
          }
        : {}),
    };
    record.result = result;
    await this.journal.save(record);
    return result;
  }
  private safeAuthorization(a: VerifiedAuthorization) {
    return {
      decisionId: a.decisionId,
      dossierId: a.dossierId,
      grantId: a.grantId,
      intentHash: a.intentHash,
      expiresAt: a.expiresAt,
    };
  }
}
