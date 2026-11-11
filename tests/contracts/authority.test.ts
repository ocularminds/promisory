import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DecionisGate,
  DecionisGrantVerifier,
} from "@decionis/agent-safe-pipeline";
import {
  LocalAuthority,
  LOCAL_AUTHORITY_API_KEY,
} from "@decionis/agent-safe-pipeline/testing";
import {
  AgentSafeExecutor,
  jiraEffectDigest,
  dueDateLineage,
  serializeRemoteIntent,
  type AuthorityBinding,
  type ClaimSnapshot,
  type ClaimVault,
  type ExecutionJournal,
  type JournalRecord,
  type RemoteEnvelope,
  type RemoteJira,
} from "@promisory/integrations-decionis";
import { exampleContext } from "@promisory/test-fixtures";

class TestJournal implements ExecutionJournal {
  rows = new Map<string, JournalRecord>();
  async get(installation: string, operation: string) {
    return structuredClone(this.rows.get(`${installation}:${operation}`));
  }
  async start(record: JournalRecord) {
    const key = `${record.envelope.context.installationId}:${record.envelope.operationId}`;
    if (this.rows.has(key)) return false;
    this.rows.set(key, structuredClone(record));
    return true;
  }
  async save(record: JournalRecord) {
    this.rows.set(
      `${record.envelope.context.installationId}:${record.envelope.operationId}`,
      structuredClone(record),
    );
  }
}
const policy = { independentDueDateIntent: true, jiraDueDateSnapshot: true };
function envelope(): RemoteEnvelope {
  return {
    schemaVersion: "promisory.remote.v1",
    context: exampleContext(),
    operationId: crypto.randomUUID(),
    proposalId: "proposal-test",
    proposalHash: `sha256:${"a".repeat(64)}`,
    idempotencyKey: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    effect: {
      kind: "SET_JIRA_DUE_DATE",
      cloudId: exampleContext().cloudId,
      issueId: "121",
      expectedUpdatedAt: "2026-11-10T09:00:00.000Z",
      expectedDueDate: "2026-11-20",
      desiredDueDate: "2026-11-23",
    },
  };
}
function testJira(input: RemoteEnvelope) {
  const value = {
    updatedAt: input.effect.expectedUpdatedAt,
    dueDate: input.effect.expectedDueDate,
  };
  const jira: RemoteJira = {
    read: vi.fn(async () => ({ ...value })),
    canEdit: vi.fn(async () => true),
    setDueDate: vi.fn(async () => {
      value.dueDate = input.effect.desiredDueDate;
      return { status: 204 };
    }),
    receipt: vi.fn(async () => false),
  };
  return { jira, value };
}
const servers: LocalAuthority[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map((s) => s.stop()));
});
async function setup(verdict: "ALLOW" | "BLOCK" | "ESCALATE" = "ALLOW") {
  const local = new LocalAuthority({
    policy: () => verdict,
    addressableGrants: true,
  });
  await local.start();
  servers.push(local);
  const options = {
    baseUrl: local.baseUrl,
    apiKey: LOCAL_AUTHORITY_API_KEY,
    allowInsecureLoopback: true,
  };
  const authority = new DecionisGate({ ...options, mode: "ENFORCEMENT" }),
    verifier = new DecionisGrantVerifier(options),
    journal = new TestJournal();
  const binding: AuthorityBinding = {
    organizationId: "f84c1897-ae47-4916-8aa2-f8271e893ec8",
    policyId: "synthetic-promisory-policy",
    authorityUrl: local.baseUrl,
    apiKey: () => LOCAL_AUTHORITY_API_KEY,
    effectObserverId: "synthetic-promisory-observer",
    mode: "ENFORCEMENT",
    independentlyVerifiedEnforcement: true,
    dataPolicy: policy,
  };
  const claims = new Map<string, ClaimSnapshot>();
  const vault: ClaimVault = {
    get: async (_, id) => structuredClone(claims.get(id)),
    save: async (_, id, snapshot) => {
      claims.set(id, structuredClone(snapshot));
    },
    remove: async (_, id) => {
      claims.delete(id);
    },
  };
  return {
    local,
    journal,
    authority,
    verifier,
    binding,
    vault,
    claims,
    executor: new AgentSafeExecutor(
      journal,
      binding,
      { authority, verifier },
      vault,
    ),
  };
}

