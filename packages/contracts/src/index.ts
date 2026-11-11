import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";

export const SCHEMA_VERSION = "promisory.v1" as const;
export const id = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_.:/-]+$/);
export const externalId = z.string().regex(/^\d{1,20}$/);
export const shortText = z.string().trim().min(1).max(240);
export const longText = z.string().trim().min(1).max(4000);
export const instant = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    try {
      return Temporal.PlainDate.from(value).toString() === value;
    } catch {
      return false;
    }
  }, "Choose a valid calendar date.");
export const timeZone = z
  .string()
  .max(100)
  .refine((value) => {
    if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(value) && value !== "UTC")
      return false;
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose an IANA time zone.");
export const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const ids = z
  .array(id)
  .max(200)
  .refine(
    (values) => new Set(values).size === values.length,
    "Duplicate identifiers.",
  );
export const phases = [
  "STRATEGY",
  "DISCOVERY",
  "INITIATIVE",
  "DEFINITION",
  "PLANNING",
  "DELIVERY",
  "VALIDATION",
  "RELEASE",
  "OPERATE_LEARN",
  "EVOLVE_RETIRE",
] as const;
export const phaseSchema = z.enum(phases);
export const phaseLabels: Record<(typeof phases)[number], string> = {
  STRATEGY: "Strategy & outcomes",
  DISCOVERY: "Opportunity & discovery",
  INITIATIVE: "Initiative & investment",
  DEFINITION: "Definition & design",
  PLANNING: "Planning & decomposition",
  DELIVERY: "Delivery & collaboration",
  VALIDATION: "Validation & readiness",
  RELEASE: "Release & adoption",
  OPERATE_LEARN: "Operate & learn",
  EVOLVE_RETIRE: "Evolve or retire",
};
export const trustedContextSchema = z.strictObject({
  appId: id,
  environmentId: id,
  installationId: id,
  cloudId: z.uuid(),
  principalAccountId: id,
});
export type TrustedContext = z.infer<typeof trustedContextSchema>;

export const sourceSchema = z
  .strictObject({
    source: z.enum([
      "JIRA",
      "CONFLUENCE",
      "TEAMWORK_GRAPH",
      "USER_ATTESTATION",
    ]),
    sourceId: id,
    sourceRevision: id,
    observedAt: instant,
    checkedAt: instant,
    lineage: z.enum([
      "ATLASSIAN_ONLY",
      "INDEPENDENT_INTENT",
      "PERMITTED_REST_EVIDENCE",
    ]),
    visibility: z.literal("CURRENT_USER"),
    verification: z.enum([
      "UNVERIFIED",
      "VERIFIED",
      "REJECTED",
      "STALE",
      "UNAVAILABLE",
    ]),
  })
  .superRefine((source, ctx) => {
    if (
      source.source === "TEAMWORK_GRAPH" &&
      source.lineage !== "ATLASSIAN_ONLY"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Graph context must stay inside Atlassian.",
        path: ["lineage"],
      });
    }
  });
export type SourceReference = z.infer<typeof sourceSchema>;
export const workSchema = z.strictObject({
  id,
  cloudId: z.uuid(),
  externalId,
  projectId: externalId,
  displayKey: id,
  type: z.enum(["EPIC", "STORY", "TASK", "BUG", "SUBTASK", "CUSTOM"]),
  nativeTypeId: externalId,
  nativeTypeName: shortText,
  hierarchyLevel: z.number().int().min(-1).max(100),
  parentId: id.optional(),
  title: shortText,
  statusId: id,
  statusName: shortText,
  resolved: z.boolean(),
  assigneeAccountId: id.optional(),
  targetDate: dateOnly.nullable(),
  source: sourceSchema,
});
export type WorkNode = z.infer<typeof workSchema>;
export const entityKind = z.enum([
  "WORK",
  "PLANNING",
  "ARTIFACT",
  "REQUIREMENT",
  "COMMITMENT",
  "EVIDENCE",
  "GATE",
  "PROJECT",
  "TEAM",
  "PERSON",
  "OUTCOME",
  "SCHEDULE",
]);
export const edgeSchema = z
  .strictObject({
    id,
    fromId: id,
    toId: id,
    fromKind: entityKind,
    toKind: entityKind,
    kind: z.enum([
      "CONTAINS",
      "PARENT_OF",
      "BLOCKS",
      "SUPPORTS",
      "OWNS",
      "VERIFIES",
      "ALIGNS_TO",
      "DEFINES",
      "IMPLEMENTS",
      "SCHEDULED_FOR",
      "MEASURED_BY",
      "INFORMS",
    ]),
    state: z.enum(["DISCOVERED", "CONFIRMED"]),
    provenance: sourceSchema,
  })
  .superRefine((edge, ctx) => {
    if (
      edge.kind === "PARENT_OF" &&
      (edge.fromKind !== "WORK" ||
        edge.toKind !== "WORK" ||
        edge.provenance.source !== "JIRA")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Native parents must come from Jira work metadata.",
      });
    }
  });
