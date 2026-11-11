import { z } from "zod";
import {
  AuthorityPaths,
  CanonicalIntentHasher,
  ExecutionIntentSchema,
  type AuthorizationVerifier,
  type AuthorityEffectEvidence,
  type DecisionGate,
  type JsonObject,
  type VerifiedAuthorization,
} from "@decionis/agent-safe-pipeline";
import { digest, id, instant, type TrustedContext } from "@promisory/contracts";
import { ensure, hash } from "@promisory/domain";
import {
  effectObserverIdSchema,
  effectObserverVersion,
  jiraEffectDigest,
  jiraRecoveryObservationSchema,
  type JiraRecoveryObservation,
} from "./effects";

const authorizationSchema = z.strictObject({
  decisionId: id,
  dossierId: id,
  grantId: id,
  intentHash: digest,
  expiresAt: instant,
  leaseExpiresAt: instant.optional(),
});
const decisionSchema = z.strictObject({
  verdict: z.literal("ALLOW"),
  decisionId: id,
  dossierId: id,
  intentHash: digest,
  reasonCodes: z.array(z.string().max(200)).max(50),
  authorization: z.strictObject({
    token: z.string().max(20_000),
    expiresAt: instant,
  }),
  failClosed: z.literal(false),
});
export const claimSnapshotSchema = z.strictObject({
  intent: ExecutionIntentSchema,
  decision: decisionSchema,
  authorization: authorizationSchema,
  // Only this contract is persisted. Native Jira OAuth tokens never enter it.
  material: z.record(
    z.string(),
    z.union([z.string().max(20_000), z.number(), z.boolean(), z.null()]),
  ),
  outcome: z.enum(["COMMITTED", "FAILED", "INDETERMINATE"]).optional(),
  finalization: z.enum(["RECORDED", "PENDING"]).optional(),
});
export type ClaimSnapshot = z.infer<typeof claimSnapshotSchema>;
/** Production implementations must encrypt claim material using a separate server secret. */
export interface ClaimVault {
  get(
    context: TrustedContext,
    operationId: string,
  ): Promise<ClaimSnapshot | undefined>;
  save(
    context: TrustedContext,
    operationId: string,
    snapshot: ClaimSnapshot,
  ): Promise<void>;
  remove(context: TrustedContext, operationId: string): Promise<void>;
}
export function durableVerifier(
  delegate: AuthorizationVerifier,
  vault: ClaimVault,
  context: TrustedContext,
  operationId: string,
): AuthorizationVerifier {
  let snapshot: ClaimSnapshot | undefined;
  return {
    verifyAndConsume: async (captured, decision) => {
      const authorization = await delegate.verifyAndConsume(captured, decision);
      if (!authorization) return null;
      try {
        const material = delegate.claimMaterial?.(authorization);
        ensure(
          material && delegate.adoptClaim && delegate.finalize,
          "RECOVERY_UNSUPPORTED",
          "The verifier must support durable claim recovery.",
        );
        snapshot = claimSnapshotSchema.parse({
          intent: captured.intent,
          decision: {
            verdict: decision.verdict,
            decisionId: decision.decisionId,
            dossierId: decision.dossierId,
            intentHash: decision.intentHash,
            reasonCodes: decision.reasonCodes,
            authorization: decision.authorization,
            failClosed: decision.failClosed,
          },
          authorization: {
            decisionId: authorization.decisionId,
            dossierId: authorization.dossierId,
            grantId: authorization.grantId,
            intentHash: authorization.intentHash,
            expiresAt: authorization.expiresAt,
            ...(authorization.leaseExpiresAt
              ? { leaseExpiresAt: authorization.leaseExpiresAt }
              : {}),
          },
          material,
        });
        await vault.save(context, operationId, snapshot);
        return authorization;
      } catch {
        // The claim already exists, but dispatch has not begun. Ask the
        // authority to close it; never continue when durable capture failed.
        await delegate
          .finalize?.({ captured, decision, authorization, outcome: "FAILED" })
          .catch(() => undefined);
        return null;
      }
    },
    finalize: async (input) => {
      try {
        ensure(
          snapshot,
          "CLAIM_MISSING",
          "The claim was not durably captured.",
        );
        snapshot.outcome = input.outcome;
        await vault.save(context, operationId, snapshot);
        const result = (await delegate.finalize?.(input)) ?? "PENDING";
        snapshot.finalization = result;
        await vault.save(context, operationId, snapshot);
        if (result === "RECORDED" && input.outcome !== "INDETERMINATE")
          await vault.remove(context, operationId);
        return result;
      } catch {
        return "PENDING";
      }
    },
  };
}
/** Finalization/reconciliation only. This function has no downstream write capability. */
export async function recoverClaim(
  delegate: AuthorizationVerifier,
  vault: ClaimVault,
  context: TrustedContext,
  operationId: string,
  confirmedEffect: boolean,
  reportReconciliation?: (
    snapshot: ClaimSnapshot,
  ) => Promise<"RECORDED" | "PENDING">,
): Promise<"RECORDED" | "PENDING" | undefined> {
  const raw = await vault.get(context, operationId);
  if (!raw) return undefined;
  const snapshot = claimSnapshotSchema.parse(raw),
    captured = new CanonicalIntentHasher().capture(snapshot.intent);
  ensure(
    snapshot.authorization.intentHash === captured.intentHash &&
      snapshot.decision.intentHash === captured.intentHash &&
      captured.intent.actor.id === context.principalAccountId &&
      captured.intent.context.installation_id === context.installationId &&
      captured.intent.parameters.operationId === operationId,
    "CLAIM_MISMATCH",
    "The stored claim belongs to another operation.",
  );
  const authorization: VerifiedAuthorization = snapshot.authorization,
    decision: DecisionGate = snapshot.decision;
  ensure(
    delegate.adoptClaim?.(authorization, snapshot.material as JsonObject),
    "CLAIM_UNAVAILABLE",
    "The configured verifier cannot adopt this claim.",
  );
  // A process may have died before recording an outcome. Treat that as
  // indeterminate, even if the current field equals its original value.
  const outcome = snapshot.outcome ?? "INDETERMINATE";
  const receiptFinalization =
    snapshot.finalization === "RECORDED"
      ? ("RECORDED" as const)
      : ((await delegate.finalize?.({
          captured,
          decision,
          authorization,
          outcome,
        })) ?? "PENDING");
  // Receipt acceptance and reconciliation are separate facts. In particular,
  // an unavailable reconciliation must not erase a recorded uncertain receipt.
  await vault.save(context, operationId, {
    ...snapshot,
    outcome,
    finalization: receiptFinalization,
  });
  let result = receiptFinalization;
  if (outcome === "INDETERMINATE" && confirmedEffect)
    // A prior response may have been lost. The reconciliation resource itself
    // verifies that this exact claimed grant is already INDETERMINATE; a replay
    // refusal from the receipt endpoint is never treated as acceptance.
    result = reportReconciliation
      ? await reportReconciliation(snapshot)
      : ((await delegate.reconcile?.({
          captured,
          authorization,
          outcome: "COMMITTED",
        })) ?? "PENDING");
  if (result === "RECORDED" && (outcome !== "INDETERMINATE" || confirmedEffect))
    await vault.remove(context, operationId);
  return result;
}

