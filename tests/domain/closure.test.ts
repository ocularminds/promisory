import { describe, expect, it, vi } from "vitest";
import {
  commitmentRecordSchema,
  type CommitmentRecord,
} from "@promisory/contracts";
import {
  PromisoryService,
  UnconfiguredExecutor,
  commitmentLifecycle,
  type Stored,
  type Workspace,
} from "@promisory/domain";
import {
  createExample,
  exampleContext,
  EXAMPLE_CLOCK,
} from "@promisory/test-fixtures";

const read = async (f: Awaited<ReturnType<typeof createExample>>, id: string) =>
  (await f.repo.get("commitment", id, commitmentRecordSchema))!;

describe("commitment cancellation and supersession", () => {
  it("cancels an accepted commitment, keeps its history and original deadline, and stops further changes", async () => {
    const f = await createExample();
    const cancelled = (await f.service.run("commitment.cancel", {
      commitmentId: "PM-101",
      expectedRevision: 1,
      reason: "Northstar withdrew the launch request.",
    })) as Stored<CommitmentRecord>;
    expect(cancelled.value.closure).toMatchObject({
      kind: "CANCELLED",
      closedByAccountId: "maya",
      closedVersion: 1,
    });
    expect(cancelled.value.closure?.successorCommitmentId).toBeUndefined();
    expect(commitmentLifecycle(cancelled.value)).toBe("CANCELLED");
    expect(cancelled.value.versions).toHaveLength(1);
    expect(cancelled.value.versions[0]!.originalDueAt).toBe(
      "2026-11-20T16:00:00.000Z",
    );
    expect(cancelled.value.history.at(-1)).toMatchObject({ kind: "CANCELLED" });

    for (const [name, payload] of [
      [
        "proposal.prepare",
        {
          issueId: "121",
          desiredDueDate: "2026-11-23",
          alternative: "REPAIR",
        },
      ],
      ["commitment.transferOwner", { incomingOwnerAccountId: "jon" }],
      ["commitment.cancel", { reason: "Again." }],
    ] as const)
      await expect(
        f.service.run(name, {
          commitmentId: "PM-101",
          expectedRevision: cancelled.revision,
          ...payload,
        }),
      ).rejects.toThrow("cancelled");

    const workspace = (await f.service.run("workspace.read", {
      projectId: "10000",
    })) as Workspace;
    expect(workspace.commitments.some((c) => c.value.id === "PM-101")).toBe(
      true,
    );
    expect(workspace.assessments.some((a) => a.commitmentId === "PM-101")).toBe(
      false,
    );
  });

  it("records a breach that happened before cancellation", async () => {
    const f = await createExample();
    const record = await read(f, "PM-103");
    const late = new PromisoryService(
      exampleContext("alex"),
      f.repo,
      f.sources,
      new UnconfiguredExecutor(),
      { mode: "EXAMPLE", clock: () => "2026-12-01T00:00:00.000Z" },
    );
    f.sources.currentPrincipal = "alex";
    const cancelled = (await late.run("commitment.cancel", {
      commitmentId: "PM-103",
      expectedRevision: record.revision,
      reason: "Support handover moved to a different programme.",
    })) as Stored<CommitmentRecord>;
    expect(cancelled.value.history.at(-1)!.summary).toContain(
      "breach remains on record",
    );
    expect(EXAMPLE_CLOCK < "2026-12-01").toBe(true);
  });

  it("lets only the accountable owner or an administrator close a commitment", async () => {
    const f = await createExample();
    await expect(
      // alex is neither PM-101's owner nor a scoped administrator.
      f.as("alex").run("commitment.cancel", {
        commitmentId: "PM-101",
        expectedRevision: 1,
        reason: "Not my promise to cancel.",
      }),
    ).rejects.toThrow("accountable owner or a scoped administrator");
    expect((await read(f, "PM-101")).value.closure).toBeUndefined();
  });

  it("supersedes with an accepted successor in a shared project and rejects invalid successors", async () => {
    const f = await createExample();
    await expect(
      f.service.run("commitment.supersede", {
        commitmentId: "PM-101",
        expectedRevision: 1,
        successorCommitmentId: "PM-101",
        reason: "Self reference.",
      }),
    ).rejects.toThrow("cannot supersede itself");
    await expect(
      f.service.run("commitment.supersede", {
        commitmentId: "PM-101",
        expectedRevision: 1,
        successorCommitmentId: "PM-999",
        reason: "Unknown successor.",
      }),
    ).rejects.toThrow();
    const superseded = (await f.service.run("commitment.supersede", {
      commitmentId: "PM-101",
      expectedRevision: 1,
      successorCommitmentId: "PM-102",
      reason: "Merged into the reconciliation export launch.",
    })) as Stored<CommitmentRecord>;
    expect(superseded.value.closure).toMatchObject({
      kind: "SUPERSEDED",
      successorCommitmentId: "PM-102",
    });
    expect(commitmentLifecycle(superseded.value)).toBe("SUPERSEDED");

    // A closed commitment cannot become anyone's successor.
    const pm102 = await read(f, "PM-102");
    await expect(
      f.as("jon").run("commitment.supersede", {
        commitmentId: "PM-102",
        expectedRevision: pm102.revision,
        successorCommitmentId: "PM-101",
        reason: "Circular supersession.",
      }),
    ).rejects.toThrow("superseded");
  });

  it("refuses to close while a governed change is unresolved", async () => {
    const f = await createExample();
    const execute = vi.fn(async () => {
      throw new Error("response lost");
    });
    const service = new PromisoryService(
      exampleContext(),
      f.repo,
      f.sources,
      {
        capability: () => new UnconfiguredExecutor().capability(),
        checkConnection: () => new UnconfiguredExecutor().checkConnection(),
        execute,
        reconcile: vi.fn(),
      },
      { mode: "EXAMPLE", clock: () => EXAMPLE_CLOCK },
    );
    const prepared = (await service.run("proposal.prepare", {
      commitmentId: "PM-101",
      expectedRevision: 1,
      issueId: "121",
      desiredDueDate: "2026-11-23",
      alternative: "REPAIR",
    })) as Stored<CommitmentRecord>;
    const proposal = prepared.value.proposals[0]!;
    const reviewed = (await f.as("jon").run("review.record", {
      commitmentId: "PM-101",
      expectedRevision: prepared.revision,
      proposalId: proposal.id,
      intentHash: proposal.intentHash,
      disposition: "APPROVE",
      note: "Reviewed current exact effect.",
    })) as Stored<CommitmentRecord>;
    f.sources.currentPrincipal = "maya";
    await expect(
      service.run("action.apply", {
        commitmentId: "PM-101",
        expectedRevision: reviewed.revision,
        proposalId: proposal.id,
        idempotencyKey: "attempt-1",
      }),
    ).resolves.toMatchObject({ stage: "RECONCILING" });
    const current = await read(f, "PM-101");
    await expect(
      service.run("commitment.cancel", {
        commitmentId: "PM-101",
        expectedRevision: current.revision,
        reason: "Trying to close during reconciliation.",
      }),
    ).rejects.toThrow("reconciled");
    expect((await read(f, "PM-101")).value.closure).toBeUndefined();
  });
});
