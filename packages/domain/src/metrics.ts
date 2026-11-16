import type {
  CommitmentRecord,
  CommitmentVersion,
  ImpactAssessment,
} from "@promisory/contracts";

/** Rates are hidden below this many commitments so small groups are not exposed. */
export const MIN_SAMPLE = 5;

export interface PromiseLedger {
  scope: "PROJECT";
  computedAt: string;
  counts: {
    draft: number;
    active: number;
    atRisk: number;
    breachedOpen: number;
    fulfilledOnTime: number;
    fulfilledLate: number;
    cancelled: number;
    superseded: number;
    renegotiated: number;
  };
  /** Accepted, open commitments whose owner is accepted and available. */
  ownedRate: Rate;
  /** Fulfilled by the ORIGINAL deadline / commitments whose original deadline has passed. */
  reliability: Rate;
  /** Verified outcomes whose every passing condition cites evidence. */
  evidenceBackedFulfillment: Rate;
  /**
   * Days between agreeing a later deadline and the original deadline.
   * Positive means the beneficiary heard early; negative means after the breach.
   */
  noticeLeadTimeDays: { median: number | null; samples: number };
  /** Stated value of open AT_RISK or BREACHED commitments, per currency. */
  exposure: Array<{ currency: string; amount: number; commitments: number }>;
  exposureValueNotStated: number;
  notes: string[];
}
export interface Rate {
  numerator: number;
  denominator: number;
  /** null when denominator < MIN_SAMPLE */
  value: number | null;
}
const rate = (numerator: number, denominator: number): Rate => ({
  numerator,
  denominator,
  value:
    denominator >= MIN_SAMPLE
      ? Math.round((numerator / denominator) * 1000) / 1000
      : null,
});
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
};
const DAY = 86_400_000;

/**
 * Project-level promise ledger computed only from records the reader may see.
 * It reports commitments and processes, never individual people.
 */
export function promiseLedger(input: {
  records: CommitmentRecord[];
  assessments: ImpactAssessment[];
  ownerAvailable: (accountId: string) => boolean;
  now: string;
}): PromiseLedger {
  const now = Date.parse(input.now);
  const counts = {
    draft: 0,
    active: 0,
    atRisk: 0,
    breachedOpen: 0,
    fulfilledOnTime: 0,
    fulfilledLate: 0,
    cancelled: 0,
    superseded: 0,
    renegotiated: 0,
  };
  let owned = 0,
    openAccepted = 0,
    dueCount = 0,
    keptOnOriginal = 0,
    verified = 0,
    evidenced = 0,
    valueNotStated = 0;
  const leadTimes: number[] = [];
  const exposure = new Map<string, { amount: number; commitments: number }>();

  for (const record of input.records) {
    const current = record.versions.at(-1);
    if (!current) {
      counts.draft++;
      continue;
    }
    const first = record.versions[0]!;
    const originalDue = Date.parse(first.originalDueAt);
    if (record.versions.some((v) => v.agreedDueAt !== first.originalDueAt))
      counts.renegotiated++;
    // Notice lead time: when a later deadline was first accepted, relative to the original.
    const firstLater = record.versions.find(
      (v: CommitmentVersion) =>
        Date.parse(v.agreedDueAt) > Date.parse(v.originalDueAt),
    );
    if (firstLater)
      leadTimes.push(
        Math.round(
          ((originalDue - Date.parse(firstLater.ownerAcceptedAt)) / DAY) * 10,
        ) / 10,
      );
    const outcome = record.outcomes
      .filter((o) => o.commitmentVersion === current.version)
      .at(-1);
    const isVerified = outcome?.status === "VERIFIED";
    if (record.closure) {
      if (record.closure.kind === "CANCELLED") counts.cancelled++;
      else counts.superseded++;
      // A promise closed after its original deadline was still due, and missed.
      if (Date.parse(record.closure.closedAt) > originalDue) dueCount++;
      continue;
    }
    if (isVerified) {
      verified++;
      if (
        outcome.conditionResults.every(
          (r) => r.result !== "PASS" || r.evidenceSourceIds.length > 0,
        )
      )
        evidenced++;
      const onTime = Date.parse(outcome.verifiedAt) <= originalDue;
      if (onTime) {
        counts.fulfilledOnTime++;
        keptOnOriginal++;
      } else counts.fulfilledLate++;
      if (originalDue <= now || onTime) dueCount++;
      continue;
    }
    counts.active++;
    openAccepted++;
    if (input.ownerAvailable(current.accountableOwnerAccountId)) owned++;
    if (originalDue <= now) dueCount++;
    const health = input.assessments.find(
      (a) => a.commitmentId === record.id,
    )?.health;
    if (health === "BREACHED") counts.breachedOpen++;
    if (health === "AT_RISK") counts.atRisk++;
    if (health === "AT_RISK" || health === "BREACHED") {
      if (!current.valueAtStake) valueNotStated++;
      else {
        const entry = exposure.get(current.valueAtStake.currency) ?? {
          amount: 0,
          commitments: 0,
        };
        entry.amount += current.valueAtStake.amount;
        entry.commitments++;
        exposure.set(current.valueAtStake.currency, entry);
      }
    }
  }
  const notes = [
    "Counts include only commitments you can access; restricted commitments are omitted, not counted.",
    "Reliability uses each commitment's original deadline; renegotiation never erases an earlier miss.",
  ];
  if (dueCount < MIN_SAMPLE || openAccepted < MIN_SAMPLE)
    notes.push(
      `Rates are shown only with at least ${MIN_SAMPLE} commitments; smaller groups show counts only.`,
    );
  if (valueNotStated)
    notes.push(
      "Some at-risk commitments have no stated value; exposure is a lower bound, not an estimate.",
    );
  return {
    scope: "PROJECT",
    computedAt: input.now,
    counts,
    ownedRate: rate(owned, openAccepted),
    reliability: rate(keptOnOriginal, dueCount),
    evidenceBackedFulfillment: rate(evidenced, verified),
    noticeLeadTimeDays: {
      median: median(leadTimes),
      samples: leadTimes.length,
    },
    exposure: [...exposure.entries()]
      .map(([currency, v]) => ({ currency, ...v }))
      .sort((a, b) => b.amount - a.amount),
    exposureValueNotStated: valueNotStated,
    notes,
  };
}