export const reconciliationReportSchema = z.strictObject({
  finalization: z.enum(["RECORDED", "PENDING"]),
  reason: z.enum([
    "RECORDED",
    "EFFECT_BINDING_MISSING",
    "EFFECT_BINDING_MISMATCH",
    "CLAIM_BINDING_MISMATCH",
    "OBSERVATION_INVALID",
    "AUTHORITY_REFUSED",
    "AUTHORITY_UNAVAILABLE",
    "RESPONSE_INVALID",
  ]),
  httpStatus: z.number().int().min(100).max(599).optional(),
  reconciliationId: z.uuid().optional(),
  evidenceHash: digest.optional(),
  decisionChainEvidenceRecorded: z.boolean().optional(),
});
export type ReconciliationReport = z.infer<typeof reconciliationReportSchema>;
const materialSchema = z.object({
  kind: z.literal("decionis"),
  execution_token: z.string().min(1).max(20_000),
  claim_token: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  commit_correlation_id: id,
  expected_effect_digest: digest.optional(),
});
const reconciliationResponseSchema = z.object({
  reconciled: z.literal(true),
  resolution: z.literal("FINALIZED"),
  reconciliation_id: z.uuid(),
  evidence_hash: digest,
  decision_chain_evidence_recorded: z.boolean(),
  reason_codes: z.array(z.string().max(200)).max(50),
});

/** SDK 0.5.0 does not restore its in-memory reconciliation map on adoptClaim.
 * Use the documented authenticated reconciliation resource for a sealed claim
 * already finalized INDETERMINATE. The authority validates holder and observer. */
