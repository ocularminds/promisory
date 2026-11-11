import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  IntentCapture,
  type AuthorizationVerifier,
} from "@decionis/agent-safe-pipeline";
import { digest, type JiraDueDateEffect } from "@promisory/contracts";
import { hash } from "@promisory/domain";
import {
  claimSnapshotSchema,
  jiraEffectDigest,
  recoverClaim,
  reportDurableReconciliation,
  type ClaimSnapshot,
  type ClaimVault,
  type JiraRecoveryObservation,
} from "@promisory/integrations-decionis";
import { exampleContext } from "@promisory/test-fixtures";

afterEach(() => vi.restoreAllMocks());

// Independent projection of the deployed Decionis effect contract. Unlike the
// SDK LocalAuthority double, the live endpoint requires this evidence.
const effectEvidence = z.strictObject({
  version: z.literal("1.0"),
  status: z.literal("CONFIRMED"),
  observation_method: z.literal("STATE_RECONCILIATION"),
  observer: z.strictObject({
    id: z.literal("synthetic-observer"),
    version: z.string().min(1),
  }),
  expected_effect_digest: digest,
  observed_effect_digest: digest,
  observed_at: z.iso.datetime(),
  evidence_digest: digest,
  evidence_reference: z.null(),
  execution_correlation_id: z.string().min(1),
});
const responseBody = () => ({
  reconciled: true,
  resolution: "FINALIZED",
  reconciliation_id: crypto.randomUUID(),
  evidence_hash: `sha256:${"a".repeat(64)}`,
  decision_chain_evidence_recorded: true,
  reason_codes: [],
});

async function fixture() {
  const context = exampleContext(),
    operationId = "operation-synthetic-recovery";
  const effect: JiraDueDateEffect = {
    kind: "SET_JIRA_DUE_DATE",
    cloudId: context.cloudId,
    issueId: "10001",
    expectedUpdatedAt: "2026-11-11T01:00:00.000Z",
    expectedDueDate: "2026-11-18",
    desiredDueDate: "2026-11-19",
  };
  const expected = await jiraEffectDigest(context, operationId, effect);
  const captured = new IntentCapture().capture(
    {
      action: "jira.issue.set_due_date",
      target: `jira:${context.cloudId}:${effect.issueId}`,
      parameters: {
        policy_id: "synthetic-policy",
        cloudId: context.cloudId,
        issueId: effect.issueId,
        operationId,
        expectedUpdatedAt: effect.expectedUpdatedAt,
        expectedDueDate: effect.expectedDueDate,
        desiredDueDate: effect.desiredDueDate,
      },
    },
    {
      tenantId: crypto.randomUUID(),
      actor: { id: context.principalAccountId, type: "atlassian_user" },
      downstreamTarget: {
        system: "jira",
        operation: "set_due_date",
        environment: context.environmentId,
      },
      context: { installation_id: context.installationId },
      idempotencyKey: "synthetic-recovery-key",
      expectedEffectDigest: expected,
    },
  );
  const grantId = crypto.randomUUID();
  // No signature or authority: this token only addresses the mocked resource.
  const token = `fixture.${Buffer.from(JSON.stringify({ jti: grantId })).toString("base64url")}.fixture`;
  const snapshot = claimSnapshotSchema.parse({
    intent: captured.intent,
    decision: {
      verdict: "ALLOW",
      decisionId: "synthetic-decision",
      dossierId: "synthetic-dossier",
      intentHash: captured.intentHash,
      reasonCodes: [],
      failClosed: false,
      authorization: { token, expiresAt: captured.intent.expiresAt },
    },
    authorization: {
      decisionId: "synthetic-decision",
      dossierId: "synthetic-dossier",
      grantId,
      intentHash: captured.intentHash,
      expiresAt: captured.intent.expiresAt,
    },
    material: {
      kind: "decionis",
      execution_token: token,
      claim_token: "s".repeat(43),
      commit_correlation_id: captured.intent.intentId,
      expected_effect_digest: expected,
    },
    outcome: "INDETERMINATE",
    finalization: "RECORDED",
  });
  const observation: JiraRecoveryObservation = {
    schemaVersion: "promisory.jira-recovery-observation.v1",
    context,
    operationId,
    effect,
    observedDueDate: effect.desiredDueDate,
    sourceUpdatedAt: "2026-11-11T01:02:00.000Z",
    observedAt: new Date().toISOString(),
    receipt: "OPERATION_HISTORY",
  };
  let stored: ClaimSnapshot | undefined = structuredClone(snapshot);
  const vault: ClaimVault = {
    get: vi.fn(async () => structuredClone(stored)),
    save: vi.fn(async (_context, _operationId, value) => {
      stored = structuredClone(value);
    }),
    remove: vi.fn(async () => {
      stored = undefined;
    }),
  };
  const finalize = vi
    .fn<NonNullable<AuthorizationVerifier["finalize"]>>()
    .mockResolvedValue("RECORDED");
  const delegate: AuthorizationVerifier = {
    verifyAndConsume: vi.fn(async () => null),
    adoptClaim: vi.fn(() => true),
    finalize,
  };
  return {
    context,
    operationId,
    effect,
    expected,
    snapshot,
    observation,
    vault,
    delegate,
    finalize,
    stored: () => stored,
    report: (value = snapshot, observed = observation) =>
      reportDurableReconciliation(
        value,
        "https://authority.invalid",
        () => "synthetic-api-key",
        observed,
        "synthetic-observer",
      ),
  };
}