describe("local SDK authority contract — no live policy or Jira calls", () => {
  it("binds and claims the exact effect, dispatches once, reads back, and finalizes a receipt", async () => {
    const f = await setup(),
      request = envelope(),
      { jira } = testJira(request);
    const result = await f.executor.execute(request, jira);
    expect(result).toMatchObject({
      stage: "SUCCEEDED",
      mode: "ENFORCEMENT",
      observed: "MATCHED_EFFECT",
      finalization: "RECORDED",
    });
    expect(jira.setDueDate).toHaveBeenCalledTimes(1);
    expect(f.local.requests.map((r) => r.path)).toEqual([
      "/v1/authority/grants",
      expect.stringMatching(/^\/v1\/authority\/grants\/[^/]+\/claims$/),
      expect.stringMatching(/^\/v1\/authority\/grants\/[^/]+\/receipts$/),
    ]);
    expect(f.local.requests[0]!.body).toMatchObject({
      expected_effect_digest: await jiraEffectDigest(
        request.context,
        request.operationId,
        request.effect,
      ),
      action: {
        parameters: { policy_id: f.binding.policyId },
      },
    });
    expect([...f.local.grants.values()][0]).toMatchObject({
      claimed: true,
      finalized: "COMMITTED",
      actorId: request.context.principalAccountId,
    });
    expect(await f.executor.execute(request, jira)).toEqual(result);
    expect(jira.setDueDate).toHaveBeenCalledTimes(1);
    const disk = JSON.stringify([...f.journal.rows.values()]);
    for (const grantToken of f.local.grants.keys())
      expect(disk).not.toContain(grantToken);
    expect(disk).not.toContain("claim_token");
    expect(disk).not.toContain("claimAttestation");
  });
  it.each(["BLOCK", "ESCALATE"] as const)(
    "does not dispatch a %s verdict",
    async (verdict) => {
      const f = await setup(verdict),
        request = envelope(),
        { jira } = testJira(request);
      expect((await f.executor.execute(request, jira)).stage).toBe(
        verdict === "BLOCK" ? "BLOCKED" : "HELD",
      );
      expect(jira.setDueDate).not.toHaveBeenCalled();
      expect(f.local.requests).toHaveLength(1);
    },
  );
  it("refuses shadow and unverified enforcement before any evaluation or write", async () => {
    const f = await setup(),
      request = envelope(),
      { jira } = testJira(request);
    const shadow = new AgentSafeExecutor(
      f.journal,
      { ...f.binding, mode: "SHADOW" },
      { authority: f.authority, verifier: f.verifier },
    );
    expect(await shadow.execute(request, jira)).toMatchObject({
      stage: "HELD",
      mode: "SHADOW",
    });
    const unknown = new AgentSafeExecutor(
      f.journal,
      { ...f.binding, independentlyVerifiedEnforcement: false },
      { authority: f.authority, verifier: f.verifier },
    );
    expect(await unknown.execute(request, jira)).toMatchObject({
      stage: "HELD",
      mode: "UNKNOWN",
    });
    expect(f.local.requests).toHaveLength(0);
    expect(jira.setDueDate).not.toHaveBeenCalled();
  });
  it("an action-gate Boolean cannot substitute for a bound grant", async () => {
    const f = await setup(),
      request = envelope(),
      { jira } = testJira(request);
    f.local.scriptOnce("enforce", {
      body: {
        continue_execution: true,
        verdict: "ALLOW",
        dossier_id: "evaluation-only",
      },
    });
    expect((await f.executor.execute(request, jira)).stage).toBe("BLOCKED");
    expect(jira.setDueDate).not.toHaveBeenCalled();
  });
  it("requires a trusted policy selector and rejects caller-supplied policy overrides before evaluation", async () => {
    const f = await setup(),
      request = envelope(),
      { jira } = testJira(request);
    expect(
      () =>
        new AgentSafeExecutor(
          f.journal,
          { ...f.binding, policyId: "" },
          { authority: f.authority, verifier: f.verifier },
          f.vault,
        ),
    ).toThrow();
    await expect(
      f.executor.execute(
        { ...request, policyId: "weaker-policy" } as RemoteEnvelope,
        jira,
      ),
    ).rejects.toThrow();
    await expect(
      f.executor.execute(
        {
          ...request,
          effect: { ...request.effect, policy_id: "weaker-policy" },
        } as RemoteEnvelope,
        jira,
      ),
    ).rejects.toThrow();
    expect(f.local.requests).toHaveLength(0);
    expect(jira.setDueDate).not.toHaveBeenCalled();
  });
  it("rejects an expired invocation and mismatched claim payload digest", async () => {
    const f = await setup(),
      request = envelope(),
      { jira } = testJira(request);
    await expect(
      f.executor.execute(
        { ...request, expiresAt: "2020-01-01T00:00:00Z" },
        jira,
      ),
    ).rejects.toThrow("expired");
    f.local.misbindNextPayloadDigest = true;
    expect((await f.executor.execute(request, jira)).stage).toBe("BLOCKED");
    expect(jira.setDueDate).not.toHaveBeenCalled();
  });
  it("finalizes a pre-dispatch source change as failed without touching Jira", async () => {
    const f = await setup(),
      request = envelope(),
      { jira, value } = testJira(request);
    value.updatedAt = "2026-11-11T00:00:00.000Z";
    expect(await f.executor.execute(request, jira)).toMatchObject({
      stage: "FAILED",
      observed: "NO_EFFECT",
      finalization: "RECORDED",
    });
    expect(jira.setDueDate).not.toHaveBeenCalled();
    expect([...f.local.grants.values()][0]?.finalized).toBe("FAILED");
  });
  it("keeps a lost response indeterminate and never retries; a matching field alone is insufficient", async () => {
    const f = await setup(),
      request = envelope(),
      { jira, value } = testJira(request);
    vi.mocked(jira.setDueDate).mockImplementation(async () => {
      value.dueDate = request.effect.desiredDueDate;
      throw new Error("lost response after dispatch");
    });
    expect(await f.executor.execute(request, jira)).toMatchObject({
      stage: "RECONCILING",
      finalization: "RECORDED",
    });
    expect([...f.local.grants.values()][0]?.finalized).toBe("INDETERMINATE");
    expect(
      await f.executor.reconcile(request.context, request.operationId, jira),
    ).toMatchObject({ stage: "RECONCILING", observed: "MATCHED_EFFECT" });
    vi.mocked(jira.receipt).mockResolvedValue(true);
    // The SDK's permissive double omits production reconciliation fields.
    // Supply the live response envelope; its evidence request is checked by
    // the independent production-contract cases in recovery.test.ts.
    const originalFetch = globalThis.fetch;
    const productionReply = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const response = await originalFetch(url, init);
        if (
          !String(url).startsWith(f.local.baseUrl) ||
          !String(url).endsWith("/reconciliations") ||
          !response.ok
        )
          return response;
        return Response.json({
          ...(await response.json()),
          reconciliation_id: crypto.randomUUID(),
          evidence_hash: `sha256:${"a".repeat(64)}`,
          decision_chain_evidence_recorded: true,
        });
      });
    try {
      expect(
        await f.executor.reconcile(request.context, request.operationId, jira),
      ).toMatchObject({ stage: "SUCCEEDED", finalization: "RECORDED" });
    } finally {
      productionReply.mockRestore();
    }
    expect([...f.local.grants.values()][0]?.finalized).toBe("COMMITTED");
    expect(f.claims.size).toBe(0);
    await f.executor.execute(request, jira);
    expect(jira.setDueDate).toHaveBeenCalledTimes(1);
  });
  it("blocks concurrent attempts and any reused operation with changed scope or effect", async () => {
    const f = await setup(),
      request = envelope(),
      { jira } = testJira(request);
    const results = await Promise.allSettled([
      f.executor.execute(request, jira),
      f.executor.execute(request, jira),
    ]);
    expect(
      results.some(
        (r) => r.status === "fulfilled" && r.value.stage === "SUCCEEDED",
      ),
    ).toBe(true);
    expect(jira.setDueDate).toHaveBeenCalledTimes(1);
    await expect(
      f.executor.execute(
        {
          ...request,
          effect: { ...request.effect, desiredDueDate: "2026-12-01" },
        },
        jira,
      ),
    ).rejects.toThrow("different intent");
    await expect(
      f.executor.reconcile(
        { ...request.context, environmentId: "other-environment" },
        request.operationId,
        jira,
      ),
    ).rejects.toThrow("No matching");
  });
  it("keeps finalization pending on authority transport failure without concealing the observed Jira result", async () => {
    const f = await setup(),
      request = envelope(),
      { jira } = testJira(request);
    f.local.scriptOnce("finalize", {
      status: 503,
      body: { error: "unavailable" },
    });
    expect(await f.executor.execute(request, jira)).toMatchObject({
      stage: "SUCCEEDED",
      finalization: "PENDING",
    });
    expect(jira.setDueDate).toHaveBeenCalledTimes(1);
    const restarted = new AgentSafeExecutor(
      f.journal,
      f.binding,
      {
        authority: f.authority,
        verifier: new DecionisGrantVerifier({
          baseUrl: f.local.baseUrl,
          apiKey: LOCAL_AUTHORITY_API_KEY,
          allowInsecureLoopback: true,
        }),
      },
      f.vault,
    );
    const recovered = await restarted.reconcile(
      request.context,
      request.operationId,
      jira,
    );
    // This double processed the receipt before dropping its acknowledgement.
    // A replay refusal is not a positive confirmation of finalization.
    expect(recovered.finalization).toBe("PENDING");
    expect(f.claims.size).toBe(1);
    expect(jira.setDueDate).toHaveBeenCalledTimes(1);
  });
  it("recovers a sealed claim after restart when the first receipt never reached the authority", async () => {
    const f = await setup(),
      request = envelope(),
      { jira } = testJira(request);
    let failOnce = true;
    const options = {
      baseUrl: f.local.baseUrl,
      apiKey: LOCAL_AUTHORITY_API_KEY,
      allowInsecureLoopback: true,
    };
    const interrupted = new DecionisGrantVerifier({
      ...options,
      fetch: async (input, init) => {
        if (String(input).endsWith("/receipts") && failOnce) {
          failOnce = false;
          throw new Error("connection refused before delivery");
        }
        return fetch(input, init);
      },
    });
    const first = new AgentSafeExecutor(
      f.journal,
      f.binding,
      { authority: f.authority, verifier: interrupted },
      f.vault,
    );
    expect(await first.execute(request, jira)).toMatchObject({
      stage: "SUCCEEDED",
      finalization: "PENDING",
    });
    const restarted = new AgentSafeExecutor(
      f.journal,
      f.binding,
      { authority: f.authority, verifier: new DecionisGrantVerifier(options) },
      f.vault,
    );
    expect(
      await restarted.reconcile(request.context, request.operationId, jira),
    ).toMatchObject({ stage: "SUCCEEDED", finalization: "RECORDED" });
    expect(f.claims.size).toBe(0);
    expect(jira.setDueDate).toHaveBeenCalledTimes(1);
  });
});

describe("external data contract", () => {
  it("accepts only the enumerated, separately approved due-date intent and REST snapshot", () => {
    const request = envelope();
    expect(serializeRemoteIntent(request, dueDateLineage, policy)).toEqual(
      request,
    );
    expect(() =>
      serializeRemoteIntent(
        { ...request, graphContext: { title: "Restricted team context" } },
        dueDateLineage,
        policy,
      ),
    ).toThrow();
    expect(() =>
      serializeRemoteIntent(
        request,
        { ...dueDateLineage, "effect.desiredDueDate": "ATLASSIAN_ONLY" },
        policy,
      ),
    ).toThrow("restricted provenance");
    expect(() =>
      serializeRemoteIntent(request, dueDateLineage, {
        ...policy,
        jiraDueDateSnapshot: false,
      }),
    ).toThrow("not enabled");
    expect(() =>
      serializeRemoteIntent(
        {
          ...request,
          effect: { ...request.effect, url: "https://arbitrary.example" },
        },
        dueDateLineage,
        policy,
      ),
    ).toThrow();
  });
});