export async function reportDurableReconciliation(
  snapshot: ClaimSnapshot,
  baseUrl: string,
  apiKey: () => string,
  observationInput: JiraRecoveryObservation,
  observerId: string,
): Promise<ReconciliationReport> {
  const pending = (
    reason: ReconciliationReport["reason"],
    httpStatus?: number,
  ): ReconciliationReport => ({
    finalization: "PENDING",
    reason,
    ...(httpStatus === undefined ? {} : { httpStatus }),
  });
  const parsed = materialSchema.safeParse(snapshot.material);
  if (
    !parsed.success ||
    AuthorityPaths.grantIdOf(parsed.data.execution_token) !==
      snapshot.authorization.grantId
  )
    return pending("CLAIM_BINDING_MISMATCH");
  const material = parsed.data;
  // The commitment must have existed when the grant was claimed. Neither a
  // current matching value nor an older evidence format can repair its absence.
  if (!snapshot.intent.expectedEffectDigest || !material.expected_effect_digest)
    return pending("EFFECT_BINDING_MISSING");
  const checked = jiraRecoveryObservationSchema.safeParse(observationInput);
  if (!checked.success || !effectObserverIdSchema.safeParse(observerId).success)
    return pending("OBSERVATION_INVALID");
  const observation = checked.data;
  const captured = new CanonicalIntentHasher().capture(snapshot.intent);
  if (
    captured.intentHash !== snapshot.authorization.intentHash ||
    captured.intentHash !== snapshot.decision.intentHash
  )
    return pending("CLAIM_BINDING_MISMATCH");
  const { effect, context, operationId } = observation;
  const parameters = snapshot.intent.parameters;
  const age = Date.now() - Date.parse(observation.observedAt);
  if (
    age < -5000 ||
    age > 60_000 ||
    observation.observedDueDate !== effect.desiredDueDate ||
    effect.cloudId !== context.cloudId ||
    snapshot.intent.action !== "jira.issue.set_due_date" ||
    snapshot.intent.target !== `jira:${context.cloudId}:${effect.issueId}` ||
    snapshot.intent.actor.id !== context.principalAccountId ||
    snapshot.intent.context.installation_id !== context.installationId ||
    snapshot.intent.downstreamTarget.environment !== context.environmentId ||
    parameters.operationId !== operationId ||
    parameters.issueId !== effect.issueId ||
    parameters.cloudId !== context.cloudId ||
    parameters.expectedDueDate !== effect.expectedDueDate ||
    parameters.desiredDueDate !== effect.desiredDueDate ||
    parameters.expectedUpdatedAt !== effect.expectedUpdatedAt
  )
    return pending("OBSERVATION_INVALID");
  const expected = await jiraEffectDigest(context, operationId, effect);
  if (
    snapshot.intent.expectedEffectDigest !== expected ||
    material.expected_effect_digest !== expected
  )
    return pending("EFFECT_BINDING_MISMATCH");
  const effectEvidence: AuthorityEffectEvidence = {
    version: "1.0" as const,
    status: "CONFIRMED" as const,
    observation_method: "STATE_RECONCILIATION" as const,
    observer: { id: observerId, version: effectObserverVersion },
    expected_effect_digest: expected,
    observed_effect_digest: await jiraEffectDigest(context, operationId, {
      ...effect,
      desiredDueDate: observation.observedDueDate,
    }),
    observed_at: observation.observedAt,
    evidence_digest: await hash(observation),
    evidence_reference: null,
    execution_correlation_id: material.commit_correlation_id,
  };
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}${AuthorityPaths.reconciliations(snapshot.authorization.grantId)}`,
      {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          execution_token: material.execution_token,
          claim_token: material.claim_token,
          commit_correlation_id: material.commit_correlation_id,
          outcome: "COMMITTED",
          effect_evidence: effectEvidence,
        }),
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!response.ok) return pending("AUTHORITY_REFUSED", response.status);
    const reader = response.body?.getReader();
    if (!reader) return pending("RESPONSE_INVALID", response.status);
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 16_000) {
        await reader.cancel();
        return pending("RESPONSE_INVALID", response.status);
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return pending("RESPONSE_INVALID", response.status);
    }
    const result = reconciliationResponseSchema.safeParse(body);
    if (!result.success) return pending("RESPONSE_INVALID", response.status);
    return {
      finalization: "RECORDED",
      reason: "RECORDED",
      httpStatus: response.status,
      reconciliationId: result.data.reconciliation_id,
      evidenceHash: result.data.evidence_hash,
      decisionChainEvidenceRecorded:
        result.data.decision_chain_evidence_recorded,
    };
  } catch {
    return pending("AUTHORITY_UNAVAILABLE");
  }
}