describe("durable recovery against the required authority contract", () => {
  it("binds the installation, acting account, issue, operation, and before/after dates before dispatch", async () => {
    const f = await fixture();
    const variants = await Promise.all([
      jiraEffectDigest(
        { ...f.context, installationId: "other-installation" },
        f.operationId,
        f.effect,
      ),
      jiraEffectDigest(
        { ...f.context, principalAccountId: "other-person" },
        f.operationId,
        f.effect,
      ),
      jiraEffectDigest(f.context, "other-operation", f.effect),
      jiraEffectDigest(f.context, f.operationId, {
        ...f.effect,
        issueId: "10002",
      }),
      jiraEffectDigest(f.context, f.operationId, {
        ...f.effect,
        expectedDueDate: null,
      }),
      jiraEffectDigest(f.context, f.operationId, {
        ...f.effect,
        desiredDueDate: "2026-11-20",
      }),
    ]);
    expect(new Set([f.expected, ...variants]).size).toBe(7);
  });

  it("sends confirmed native evidence for the original claim and validates a positive durable receipt", async () => {
    const f = await fixture(),
      reply = responseBody();
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        expect(url).toBe(
          `https://authority.invalid/v1/authority/grants/${f.snapshot.authorization.grantId}/reconciliations`,
        );
        expect(init?.method).toBe("POST");
        expect(init?.redirect).toBe("error");
        const body = z
          .strictObject({
            execution_token: z.literal(
              f.snapshot.material.execution_token as string,
            ),
            claim_token: z.literal(f.snapshot.material.claim_token as string),
            commit_correlation_id: z.literal(
              f.snapshot.material.commit_correlation_id as string,
            ),
            outcome: z.literal("COMMITTED"),
            effect_evidence: effectEvidence,
          })
          .parse(JSON.parse(String(init?.body)));
        expect(body.effect_evidence.expected_effect_digest).toBe(f.expected);
        expect(body.effect_evidence.observed_effect_digest).toBe(f.expected);
        expect(body.effect_evidence.evidence_digest).toBe(
          await hash(f.observation),
        );
        expect(body.effect_evidence.execution_correlation_id).toBe(
          body.commit_correlation_id,
        );
        return Response.json(reply);
      });
    expect(await f.report()).toMatchObject({
      finalization: "RECORDED",
      reason: "RECORDED",
      reconciliationId: reply.reconciliation_id,
      decisionChainEvidenceRecorded: true,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("never invents a missing pre-dispatch commitment or sends a weaker evidence format", async () => {
    const f = await fixture();
    const request = vi.spyOn(globalThis, "fetch");
    const legacy = structuredClone(f.snapshot);
    delete legacy.intent.expectedEffectDigest;
    delete legacy.material.expected_effect_digest;
    const before = JSON.stringify(legacy);
    expect(await f.report(legacy)).toMatchObject({
      finalization: "PENDING",
      reason: "EFFECT_BINDING_MISSING",
    });
    expect(JSON.stringify(legacy)).toBe(before);
    expect(request).not.toHaveBeenCalled();
  });

  it("refuses misbound claims, stale observations, unrelated values, and graph-shaped extra data before egress", async () => {
    const f = await fixture();
    const request = vi.spyOn(globalThis, "fetch");
    const wrongGrant = structuredClone(f.snapshot);
    wrongGrant.authorization.grantId = crypto.randomUUID();
    expect((await f.report(wrongGrant)).reason).toBe("CLAIM_BINDING_MISMATCH");
    const wrongDigest = structuredClone(f.snapshot);
    wrongDigest.material.expected_effect_digest = `sha256:${"b".repeat(64)}`;
    expect((await f.report(wrongDigest)).reason).toBe(
      "EFFECT_BINDING_MISMATCH",
    );
    for (const changed of [
      { observedAt: new Date(Date.now() - 120_000).toISOString() },
      { observedDueDate: "2026-11-20" },
      { operationId: "other-operation" },
      { context: { ...f.context, principalAccountId: "other-person" } },
      { graphContext: { title: "Synthetic forbidden graph data" } },
      { receipt: undefined },
    ])
      expect(
        (
          await f.report(f.snapshot, {
            ...f.observation,
            ...changed,
          } as JiraRecoveryObservation)
        ).reason,
      ).toBe("OBSERVATION_INVALID");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not accept a success-shaped Boolean, failed resolution, refusal, or oversized response as finalization", async () => {
    const f = await fixture();
    const request = vi.spyOn(globalThis, "fetch");
    for (const response of [
      Response.json({ reconciled: true }),
      Response.json({ ...responseBody(), resolution: "FAILED" }),
      Response.json({ ...responseBody(), reconciled: false }),
      Response.json(responseBody(), { status: 409 }),
      new Response("x".repeat(16_001)),
    ]) {
      request.mockResolvedValueOnce(response);
      expect((await f.report()).finalization).toBe("PENDING");
    }
    request.mockRejectedValueOnce(new Error("Synthetic transport loss"));
    expect((await f.report()).reason).toBe("AUTHORITY_UNAVAILABLE");
  });

  it("distinguishes an accepted durable outbox record from completed Decision Chain delivery", async () => {
    const f = await fixture();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          ...responseBody(),
          decision_chain_evidence_recorded: false,
          reason_codes: ["COMMIT_EVIDENCE_PENDING"],
        },
        { status: 202 },
      ),
    );
    expect(await f.report()).toMatchObject({
      finalization: "RECORDED",
      decisionChainEvidenceRecorded: false,
    });
  });

  it("retains an accepted uncertain receipt through a failed reconciliation and a process restart", async () => {
    const f = await fixture();
    const report = vi
      .fn<(snapshot: ClaimSnapshot) => Promise<"RECORDED" | "PENDING">>()
      .mockResolvedValueOnce("PENDING")
      .mockResolvedValueOnce("RECORDED");
    expect(
      await recoverClaim(
        f.delegate,
        f.vault,
        f.context,
        f.operationId,
        true,
        report,
      ),
    ).toBe("PENDING");
    expect(f.stored()).toMatchObject({
      outcome: "INDETERMINATE",
      finalization: "RECORDED",
    });
    const restarted = { ...f.delegate, adoptClaim: vi.fn(() => true) };
    expect(
      await recoverClaim(
        restarted,
        f.vault,
        f.context,
        f.operationId,
        true,
        report,
      ),
    ).toBe("RECORDED");
    expect(f.stored()).toBeUndefined();
    expect(f.finalize).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(2);
    expect(f.delegate.verifyAndConsume).not.toHaveBeenCalled();
  });

  it("requires positive reconciliation when an earlier receipt acknowledgement was lost", async () => {
    const f = await fixture();
    await f.vault.save(f.context, f.operationId, {
      ...f.snapshot,
      finalization: "PENDING",
    });
    f.finalize.mockResolvedValue("PENDING");
    const report = vi
      .fn<(snapshot: ClaimSnapshot) => Promise<"RECORDED" | "PENDING">>()
      .mockResolvedValueOnce("PENDING")
      .mockResolvedValueOnce("RECORDED");
    expect(
      await recoverClaim(
        f.delegate,
        f.vault,
        f.context,
        f.operationId,
        true,
        report,
      ),
    ).toBe("PENDING");
    expect(f.stored()).toBeDefined();
    expect(
      await recoverClaim(
        f.delegate,
        f.vault,
        f.context,
        f.operationId,
        true,
        report,
      ),
    ).toBe("RECORDED");
    expect(f.stored()).toBeUndefined();
    expect(f.delegate.verifyAndConsume).not.toHaveBeenCalled();
  });

  it("keeps the claim while no exact native receipt confirms the observed value", async () => {
    const f = await fixture(),
      report = vi.fn();
    expect(
      await recoverClaim(
        f.delegate,
        f.vault,
        f.context,
        f.operationId,
        false,
        report,
      ),
    ).toBe("RECORDED");
    expect(f.stored()).toBeDefined();
    expect(report).not.toHaveBeenCalled();
    expect(f.finalize).not.toHaveBeenCalled();
  });
});
