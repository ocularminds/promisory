import { describe, expect, it, vi } from "vitest";
import {
  commitmentRecordSchema,
  type CommitmentRecord,
} from "@promisory/contracts";
import {
  PromisoryService,
  UnconfiguredExecutor,
  type Stored,
} from "@promisory/domain";
import {
  createExample,
  exampleContext,
  EXAMPLE_CLOCK,
} from "@promisory/test-fixtures";

describe("shared prepare, review, execute service", () => {
  it("checks connections with trusted context and rejects identity or effect overrides without an execution call", async () => {
    const f = await createExample();
    const checkConnection = vi.fn(async () =>
      new UnconfiguredExecutor().capability(),
    );
    const execute = vi.fn(),
      reconcile = vi.fn();
    const service = new PromisoryService(
      exampleContext(),
      f.repo,
      f.sources,
      {
        capability: () => new UnconfiguredExecutor().capability(),
        checkConnection,
        execute,
        reconcile,
      },
      { mode: "EXAMPLE", clock: () => EXAMPLE_CLOCK },
    );
    await service.run("connections.check", {});
    expect(checkConnection).toHaveBeenCalledExactlyOnceWith(exampleContext());
    await expect(
      service.run("connections.check", { principalAccountId: "jon" }),
    ).rejects.toThrow();
    await expect(
      service.run("connections.check", {
        effect: { desiredDueDate: "2026-11-23" },
      }),
    ).rejects.toThrow();
    expect(checkConnection).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
  });
  it("rejects review and apply at expiry while preserving the earlier exact approval", async () => {
    const f = await createExample();
    const prepared = (await f.service.run("proposal.prepare", {
      commitmentId: "PM-101",
      expectedRevision: 1,
      issueId: "121",
      desiredDueDate: "2026-11-23",
      alternative: "REPAIR",
    })) as Stored<CommitmentRecord>;
    const proposal = prepared.value.proposals[0]!,
      review = {
        commitmentId: "PM-101",
        expectedRevision: prepared.revision,
        proposalId: proposal.id,
        intentHash: proposal.intentHash,
        disposition: "APPROVE",
        note: "Reviewed before the exact proposal expiry.",
      };
    const reviewed = (await f
      .as("jon")
      .run("review.record", review)) as Stored<CommitmentRecord>;
    const execute = vi.fn();
    const expiredService = (principal: string) => {
      f.sources.currentPrincipal = principal;
      return new PromisoryService(
        exampleContext(principal),
        f.repo,
        f.sources,
        {
          capability: () => new UnconfiguredExecutor().capability(),
          checkConnection: () => new UnconfiguredExecutor().checkConnection(),
          execute,
          reconcile: vi.fn(),
        },
        { mode: "EXAMPLE", clock: () => proposal.expiresAt },
      );
    };
    await expect(
      expiredService("jon").run("review.record", {
        ...review,
        expectedRevision: reviewed.revision,
      }),
    ).rejects.toThrow("This proposal expired");
    await expect(
      expiredService("maya").run("action.apply", {
        commitmentId: "PM-101",
        expectedRevision: reviewed.revision,
        proposalId: proposal.id,
        idempotencyKey: "expired-attempt",
      }),
    ).rejects.toThrow("This proposal expired");
    expect(execute).not.toHaveBeenCalled();
    const after = await f.repo.get(
      "commitment",
      "PM-101",
      commitmentRecordSchema,
    );
    expect(after).toEqual(reviewed);
  });
  it("requires an independent exact review and native permission, and returns an earlier uncertain attempt even with a new key", async () => {
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
    const proposal = prepared.value.proposals[0]!,
      review = {
        commitmentId: "PM-101",
        expectedRevision: prepared.revision,
        proposalId: proposal.id,
        intentHash: proposal.intentHash,
        disposition: "APPROVE",
        note: "Reviewed current exact effect.",
      };
    await expect(service.run("review.record", review)).rejects.toThrow(
      "designated approver",
    );
    await expect(
      service.run("action.apply", {
        commitmentId: "PM-101",
        expectedRevision: prepared.revision,
        proposalId: proposal.id,
        idempotencyKey: "attempt-1",
      }),
    ).rejects.toThrow("independent");
    const reviewed = (await f
      .as("jon")
      .run("review.record", review)) as Stored<CommitmentRecord>;
    f.sources.currentPrincipal = "maya";
    const first = await service.run("action.apply", {
      commitmentId: "PM-101",
      expectedRevision: reviewed.revision,
      proposalId: proposal.id,
      idempotencyKey: "attempt-1",
    });
    expect(first).toMatchObject({
      stage: "RECONCILING",
      finalization: "PENDING",
    });
    const repeat = await service.run("action.apply", {
      commitmentId: "PM-101",
      expectedRevision: reviewed.revision,
      proposalId: proposal.id,
      idempotencyKey: "different-key",
    });
    expect(repeat).toEqual(first);
    expect(execute).toHaveBeenCalledTimes(1);
    const record = (await f.repo.get(
      "commitment",
      "PM-101",
      commitmentRecordSchema,
    ))!;
    expect(record.value.versions[0]!.agreedDueAt).toBe(
      "2026-11-20T16:00:00.000Z",
    );
    await expect(
      service.run("commitment.confirm", {
        commitmentId: "PM-101",
        expectedRevision: record.revision,
      }),
    ).rejects.toThrow();
  });
});