export type WorkEdge = z.infer<typeof edgeSchema>;
export const planningSchema = z.strictObject({
  id,
  projectId: externalId,
  kind: z.enum([
    "VISION",
    "OBJECTIVE",
    "KEY_RESULT",
    "THEME",
    "PORTFOLIO",
    "PROGRAM",
    "PRODUCT",
    "INITIATIVE",
    "IDEA",
    "RELEASE",
  ]),
  title: shortText,
  ownerAccountId: id,
  nativeWorkNodeId: id.optional(),
  source: sourceSchema,
});
export type PlanningNode = z.infer<typeof planningSchema>;
export const artifactRole = z.enum([
  "STRATEGY",
  "RESEARCH",
  "INITIATIVE_CHARTER",
  "PRD",
  "DESIGN_DECISION",
  "DELIVERY_PLAN",
  "READINESS",
  "LAUNCH",
  "RUNBOOK",
  "OUTCOME_REVIEW",
  "RETROSPECTIVE",
  "RETIREMENT_PLAN",
]);
export const artifactSchema = z.strictObject({
  id,
  projectId: externalId,
  phase: phaseSchema,
  artifactRole,
  ownerAccountId: id,
  pageId: externalId,
  spaceId: externalId,
  title: shortText,
  source: sourceSchema,
});
export type LifecycleArtifact = z.infer<typeof artifactSchema>;
export const requirementSchema = z.strictObject({
  id,
  version: z.number().int().positive(),
  artifactId: id,
  sourceRevision: id,
  sectionReference: shortText,
  contentFingerprint: digest,
  mappingState: z.enum(["CONFIRMED", "AMBIGUOUS", "STALE"]),
  description: shortText,
  ownerAccountId: id,
  acceptanceConditionIds: ids,
  confirmedWorkIds: ids,
});
export type RequirementRecord = z.infer<typeof requirementSchema>;
export const conditionSchema = z
  .strictObject({
    id,
    version: z.number().int().positive(),
    description: longText,
    predicate: z.enum([
      "QUALIFYING_RELEASE",
      "DESIGNATED_HUMAN_ACCEPTANCE",
      "EXACT_SOURCE_STATE",
      "EXPLICIT_EVIDENCE",
    ]),
    required: z.boolean(),
    sourceIds: ids,
    designatedVerifierAccountId: id.optional(),
    expectedState: z
      .strictObject({
        field: z.enum(["statusId", "targetDate"]),
        value: shortText,
      })
      .optional(),
  })
  .superRefine((c, ctx) => {
    if (
      c.predicate === "EXACT_SOURCE_STATE" &&
      (!c.expectedState || c.sourceIds.length === 0)
    )
      ctx.addIssue({
        code: "custom",
        message: "Name the exact source and state.",
      });
    if (
      ["DESIGNATED_HUMAN_ACCEPTANCE", "EXPLICIT_EVIDENCE"].includes(
        c.predicate,
      ) &&
      !c.designatedVerifierAccountId
    )
      ctx.addIssue({
        code: "custom",
        message: "Name the designated verifier.",
      });
    if (c.predicate === "QUALIFYING_RELEASE" && c.sourceIds.length === 0)
      ctx.addIssue({
        code: "custom",
        message: "Name the agreed Jira release version.",
      });
  });
