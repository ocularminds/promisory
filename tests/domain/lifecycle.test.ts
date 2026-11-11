import { describe, it, expect } from "vitest";
import {
  commitmentRecordSchema,
  projectRecordSchema,
  type CommitmentDraft,
  type CommitmentRecord,
} from "@promisory/contracts";
import {
  activeVersion,
  PromisoryService,
  Repository,
  UnconfiguredExecutor,
  type Stored,
} from "@promisory/domain";
import {
  createExample,
  exampleContext,
  EXAMPLE_CLOCK,
} from "@promisory/test-fixtures";

const revised = (record: CommitmentRecord): CommitmentDraft => {
  const c = activeVersion(record)!;
  return {
    title: c.title,
    outcome: c.outcome,
    beneficiary: c.beneficiary,
    projectIds: c.projectIds,
    accountableOwnerAccountId: c.accountableOwnerAccountId,
    agreedDueAt: "2026-11-28T16:00:00Z",
    timeZone: c.timeZone,
    acceptance: c.acceptance,
    supportingWorkIds: c.supportingWorkIds,
    planningNodeIds: c.planningNodeIds,
    requirementIds: c.requirementIds,
    requiredGateIds: c.requiredGateIds,
    phase: c.phase,
  };
};
describe("agreements, owner acceptance, and version applicability", () => {
  it("limits execution setup identifiers to the authenticated administrator UI", async () => {
    const f = await createExample();
    const admin = await f.service.workspace("10000");
    expect(admin.installationBinding).toEqual({
      appId: f.service.ctx.appId,
      environmentId: f.service.ctx.environmentId,
      installationId: f.service.ctx.installationId,
      cloudId: f.service.ctx.cloudId,
    });
    const viewer = await f.as("leah").workspace("10000");
    expect(viewer.installationBinding).toBeUndefined();
  });
  it("cannot activate an incomplete Rovo candidate", async () => {
    const f = await createExample();
    const draft = (await f.service.run("commitment.createDraft", {
      title: "Incomplete extraction",
      projectIds: ["10000"],
    })) as Stored<CommitmentRecord>;
    await expect(
      f.service.run("commitment.confirm", {
        commitmentId: draft.value.id,
        expectedRevision: draft.revision,
      }),
    ).rejects.toThrow();
  });
  it("preserves original deadline, historic versions, and current owner while changes await acceptance", async () => {
    const f = await createExample(),
      old = (await f.repo.get("commitment", "PM-101", commitmentRecordSchema))!;
    const changed = (await f.service.run("commitment.proposeRevision", {
      commitmentId: "PM-101",
      expectedRevision: old.revision,
      draft: revised(old.value),
    })) as Stored<CommitmentRecord>;
    expect(activeVersion(changed.value)?.agreedDueAt).toBe(
      activeVersion(old.value)?.agreedDueAt,
    );
    await expect(
      f.as("jon").run("commitment.confirm", {
        commitmentId: "PM-101",
        expectedRevision: changed.revision,
      }),
    ).rejects.toThrow("nominated");
    const accepted = (await f.as("maya").run("commitment.confirm", {
      commitmentId: "PM-101",
      expectedRevision: changed.revision,
    })) as Stored<CommitmentRecord>;
    expect(accepted.value.versions[0]).toEqual(old.value.versions[0]);
    expect(activeVersion(accepted.value)?.version).toBe(2);
    expect(activeVersion(accepted.value)?.originalDueAt).toBe(
      activeVersion(old.value)?.originalDueAt,
    );
    const transfer = (await f.service.run("commitment.transferOwner", {
      commitmentId: "PM-101",
      expectedRevision: accepted.revision,
      incomingOwnerAccountId: "jon",
    })) as Stored<CommitmentRecord>;
    expect(activeVersion(transfer.value)?.accountableOwnerAccountId).toBe(
      "maya",
    );
    const moved = (await f.as("jon").run("commitment.acceptOwner", {
      commitmentId: "PM-101",
      expectedRevision: transfer.revision,
    })) as Stored<CommitmentRecord>;
    expect(activeVersion(moved.value)?.accountableOwnerAccountId).toBe("jon");
  });
  it("retains a historic accepted gate while a PRD revision supersedes applicability", async () => {
    const f = await createExample();
    const before = await f.service.workspace("10000");
    const gate = before.gates[0]!;
    expect(gate.readiness).toBe("READY_FOR_REVIEW");
    await f.as("jon").run("lifecycle.reviewGate", {
      projectId: "10000",
      expectedRevision: before.projectState!.revision,
      gateId: gate.gateId,
      basisHash: gate.basisHash,
      disposition: "ACCEPT",
      note: "Reviewed current release evidence.",
    });
    expect((await f.service.workspace("10000")).gates[0]?.readiness).toBe(
      "ACCEPTED",
    );
    f.sources.changeRequirement();
    const after = await f.service.workspace("10000");
    expect(after.gates[0]?.readiness).toBe("SUPERSEDED");
    expect(after.projectState!.value.gates[0]!.reviews).toHaveLength(1);
    expect(after.projectState!.value.requirements[0]!.mappingState).toBe(
      "STALE",
    );
    expect(
      (await f.repo.get("commitment", "PM-101", commitmentRecordSchema))!.value
        .operations,
    ).toHaveLength(0);
  });
  it("omits restricted work and Confluence commitments from views and counts", async () => {
    const f = await createExample();
    f.sources.hiddenPages.add("203");
    const w = await f.service.workspace("10000");
    expect(w.commitments.some((c) => c.value.id === "PM-101")).toBe(false);
    expect(w.projectState!.value.requirements).toHaveLength(0);
    expect(w.gates).toHaveLength(0);
    expect(JSON.stringify(w)).not.toContain(
      "One activation per merchant request",
    );
    await expect(
      f.service.run("proposal.prepare", {
        commitmentId: "PM-101",
        expectedRevision: 1,
        issueId: "121",
        desiredDueDate: "2026-11-21",
        alternative: "REPAIR",
      }),
    ).rejects.toThrow("unavailable");
  });
  it("closing Jira work does not satisfy a human acceptance condition", async () => {
    const f = await createExample();
    for (const w of f.sources.workItems) {
      w.resolved = true;
      w.statusId = "done";
    }
    const result = (await f.service.run("outcome.verify", {
      commitmentId: "PM-101",
      expectedRevision: 1,
      attestedConditionIds: [],
      evidenceNote: "",
    })) as Stored<CommitmentRecord>;
    expect(result.value.outcomes.at(-1)?.status).toBe("PENDING");
  });
  it("only the designated verifier attests; late verification uses the original deadline", async () => {
    const f = await createExample();
    await expect(
      f.as("jon").run("outcome.verify", {
        commitmentId: "PM-101",
        expectedRevision: 1,
        attestedConditionIds: ["production-onboarding"],
        evidenceNote: "I approve",
      }),
    ).rejects.toThrow();
    f.sources.currentPrincipal = "maya";
    const late = new PromisoryService(
      exampleContext(),
      f.repo,
      f.sources,
      new UnconfiguredExecutor(),
      { mode: "EXAMPLE", clock: () => "2026-11-21T09:00:00Z" },
    );
    const result = (await late.run("outcome.verify", {
      commitmentId: "PM-101",
      expectedRevision: 1,
      attestedConditionIds: ["production-onboarding"],
      evidenceNote: "The customer accepted the production evidence.",
    })) as Stored<CommitmentRecord>;
    expect(result.value.outcomes.at(-1)).toMatchObject({
      status: "VERIFIED",
      timeliness: "LATE",
    });
  });
  it("rechecks historical versions and pending drafts rather than leaking them beside a permitted active version", async () => {
    const f = await createExample(),
      original = (await f.repo.get(
        "commitment",
        "PM-101",
        commitmentRecordSchema,
      ))!;
    const draft = revised(original.value);
    draft.requirementIds = [];
    draft.requiredGateIds = [];
    const proposed = (await f.service.run("commitment.proposeRevision", {
      commitmentId: "PM-101",
      expectedRevision: 1,
      draft,
    })) as Stored<CommitmentRecord>;
    await f.service.run("commitment.confirm", {
      commitmentId: "PM-101",
      expectedRevision: proposed.revision,
    });
    f.sources.hiddenPages.add("203");
    expect(
      (await f.service.workspace("10000")).commitments.map((c) => c.value.id),
    ).not.toContain("PM-101");
    await expect(
      f.service.run("outcome.verify", {
        commitmentId: "PM-101",
        expectedRevision: 3,
        attestedConditionIds: [],
        evidenceNote: "",
      }),
    ).rejects.toThrow("unavailable");
  });
  it("does not return unrelated restricted project content in a mutation receipt", async () => {
    const f = await createExample();
    f.sources.hiddenPages.add("203");
    const result = await f.service.run("roles.bind", {
      projectId: "10000",
      expectedRevision: 1,
      accountId: "leah",
      role: "CONTRIBUTOR",
      scopeType: "PROJECT",
      scopeId: "10000",
    });
    expect(result).toEqual({ revision: 2, value: { id: "10000" } });
    expect(JSON.stringify(result)).not.toContain("PRD");
    await expect(
      f.service.run("lifecycle.assessReadiness", {
        projectId: "10000",
        gateId: "release-readiness",
      }),
    ).rejects.toThrow();
  });
  it("preserves a versioned attestation and its evidence, and requires an explicit revocation for human regression", async () => {
    const f = await createExample();
    const accepted = (await f.service.run("outcome.verify", {
      commitmentId: "PM-101",
      expectedRevision: 1,
      attestedConditionIds: ["production-onboarding"],
      evidenceNote: "Customer sign-off of the deployed acceptance report.",
    })) as Stored<CommitmentRecord>;
    expect(accepted.value.outcomes[0]?.attestations[0]).toMatchObject({
      conditionVersion: 1,
      verifierAccountId: "maya",
      evidenceNote: "Customer sign-off of the deployed acceptance report.",
    });
    const checked = (await f.service.run("outcome.verify", {
      commitmentId: "PM-101",
      expectedRevision: accepted.revision,
      attestedConditionIds: [],
      evidenceNote: "",
    })) as Stored<CommitmentRecord>;
    expect(checked.value.outcomes.at(-1)?.status).toBe("VERIFIED");
    const revoked = (await f.service.run("outcome.verify", {
      commitmentId: "PM-101",
      expectedRevision: checked.revision,
      attestedConditionIds: [],
      revokedConditionIds: ["production-onboarding"],
      evidenceNote:
        "The customer reproduced duplicate activation in production.",
    })) as Stored<CommitmentRecord>;
    expect(revoked.value.outcomes.at(-1)).toMatchObject({
      status: "REGRESSED",
      regressionOfOutcomeId: checked.value.outcomes.at(-1)?.id,
    });
    expect(revoked.value.outcomes[0]?.status).toBe("VERIFIED");
  });
  it("a gate-only dependency still invalidates a proposal when its source version changes", async () => {
    const f = await createExample(),
      record = (await f.repo.get(
        "commitment",
        "PM-101",
        commitmentRecordSchema,
      ))!;
    record.value.versions[0]!.requirementIds = [];
    await f.repo.save(
      "commitment",
      record.value.id,
      record.revision,
      record.value,
      commitmentRecordSchema,
    );
    const prepared = (await f.service.run("proposal.prepare", {
      commitmentId: "PM-101",
      expectedRevision: 2,
      issueId: "121",
      desiredDueDate: "2026-11-23",
      alternative: "REPAIR",
    })) as Stored<CommitmentRecord>;
    f.sources.changeRequirement();
    const proposal = prepared.value.proposals[0]!;
    await expect(
      f.as("jon").run("review.record", {
        commitmentId: "PM-101",
        expectedRevision: prepared.revision,
        proposalId: proposal.id,
        intentHash: proposal.intentHash,
        disposition: "APPROVE",
        note: "Reviewed",
      }),
    ).rejects.toThrow("gate source changed");
  });
});
