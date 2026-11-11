/**
 * Proposed Promisory v1 contracts. Not an existing vendor SDK.
 * Add runtime validation and repository codecs during implementation.
 * Strings documented as dates/IDs require validation at every boundary.
 */
export type CommitmentLifecycle =
  | "DRAFT" | "PROPOSED" | "ACTIVE" | "FULFILLED" | "CANCELLED" | "SUPERSEDED";
export type DeliveryHealth = "ON_TRACK" | "WATCH" | "AT_RISK" | "BREACHED" | "UNKNOWN";
export type Coverage = "COMPLETE" | "INCOMPLETE" | "UNKNOWN";
export type ActionStage =
  | "PREPARED" | "EVALUATED" | "AWAITING_REVIEW" | "HELD" | "BLOCKED"
  | "AUTHORIZED" | "EXECUTING" | "SUCCEEDED" | "FAILED" | "RECONCILING";
export type DataLineage =
  | "ATLASSIAN_ONLY" | "INDEPENDENT_INTENT" | "PERMITTED_REST_EVIDENCE";
export type ProductPhase =
  | "STRATEGY" | "DISCOVERY" | "INITIATIVE" | "DEFINITION" | "PLANNING"
  | "DELIVERY" | "VALIDATION" | "RELEASE" | "OPERATE_LEARN" | "EVOLVE_RETIRE";
export type GateReadiness =
  | "UNKNOWN" | "NOT_READY" | "READY_FOR_REVIEW" | "ACCEPTED"
  | "HELD" | "SUPERSEDED" | "NOT_APPLICABLE";
export type TraceEntityKind =
  | "WORK" | "PLANNING" | "ARTIFACT" | "REQUIREMENT"
  | "COMMITMENT" | "EVIDENCE" | "GATE" | "PROJECT"
  | "TEAM" | "PERSON" | "OUTCOME" | "SCHEDULE";