export type AcceptanceCondition = z.infer<typeof conditionSchema>;
export const bindingSchema = z.strictObject({
  id,
  scopeType: z.enum([
    "PROJECT",
    "COMMITMENT",
    "TEAM",
    "PRODUCT",
    "INITIATIVE",
    "ARTIFACT",
    "GATE",
  ]),
  scopeId: id,
  accountId: id,
  role: z.enum([
    "ACCOUNTABLE_OWNER",
    "DELIVERY_OWNER",
    "CONTRIBUTOR",
    "APPROVER",
    "OBSERVER",
    "SCRUM_FACILITATOR",
    "PRODUCT_OWNER",
    "RELEASE_OWNER",
    "VERIFIER",
  ]),
  confirmedByAccountId: id,
  validFrom: instant,
  validUntil: instant.optional(),
  provenance: z.enum([
    "EXPLICIT_ADMIN",
    "OWNER_ACCEPTANCE",
    "CONFIRMED_TEAM_MAPPING",
  ]),
});
export type StakeholderBinding = z.infer<typeof bindingSchema>;
export const basisSchema = z.strictObject({
  entityKind,
  entityId: id,
  revision: id,
});
export const gateSchema = z.strictObject({
  id,
  version: z.number().int().positive(),
  projectId: externalId,
  title: shortText,
  phase: phaseSchema,
  ownerAccountId: id,
  requiredArtifactIds: ids,
  requiredRequirementIds: ids,
  conditions: z.array(conditionSchema).min(1).max(30),
  reviewerBindingIds: ids.min(1),
  basis: z.array(basisSchema).min(1).max(200),
  reviews: z
    .array(
      z.strictObject({
        id,
        reviewerAccountId: id,
        bindingId: id,
        basisHash: digest,
        disposition: z.enum(["ACCEPT", "HOLD", "NOT_APPLICABLE"]),
        note: longText,
        at: instant,
      }),
    )
    .max(200),
});
export type LifecycleGate = z.infer<typeof gateSchema>;

const agreementFields = {
  title: shortText,
  outcome: longText,
  beneficiary: z.strictObject({
    kind: z.enum(["INTERNAL_TEAM", "CUSTOMER"]),
    reference: shortText,
  }),
  projectIds: z.array(externalId).min(1).max(5),
  accountableOwnerAccountId: id,
  agreedDueAt: instant,
  timeZone,
  acceptance: z.array(conditionSchema).min(1).max(30),
  supportingWorkIds: ids,
  planningNodeIds: ids,
  requirementIds: ids,
  requiredGateIds: ids,
  phase: phaseSchema,
};
export const agreementSchema = z
  .strictObject(agreementFields)
  .superRefine((a, ctx) => {
    if (!a.acceptance.some((c) => c.required))
      ctx.addIssue({
        code: "custom",
        message: "At least one acceptance condition must be required.",
      });
    if (new Set(a.acceptance.map((c) => c.id)).size !== a.acceptance.length)
      ctx.addIssue({
        code: "custom",
        message: "Acceptance identifiers must be unique.",
      });
  });
export const draftSchema = z
  .strictObject(agreementFields)
  .partial()
  .extend({ title: shortText, projectIds: z.array(externalId).min(1).max(5) });
