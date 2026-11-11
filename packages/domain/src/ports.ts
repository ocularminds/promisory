import type {
  Capability,
  Coverage,
  JiraDueDateEffect,
  RecoveryProposal,
  SourceReference,
  TrustedContext,
  WorkEdge,
  WorkNode,
} from "@promisory/contracts";

export interface Project {
  id: string;
  key: string;
  name: string;
}
export interface Person {
  accountId: string;
  displayName: string;
  active: boolean;
}
export interface SourcePage {
  id: string;
  spaceId: string;
  title: string;
  revision: string;
  body: string;
  source: SourceReference;
}
export interface WorkSnapshot {
  work: WorkNode[];
  edges: WorkEdge[];
  coverage: Coverage;
  unknowns: string[];
  workTypes: Array<{ id: string; name: string; hierarchyLevel: number }>;
}
export interface GraphContext {
  items: Array<{ id: string; title: string; status?: string }>;
  coverage: Coverage;
  unknowns: string[];
  sources: SourceReference[];
}
export interface SourcePort {
  projects(): Promise<Project[]>;
  project(projectId: string): Promise<Project>;
  people(projectId: string, query: string): Promise<Person[]>;
  person(accountId: string, projectId: string): Promise<Person>;
  isAdmin(projectId?: string): Promise<boolean>;
  canEdit(issueId: string): Promise<boolean>;
  importWork(projectId: string): Promise<WorkSnapshot>;
  work(issueId: string): Promise<WorkNode>;
  page(pageId: string): Promise<SourcePage>;
  release(
    versionId: string,
  ): Promise<{ released: boolean; projectId: string; source: SourceReference }>;
  graph(): Promise<GraphContext>;
  capabilities(): Promise<Capability[]>;
}
export interface ExecutionResult {
  stage: "HELD" | "BLOCKED" | "SUCCEEDED" | "FAILED" | "RECONCILING";
  mode: "UNKNOWN" | "SHADOW" | "ENFORCEMENT";
  message: string;
  evaluationReference?: string;
  grantReference?: string;
  externalReceiptReference?: string;
  observed?: "MATCHED_EFFECT" | "NO_EFFECT" | "CONFLICT" | "UNKNOWN";
  finalization: "NOT_REQUIRED" | "RECORDED" | "PENDING";
}
export interface ExecutorPort {
  capability(): Capability;
  checkConnection(context: TrustedContext): Promise<Capability>;
  execute(request: {
    context: TrustedContext;
    proposal: RecoveryProposal;
    operationId: string;
    idempotencyKey: string;
  }): Promise<ExecutionResult>;
  reconcile(request: {
    context: TrustedContext;
    operationId: string;
    effect: JiraDueDateEffect;
  }): Promise<ExecutionResult>;
}
export class UnconfiguredExecutor implements ExecutorPort {
  capability(): Capability {
    return {
      key: "Governed execution",
      state: "UNAVAILABLE",
      detail:
        "An enforcement-capable AgentSafe connection and authenticated remote installation binding are required.",
    };
  }
  async checkConnection(): Promise<Capability> {
    return this.capability();
  }
  async execute(): Promise<ExecutionResult> {
    return {
      stage: "HELD",
      mode: "UNKNOWN",
      message:
        "Authorization unavailable. Configure and verify the remote execution boundary before applying this change.",
      finalization: "NOT_REQUIRED",
    };
  }
  async reconcile(): Promise<ExecutionResult> {
    return {
      stage: "RECONCILING",
      mode: "UNKNOWN",
      message:
        "A fresh authorized invocation and the executor receipt are required to resolve this attempt.",
      observed: "UNKNOWN",
      finalization: "PENDING",
    };
  }
}
