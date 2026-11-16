import { describe, expect, it } from "vitest";
import {
  commitmentRecordSchema,
  type CommitmentRecord,
  type ImpactAssessment,
} from "@promisory/contracts";
import {
  MIN_SAMPLE,
  promiseLedger,
  type PromiseLedger,
} from "@promisory/domain";
import { createExample } from "@promisory/test-fixtures";

async function records() {
  const f = await createExample();
  const out: CommitmentRecord[] = [];
  for (const id of ["PM-101", "PM-102", "PM-103", "PM-104"])
    out.push(
      (await f.repo.get("commitment", id, commitmentRecordSchema))!.value,
    );
  return out;
}
const assessment = (commitmentId: string, health: string) =>
  ({ commitmentId, health }) as unknown as ImpactAssessment;

describe("promise ledger", () => {
  it("reports counts, hides rates for small groups and never names people", async () => {
    const rs = await records();
    const ledger = promiseLedger({
      records: rs,
      assessments: [assessment("PM-101", "AT_RISK")],
      ownerAvailable: () => true,
      now: "2026-11-18T08:00:00.000Z",
    });
    expect(ledger.counts).toMatchObject({
      active: 3,
      atRisk: 1,
      fulfilledOnTime: 1,
      fulfilledLate: 0,
    });
    expect(ledger.reliability.value).toBeNull();
    expect(ledger.ownedRate).toMatchObject({
      numerator: 3,
      denominator: 3,
      value: null,
    });
    expect(ledger.exposure).toEqual([]);
    expect(ledger.exposureValueNotStated).toBe(1);
    expect(JSON.stringify(ledger)).not.toMatch(/maya|jon|alex|leah|owen/);
  });

  it("uses original deadlines, counts a late cancellation as missed, and measures notice lead time", async () => {
    const base = (await records())[1]!; // PM-102, original due 25 Nov 16:00Z
    const make = (id: string, patch: (r: CommitmentRecord) => void) => {
      const r = structuredClone(base);
      r.id = id;
      r.versions[0]!.id = id;
      patch(r);
      return r;
    };
    const rs = [
      // Renegotiated 5 days before the original deadline, then verified late against it.
      make("A", (r) => {
        r.versions.push({
          ...r.versions[0]!,
          version: 2,
          agreedDueAt: "2026-11-30T16:00:00.000Z",
          ownerAcceptedAt: "2026-11-20T16:00:00.000Z",
          supersedesVersion: 1,
        });
        r.outcomes.push({
          id: "o-a",
          commitmentId: "A",
          commitmentVersion: 2,
          conditionResults: [
            {
              conditionId: "production-onboarding",
              result: "PASS",
              evidenceSourceIds: ["x"],
              explanation: "ok",
            },
          ],
          verifierAccountId: "jon",
          verifiedAt: "2026-11-29T10:00:00.000Z",
          status: "VERIFIED",
          timeliness: "LATE",
          attestations: [],
        } as never);
      }),
      // Cancelled after its original deadline: still a missed promise.
      make("B", (r) => {
        r.closure = {
          kind: "CANCELLED",
          reason: "Withdrawn late.",
          closedByAccountId: "jon",
          closedAt: "2026-11-27T00:00:00.000Z",
          closedVersion: 1,
        };
      }),
      // Cancelled before its deadline: not due, not counted.
      make("C", (r) => {
        r.closure = {
          kind: "CANCELLED",
          reason: "Withdrawn early.",
          closedByAccountId: "jon",
          closedAt: "2026-11-19T00:00:00.000Z",
          closedVersion: 1,
        };
      }),
      ...["D", "E", "F"].map((id) =>
        make(id, (r) => {
          r.versions[0]!.valueAtStake = {
            amount: 60_000,
            currency: "EUR",
            basis: "CONTRACT_PENALTY",
          };
        }),
      ),
    ];
    const ledger: PromiseLedger = promiseLedger({
      records: rs,
      assessments: ["D", "E", "F"].map((id) => assessment(id, "BREACHED")),
      ownerAvailable: () => true,
      now: "2026-12-01T00:00:00.000Z",
    });
    expect(ledger.counts).toMatchObject({
      fulfilledLate: 1,
      cancelled: 2,
      renegotiated: 1,
      breachedOpen: 3,
    });
    // Due: A (late), B (cancelled after due), D, E, F (open past due) = 5; kept on original = 0.
    expect(ledger.reliability).toEqual({
      numerator: 0,
      denominator: MIN_SAMPLE,
      value: 0,
    });
    expect(ledger.noticeLeadTimeDays).toEqual({ median: 5, samples: 1 });
    expect(ledger.exposure).toEqual([
      { currency: "EUR", amount: 180_000, commitments: 3 },
    ]);
  });

  it("is available through the access-checked metrics command", async () => {
    const f = await createExample();
    const ledger = (await f.service.run("metrics.read", {
      projectId: "10000",
    })) as PromiseLedger;
    expect(ledger.scope).toBe("PROJECT");
    expect(ledger.counts.fulfilledOnTime).toBe(1);
    f.sources.hiddenWork.add("121");
    const restricted = (await f.service.run("metrics.read", {
      projectId: "10000",
    })) as PromiseLedger;
    // PM-101 is restricted for this reader, so it is neither shown nor counted.
    expect(restricted.counts.active + restricted.counts.fulfilledOnTime).toBe(
      ledger.counts.active + ledger.counts.fulfilledOnTime - 1,
    );
  });
});