export type CommitmentDraft = z.infer<typeof draftSchema>;
export const commitmentSchema = z.strictObject({
  ...agreementFields,
  id,
  version: z.number().int().positive(),
  installationId: id,
  cloudId: z.uuid(),
  originalDueAt: instant,
  ownerAcceptedAt: instant,
  lifecycle: z.enum(["ACTIVE", "FULFILLED", "CANCELLED", "SUPERSEDED"]),
  stakeholderBindingIds: ids,
  sourceReferences: z.array(sourceSchema).max(100),
  supersedesVersion: z.number().int().positive().optional(),
  sourceBasis: z.array(basisSchema).max(200).default([]),
});
export type CommitmentVersion = z.infer<typeof commitmentSchema>;
export const effectSchema = z.strictObject({
  kind: z.literal("SET_JIRA_DUE_DATE"),
  cloudId: z.uuid(),
  issueId: externalId,
  expectedUpdatedAt: instant,
  expectedDueDate: dateOnly.nullable(),
  desiredDueDate: dateOnly,
});
export type JiraDueDateEffect = z.infer<typeof effectSchema>;
export const proposalSchema = z.strictObject({
  id,
  commitmentId: id,
  commitmentVersion: z.number().int().positive(),
  createdByAccountId: id,
  createdAt: instant,
  expiresAt: instant,
  effect: effectSchema,
  evidenceSourceIds: ids,
  basis: z.array(basisSchema).max(200),
  intentHash: digest,
  canonicalizationVersion: z.literal("promisory.canonical-json.v1"),
  alternative: z.enum(["REPAIR", "REDUCE_SCOPE", "RENEGOTIATE"]),
  effectOrigin: z
    .enum(["USER_AUTHORED", "ATLASSIAN_ONLY"])
    .default("ATLASSIAN_ONLY"),
});
export type RecoveryProposal = z.infer<typeof proposalSchema>;
export const reviewSchema = z.strictObject({
  id,
  proposalId: id,
  proposalIntentHash: digest,
  reviewerAccountId: id,
  roleBindingId: id,
  disposition: z.enum(["APPROVE", "REJECT", "HOLD"]),
  recordedAt: instant,
  note: z.string().trim().max(2000),
});
export type ReviewRecord = z.infer<typeof reviewSchema>;
export const operationSchema = z.strictObject({
  id,
  context: trustedContextSchema,
  proposalId: id,
  intentHash: digest,
  idempotencyKey: id,
  stage: z.enum([
    "PREPARED",
    "EVALUATED",
    "AWAITING_REVIEW",
    "HELD",
    "BLOCKED",
    "AUTHORIZED",
    "EXECUTING",
    "SUCCEEDED",
    "FAILED",
    "RECONCILING",
  ]),
  authorityMode: z.enum(["UNKNOWN", "SHADOW", "ENFORCEMENT"]),
  message: longText,
  updatedAt: instant,
  leaseUntil: instant.optional(),
  evaluationReference: id.optional(),
  grantReference: id.optional(),
  externalReceiptReference: id.optional(),
  lastObservedResult: z
    .enum(["MATCHED_EFFECT", "NO_EFFECT", "CONFLICT", "UNKNOWN"])
    .optional(),
  finalization: z.enum(["NOT_REQUIRED", "RECORDED", "PENDING"]),
});
export type ActionOperation = z.infer<typeof operationSchema>;
export const observationSchema = z.strictObject({
  conditionId: id,
  result: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  evidenceSourceIds: ids,
  explanation: longText,
});
export type ConditionResult = z.infer<typeof observationSchema>;
export const outcomeSchema = z.strictObject({
  id,
  commitmentId: id,
  commitmentVersion: z.number().int().positive(),
  conditionResults: z.array(observationSchema).min(1).max(30),
  verifierAccountId: id,
  verifiedAt: instant,
  status: z.enum(["VERIFIED", "PENDING", "REGRESSED"]),
  timeliness: z.enum(["ON_TIME", "LATE"]),
  regressionOfOutcomeId: id.optional(),
  attestations: z
    .array(
      z.strictObject({
        conditionId: id,
        conditionVersion: z.number().int().positive(),
        verifierAccountId: id,
        recordedAt: instant,
        disposition: z.enum(["ACCEPT", "REVOKE"]),
        evidenceNote: longText,
      }),
    )
    .max(30)
    .default([]),
});
export type OutcomeRecord = z.infer<typeof outcomeSchema>;
export const historySchema = z.strictObject({
  id,
  kind: id,
  actorAccountId: id,
  at: instant,
  version: z.number().int().nonnegative(),
  summary: longText,
});
export const commitmentRecordSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  draft: draftSchema.optional(),
  versions: z.array(commitmentSchema).max(200),
  proposals: z.array(proposalSchema).max(200),
  reviews: z.array(reviewSchema).max(1000),
  operations: z.array(operationSchema).max(200),
  outcomes: z.array(outcomeSchema).max(1000),
  history: z.array(historySchema).max(2000),
  pendingOwner: z
    .strictObject({ accountId: id, proposedBy: id, at: instant })
    .optional(),
});
export type CommitmentRecord = z.infer<typeof commitmentRecordSchema>;
export const projectRecordSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: externalId,
  planning: z.array(planningSchema).max(200),
  artifacts: z.array(artifactSchema).max(200),
  requirements: z.array(requirementSchema).max(500),
  gates: z.array(gateSchema).max(50),
  bindings: z.array(bindingSchema).max(500),
  edges: z.array(edgeSchema).max(2000),
  requirementHistory: z.array(requirementSchema).max(500).default([]),
  gateHistory: z.array(gateSchema).max(200).default([]),
});
export type ProjectRecord = z.infer<typeof projectRecordSchema>;
export const configSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  selectedProjectIds: z.array(externalId).max(5),
  confluenceConnected: z.boolean(),
  enabled: z.boolean(),
  retentionDays: z.number().int().min(7).max(365),
  confirmedByAccountId: id,
});
export type InstallationConfig = z.infer<typeof configSchema>;
export type DeliveryHealth =
  "ON_TRACK" | "WATCH" | "AT_RISK" | "BREACHED" | "UNKNOWN";
