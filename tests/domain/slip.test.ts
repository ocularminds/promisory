import { describe, expect, it } from "vitest";
import type { CommitmentRecord } from "@promisory/contracts";
import { assessSlip, type Stored } from "@promisory/domain";
import { createExample } from "@promisory/test-fixtures";

const agreement = {
  agreedDueAt: "2026-11-20T16:00:00.000Z", // 17:00 Europe/Stockholm
  timeZone: "Europe/Stockholm",
};

describe("slip budget assessment", () => {
  it("is within budget only when a budget exists, the delay fits and the promise date still holds", () => {
    expect(
      assessSlip(
        { ...agreement, slipBudgetDays: 3 },
        "2026-11-15",
        "2026-11-18",
      ),
    ).toEqual({
      delayDays: 3,
      budgetDays: 3,
      withinBudget: true,
      exceedsCommitmentDeadline: false,
    });
    expect(
      assessSlip(
        { ...agreement, slipBudgetDays: 2 },
        "2026-11-15",
        "2026-11-18",
      ).withinBudget,
    ).toBe(false);
    expect(assessSlip(agreement, "2026-11-15", "2026-11-16").withinBudget).toBe(
      false,
    );
    expect(
      assessSlip(
        { ...agreement, slipBudgetDays: 30 },
        "2026-11-19",
        "2026-11-21",
      ),
    ).toMatchObject({ withinBudget: false, exceedsCommitmentDeadline: true });
    expect(
      assessSlip({ ...agreement, slipBudgetDays: 5 }, null, "2026-11-18")
        .withinBudget,
    ).toBe(false);
    expect(
      assessSlip(
        { ...agreement, slipBudgetDays: 0 },
        "2026-11-18",
        "2026-11-16",
      ),
    ).toMatchObject({ delayDays: -2, withinBudget: true });
  });
  it("uses the agreed time zone for the promise date, not UTC", () => {
    // 23:30 UTC on 20 Nov is 00:30 on 21 Nov in Stockholm.
    expect(
      assessSlip(
        {
          agreedDueAt: "2026-11-20T23:30:00.000Z",
          timeZone: "Europe/Stockholm",
          slipBudgetDays: 5,
        },
        "2026-11-19",
        "2026-11-21",
      ).exceedsCommitmentDeadline,
    ).toBe(false);
  });
  it("hashes the slip assessment into the prepared proposal and keeps review applicability", async () => {
    const f = await createExample();
    const prepared = (await f.service.run("proposal.prepare", {
      commitmentId: "PM-101",
      expectedRevision: 1,
      issueId: "121",
      desiredDueDate: "2026-11-23",
      alternative: "REPAIR",
    })) as Stored<CommitmentRecord>;
    const proposal = prepared.value.proposals[0]!;
    expect(proposal.slip).toEqual({
      delayDays: 4,
      withinBudget: false,
      exceedsCommitmentDeadline: true,
    });
    expect(prepared.value.history.at(-1)!.summary).toContain(
      "past the commitment deadline",
    );
    await expect(
      f.as("jon").run("review.record", {
        commitmentId: "PM-101",
        expectedRevision: prepared.revision,
        proposalId: proposal.id,
        intentHash: proposal.intentHash,
        disposition: "APPROVE",
        note: "Reviewed with the slip assessment.",
      }),
    ).resolves.toBeDefined();
  });
});
