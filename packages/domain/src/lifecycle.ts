import type {
  AcceptanceCondition,
  ConditionResult,
  LifecycleGate,
  LifecycleArtifact,
  RequirementRecord,
  StakeholderBinding,
  TrustedContext,
} from "@promisory/contracts";
import { hash } from "./primitives";
import type { SourcePort } from "./ports";

export function bindingApplies(
  binding: StakeholderBinding,
  ctx: TrustedContext,
  at: string,
  scopeIds: string[],
  roles: string[],
): boolean {
  return (
    binding.accountId === ctx.principalAccountId &&
    scopeIds.includes(binding.scopeId) &&
    roles.includes(binding.role) &&
    Date.parse(binding.validFrom) <= Date.parse(at) &&
    (!binding.validUntil || Date.parse(binding.validUntil) > Date.parse(at))
  );
}
export async function evaluateConditions(
  conditions: AcceptanceCondition[],
  sources: SourcePort,
  principal: string,
  attested: string[] = [],
): Promise<ConditionResult[]> {
  return Promise.all(
    conditions.map(async (c) => {
      const unknown: ConditionResult = {
        conditionId: c.id,
        result: "UNKNOWN",
        evidenceSourceIds: [],
        explanation: "Qualifying evidence is not yet available.",
      };
      if (
        c.predicate === "DESIGNATED_HUMAN_ACCEPTANCE" ||
        c.predicate === "EXPLICIT_EVIDENCE"
      ) {
        return attested.includes(c.id) &&
          c.designatedVerifierAccountId === principal
          ? {
              conditionId: c.id,
              result: "PASS" as const,
              evidenceSourceIds: [`attestation:${principal}:${c.id}`],
              explanation:
                "The designated verifier explicitly accepted this condition.",
            }
          : unknown;
      }
      try {
        if (c.predicate === "QUALIFYING_RELEASE") {
          const releases = await Promise.all(
            c.sourceIds.map((id) => sources.release(id)),
          );
          return {
            conditionId: c.id,
            result: releases.every((r) => r.released) ? "PASS" : "FAIL",
            evidenceSourceIds: c.sourceIds,
            explanation:
              "Checked the agreed Jira release versions; this establishes release, not adoption.",
          };
        }
        const work = await Promise.all(
          c.sourceIds.map((id) => sources.work(id.split(":").at(-1)!)),
        );
        const matches = work.every((w) =>
          c.expectedState?.field === "statusId"
            ? w.statusId === c.expectedState.value
            : w.targetDate === c.expectedState?.value,
        );
        return {
          conditionId: c.id,
          result: matches ? "PASS" : "FAIL",
          evidenceSourceIds: work.map((w) => w.id),
          explanation:
            "Checked the exact source state named in this agreement.",
        };
      } catch {
        return unknown;
      }
    }),
  );
}
export interface GateAssessment {
  gateId: string;
  readiness:
    | "UNKNOWN"
    | "NOT_READY"
    | "READY_FOR_REVIEW"
    | "ACCEPTED"
    | "HELD"
    | "SUPERSEDED"
    | "NOT_APPLICABLE";
  applicability: "CURRENT" | "STALE" | "UNKNOWN";
  basisHash: string;
  reasons: string[];
  conditions: ConditionResult[];
}
export async function assessGate(
  gate: LifecycleGate,
  artifacts: LifecycleArtifact[],
  requirements: RequirementRecord[],
  source: SourcePort,
  principal: string,
  bindings: StakeholderBinding[],
  now: string,
): Promise<GateAssessment> {
  const reasons: string[] = [];
  let stale = false,
    unknown = false;
  const basisHash = await hash({
    gateId: gate.id,
    gateVersion: gate.version,
    basis: gate.basis,
    conditions: gate.conditions,
    reviewerBindingIds: gate.reviewerBindingIds,
  });
  for (const required of gate.basis) {
    if (required.entityKind === "ARTIFACT") {
      const artifact = artifacts.find((a) => a.id === required.entityId);
      if (!artifact) {
        unknown = true;
        reasons.push("A required artifact is unavailable.");
        continue;
      }
      try {
        const current = await source.page(artifact.pageId);
        if (current.revision !== required.revision) {
          stale = true;
          reasons.push(
            "A required document changed after this gate was prepared.",
          );
        }
      } catch {
        unknown = true;
        reasons.push(
          "A required document cannot be checked with your current access.",
        );
      }
    } else if (required.entityKind === "REQUIREMENT") {
      const requirement = requirements.find((r) => r.id === required.entityId);
      if (!requirement) {
        unknown = true;
        reasons.push("A required mapping is unavailable.");
      } else if (
        `${requirement.version}:${requirement.contentFingerprint}` !==
          required.revision ||
        requirement.mappingState !== "CONFIRMED"
      ) {
        stale = true;
        reasons.push("A requirement mapping needs reassessment.");
      }
    } else if (
      required.entityKind === "WORK" ||
      required.entityKind === "SCHEDULE"
    ) {
      try {
        const current =
          required.entityKind === "WORK"
            ? (await source.work(required.entityId.split(":").at(-1)!)).source
            : (await source.release(required.entityId)).source;
        if (current.sourceRevision !== required.revision) {
          stale = true;
          reasons.push(
            "Required Jira evidence changed after this gate was prepared.",
          );
        }
      } catch {
        unknown = true;
        reasons.push("Required Jira evidence is unavailable with your access.");
      }
    }
  }
  const conditions = await evaluateConditions(
    gate.conditions,
    source,
    principal,
  );
  const requiredConditions = new Set(
    gate.conditions.filter((c) => c.required).map((c) => c.id),
  );
  const relevant = conditions.filter((c) =>
    requiredConditions.has(c.conditionId),
  );
  const currentReviews = gate.reviews.filter(
    (r) =>
      r.basisHash === basisHash &&
      bindings.some(
        (b) =>
          b.id === r.bindingId &&
          gate.reviewerBindingIds.includes(b.id) &&
          b.accountId === r.reviewerAccountId &&
          ["APPROVER", "RELEASE_OWNER"].includes(b.role) &&
          [gate.id, gate.projectId].includes(b.scopeId) &&
          Date.parse(b.validFrom) <= Date.parse(now) &&
          (!b.validUntil || Date.parse(b.validUntil) > Date.parse(now)),
      ),
  );
  const latest = new Map<string, (typeof currentReviews)[number]>();
  for (const r of currentReviews) latest.set(r.bindingId, r);
  const ready = relevant.every((c) => c.result === "PASS");
  let readiness: GateAssessment["readiness"] = relevant.some(
    (c) => c.result === "FAIL",
  )
    ? "NOT_READY"
    : ready
      ? "READY_FOR_REVIEW"
      : "UNKNOWN";
  if (unknown) readiness = "UNKNOWN";
  if (stale) readiness = "SUPERSEDED";
  if (!stale && !unknown) {
    if ([...latest.values()].some((r) => r.disposition === "HOLD"))
      readiness = "HELD";
    else if (
      gate.reviewerBindingIds.every(
        (id) => latest.get(id)?.disposition === "NOT_APPLICABLE",
      )
    )
      readiness = "NOT_APPLICABLE";
    else if (
      ready &&
      gate.reviewerBindingIds.every(
        (id) => latest.get(id)?.disposition === "ACCEPT",
      )
    )
      readiness = "ACCEPTED";
  }
  return {
    gateId: gate.id,
    readiness,
    applicability: stale ? "STALE" : unknown ? "UNKNOWN" : "CURRENT",
    basisHash,
    reasons,
    conditions,
  };
}