export interface TrustedContext {
  appId: string;
  environmentId: string;
  installationId: string;
  cloudId: string;
  principalAccountId: string;
}
export interface SourceReference {
  source: "JIRA" | "CONFLUENCE" | "TEAMWORK_GRAPH" | "USER_ATTESTATION" | "EXTERNAL";
  sourceId: string;
  sourceRevision: string;
  observedAt: string;
  checkedAt: string;
  lineage: DataLineage;
  visibility: "CURRENT_USER" | "EXPLICITLY_SHARED";
  verification: "UNVERIFIED" | "VERIFIED" | "REJECTED" | "STALE" | "UNAVAILABLE";
  url?: string; // Recheck authorization before resolving or displaying.
}
export interface WorkNode {
  id: string;
  cloudId: string;
  externalId: string;
  projectId: string;
  displayKey: string;
  type: "EPIC" | "STORY" | "TASK" | "BUG" | "SUBTASK" | "CUSTOM";
  nativeTypeId: string;
  nativeTypeName: string; // Above-epic custom types retain the tenant's names.
  hierarchyLevel: number;
  parentId?: string;
  title: string;
  statusName: string;
  resolved: boolean;
  assigneeAccountId?: string;
  targetDate?: string; // Jira local calendar date YYYY-MM-DD.
  source: SourceReference;
}
export interface WorkEdge {
  id: string;
  fromId: string;
  toId: string;
  fromKind: TraceEntityKind;
  toKind: TraceEntityKind;
  kind:
    | "CONTAINS" | "PARENT_OF" | "BLOCKS" | "SUPPORTS" | "OWNS" | "VERIFIES"
    | "ALIGNS_TO" | "DEFINES" | "IMPLEMENTS" | "SCHEDULED_FOR"
    | "MEASURED_BY" | "INFORMS";
  // Runtime rule: native PARENT_OF connects only WORK nodes using actual Jira metadata.
  state: "DISCOVERED" | "CONFIRMED";
  provenance: SourceReference;
}
export interface PlanningNode {
  id: string;
  installationId: string;
  cloudId: string;
  kind:
    | "VISION" | "OBJECTIVE" | "KEY_RESULT" | "THEME" | "PORTFOLIO"
    | "PROGRAM" | "PRODUCT" | "INITIATIVE" | "IDEA" | "RELEASE";
  title: string;
  ownerAccountId: string;
  nativeWorkNodeId?: string; // A binding, never a second work item for rollup counts.
  source: SourceReference;
}
export interface LifecycleArtifact {
  id: string;
  phase: ProductPhase;
  artifactRole:
    | "STRATEGY" | "RESEARCH" | "INITIATIVE_CHARTER" | "PRD" | "DESIGN_DECISION"
    | "DELIVERY_PLAN" | "READINESS" | "LAUNCH" | "RUNBOOK"
    | "OUTCOME_REVIEW" | "RETROSPECTIVE" | "RETIREMENT_PLAN";
  ownerAccountId: string;
  source: SourceReference;
  reviewState: "DRAFT" | "IN_REVIEW" | "ACCEPTED" | "SUPERSEDED";
  // Promisory review state; not an assertion of a native Confluence approval engine.
  reviewedSourceRevision?: string;
  reviewerBindingId?: string;
}
export interface RequirementRecord {
  id: string;
  version: number;
  artifactId: string;
  sourceRevision: string;
  sectionReference: string;
  contentFingerprint: string;
  mappingState: "CONFIRMED" | "AMBIGUOUS" | "STALE";
  description: string;
  ownerAccountId: string;
  acceptanceConditionIds: string[];
  confirmedWorkIds: string[];
}
export interface LifecycleGate {
  id: string;
  version: number;
  phase: ProductPhase;
  ownerAccountId: string;
  requiredArtifactIds: string[];
  requiredRequirementIds: string[];
  acceptanceConditionIds: string[];
  reviewerBindingIds: string[];
  basis: Array<{ entityKind: TraceEntityKind; entityId: string; revision: string; }>;
  readiness: GateReadiness;
  applicability: "CURRENT" | "STALE" | "UNKNOWN";
  dispositionReason?: string; // Required for HELD / NOT_APPLICABLE.
  // Gate acceptance neither grants execution permission nor verifies adoption.
}
export interface AcceptanceCondition {
  id: string;
  version: number;
  description: string;
  predicate:
    | "QUALIFYING_RELEASE" | "DESIGNATED_HUMAN_ACCEPTANCE"
    | "EXACT_SOURCE_STATE" | "EXPLICIT_EVIDENCE";
  required: boolean;
  sourceIds: string[];
  designatedVerifierAccountId?: string;
}
export interface StakeholderBinding {
  id: string;
  scopeType: "PROJECT" | "COMMITMENT" | "TEAM" | "PRODUCT" | "INITIATIVE" | "ARTIFACT" | "GATE";
  scopeId: string;
  accountId?: string;
  teamId?: string;
  role:
    | "ACCOUNTABLE_OWNER" | "DELIVERY_OWNER" | "CONTRIBUTOR"
    | "APPROVER" | "OBSERVER" | "SCRUM_FACILITATOR" | "PRODUCT_OWNER"
    | "RELEASE_OWNER" | "VERIFIER";
  confirmedByAccountId: string;
  validFrom: string;
  validUntil?: string;
  provenance: "EXPLICIT_ADMIN" | "OWNER_ACCEPTANCE" | "CONFIRMED_TEAM_MAPPING";
}
export interface CommitmentVersion {
  id: string;
  version: number;
  installationId: string;
  cloudId: string;
  title: string;
  outcome: string;
  beneficiary: { kind: "INTERNAL_TEAM" | "CUSTOMER"; reference: string; };
  projectIds: string[];
  accountableOwnerAccountId: string;
  ownerAcceptedAt?: string;
  originalDueAt: string;
  agreedDueAt: string;
  timeZone: string;
  lifecycle: CommitmentLifecycle;
  acceptance: AcceptanceCondition[];
  supportingWorkIds: string[];
  planningNodeIds: string[];
  requirementIds: string[];
  requiredGateIds: string[];
  phase: ProductPhase;
  stakeholderBindingIds: string[];
  sourceReferences: SourceReference[];
  supersedesVersion?: number;
}
export interface ImpactReason {
  code:
    | "DEADLINE_PASSED" | "BLOCKING_DEFECT" | "DELIVERY_AFTER_PROMISE"
    | "UNACCEPTED_OWNER" | "STALE_EVIDENCE" | "INCOMPLETE_SCOPE" | "DUE_SOON"
    | "REQUIREMENT_CHANGED" | "GATE_NOT_READY" | "OUTCOME_UNMEASURED";
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
  coverage: Coverage; // Can be incomplete even when health is a known AT_RISK/BREACHED.
  reasons: ImpactReason[];
  paths: Array<{ id: string; nodeIds: string[]; edgeIds: string[]; }>;
  traversalTruncated: boolean;
}
export interface JiraDueDateEffect {
  kind: "SET_JIRA_DUE_DATE";
  cloudId: string;
  issueId: string;
  expectedUpdatedAt: string;
  expectedDueDate: string | null;
  desiredDueDate: string;
}
export interface RecoveryProposal {
  id: string;
  commitmentId: string;
  commitmentVersion: number;
  createdByAccountId: string;
  createdAt: string;
  expiresAt: string;
  effect: JiraDueDateEffect;
  evidenceSourceIds: string[];
  intentHash: string;
  canonicalizationVersion: string;
}
export interface ReviewRecord {
  id: string;
  proposalId: string;
  proposalIntentHash: string;
  reviewerAccountId: string;
  roleBindingId: string;
  disposition: "APPROVE" | "REJECT" | "HOLD";
  recordedAt: string;
  note?: string;
}
export interface ActionOperation {
  id: string;
  context: TrustedContext;
  proposalId: string;
  intentHash: string;
  idempotencyKey: string;
  stage: ActionStage;
  authorityMode: "UNKNOWN" | "SHADOW" | "ENFORCEMENT";
  evaluationReference?: string;
  grantReference?: string; // Opaque reference only; do not expose credentials.
  dossierReference?: string;
  externalReceiptReference?: string;
  lastObservedResult?: "MATCHED_EFFECT" | "NO_EFFECT" | "CONFLICT" | "UNKNOWN";
  updatedAt: string;
}
export interface OutcomeRecord {
  id: string;
  commitmentId: string;
  commitmentVersion: number;
  conditionResults: Array<{
    conditionId: string;
    result: "PASS" | "FAIL" | "UNKNOWN";
    evidenceSourceIds: string[];
  }>;
  verifierAccountId?: string;
  verifiedAt: string;
  timeliness: "ON_TIME" | "LATE";
  regressionOfOutcomeId?: string;
}
export interface RovoToolResult<T> {
  schemaVersion: "promisory.v1";
  result: T;
  coverage: Coverage;
  sourceReferences: SourceReference[];
  unknowns: string[];
  nextActions: Array<{ label: string; command: string; targetId: string; }>;
}