export type Coverage = "COMPLETE" | "INCOMPLETE" | "UNKNOWN";
export interface ImpactPath {
  id: string;
  nodeIds: string[];
  edgeIds: string[];
}
export interface ImpactReason {
  code: string;
  explanation: string;
  evidenceSourceIds: string[];
  pathIds: string[];
}
export interface ImpactAssessment {
  commitmentId: string;
  commitmentVersion: number;
  ruleVersion: string;
  assessedAt: string;
  health: DeliveryHealth;
  coverage: Coverage;
  reasons: ImpactReason[];
  paths: ImpactPath[];
  traversalTruncated: boolean;
  cycles: string[][];
}
export const capabilitySchema = z.strictObject({
  key: shortText,
  state: z.enum(["AVAILABLE", "UNAVAILABLE", "UNVERIFIED", "ASSESSMENT_ONLY"]),
  detail: longText,
});
export type Capability = z.infer<typeof capabilitySchema>;

const entityCommand = {
  commitmentId: id,
  expectedRevision: z.number().int().nonnegative(),
};
export const commands = {
  "workspace.read": z.strictObject({ projectId: externalId.optional() }),
  "connections.check": z.strictObject({}),
  "settings.configure": z.strictObject({
    expectedRevision: z.number().int().nonnegative(),
    projectIds: z.array(externalId).min(1).max(5),
    confluenceConnected: z.boolean(),
  }),
  "settings.disconnect": z.strictObject({
    expectedRevision: z.number().int().positive(),
  }),
  "people.find": z.strictObject({
    projectId: externalId,
    query: z.string().trim().min(2).max(100),
  }),
  "roles.bind": z.strictObject({
    projectId: externalId,
    expectedRevision: z.number().int().nonnegative(),
    accountId: id,
    role: bindingSchema.shape.role,
    scopeType: bindingSchema.shape.scopeType,
    scopeId: id,
  }),
  "commitment.createDraft": draftSchema,
  "commitment.confirm": z.strictObject(entityCommand),
  "commitment.proposeRevision": z.strictObject({
    ...entityCommand,
    draft: draftSchema,
  }),
  "commitment.transferOwner": z.strictObject({
    ...entityCommand,
    incomingOwnerAccountId: id,
  }),
  "commitment.acceptOwner": z.strictObject(entityCommand),
  "planning.create": z.strictObject({
    projectId: externalId,
    expectedRevision: z.number().int().nonnegative(),
    kind: planningSchema.shape.kind,
    title: shortText,
    ownerAccountId: id,
    nativeWorkNodeId: id.optional(),
  }),
  "lifecycle.mapArtifact": z.strictObject({
    projectId: externalId,
    expectedRevision: z.number().int().nonnegative(),
    pageId: externalId,
    expectedSourceRevision: id,
    artifactRole,
    phase: phaseSchema,
    ownerAccountId: id,
  }),
  "requirement.linkWork": z.strictObject({
    projectId: externalId,
    expectedRevision: z.number().int().nonnegative(),
    requirementId: id.optional(),
    artifactId: id,
    expectedSourceRevision: id,
    sectionReference: shortText,
    description: shortText,
    workIds: ids.min(1),
    acceptanceConditionIds: ids,
  }),
  "lifecycle.createGate": z.strictObject({
    projectId: externalId,
    expectedRevision: z.number().int().nonnegative(),
    gateId: id.optional(),
    title: shortText,
    artifactIds: ids.min(1),
    requirementIds: ids,
    conditions: z.array(conditionSchema).min(1).max(30),
    reviewerBindingIds: ids.min(1),
  }),
  "lifecycle.assessReadiness": z.strictObject({
    projectId: externalId,
    gateId: id,
  }),
  "lifecycle.reviewGate": z.strictObject({
    projectId: externalId,
    expectedRevision: z.number().int().positive(),
    gateId: id,
    basisHash: digest,
    disposition: z.enum(["ACCEPT", "HOLD", "NOT_APPLICABLE"]),
    note: longText,
  }),
  "impact.trace": z.strictObject({
    projectId: externalId,
    workId: id.optional(),
    commitmentId: id.optional(),
  }),
  "evidence.refresh": z.strictObject({ projectId: externalId }),
  "proposal.prepare": z.strictObject({
    ...entityCommand,
    issueId: externalId,
    desiredDueDate: dateOnly,
    alternative: proposalSchema.shape.alternative,
  }),
  "review.record": z.strictObject({
    ...entityCommand,
    proposalId: id,
    intentHash: digest,
    disposition: reviewSchema.shape.disposition,
    note: z.string().trim().max(2000),
  }),
  "action.apply": z.strictObject({
    ...entityCommand,
    proposalId: id,
    idempotencyKey: id,
  }),
  "action.reconcile": z.strictObject({ commitmentId: id, operationId: id }),
  "outcome.verify": z.strictObject({
    ...entityCommand,
    attestedConditionIds: ids,
    revokedConditionIds: ids.default([]),
    evidenceNote: z.string().trim().max(4000),
  }),
  "inbox.read": z.strictObject({ projectId: externalId }),
  "inbox.markRead": z.strictObject({ notificationId: id }),
  "inbox.preferences": z.strictObject({
    quietStart: z.number().int().min(0).max(23),
    quietEnd: z.number().int().min(0).max(23),
    timeZone,
  }),
} as const;
export type CommandName = keyof typeof commands;
export type CommandInput<K extends CommandName> = z.infer<(typeof commands)[K]>;
export function parseCommand<K extends CommandName>(
  name: K,
  input: unknown,
): CommandInput<K> {
  // Bound envelopes before the runtime schema visits nested collections.
  const encoded = JSON.stringify(input);
  if (!encoded || new TextEncoder().encode(encoded).length > 64_000)
    throw new Error("Command exceeds the 64 KB input limit.");
  return commands[name].parse(input) as CommandInput<K>;
}

/** A local date must include a cutoff and zone. Reject DST gaps and overlaps instead of guessing. */
export function deadlineFromLocal(
  date: string,
  cutoff: string,
  zone: string,
): string {
  dateOnly.parse(date);
  timeZone.parse(zone);
  z.string()
    .regex(/^\d{2}:\d{2}$/)
    .parse(cutoff);
  return Temporal.PlainDateTime.from(`${date}T${cutoff}`)
    .toZonedDateTime(zone, { disambiguation: "reject" })
    .toInstant()
    .toString();
}
