import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import {
  SCHEMA_VERSION,
  agreementSchema,
  commitmentRecordSchema,
  commitmentSchema,
  configSchema,
  draftSchema,
  parseCommand,
  projectRecordSchema,
  proposalSchema,
  sourceSchema,
  type ActionOperation,
  type CommandName,
  type CommitmentDraft,
  type CommitmentRecord,
  type CommitmentVersion,
  type AcceptanceCondition,
  type ImpactAssessment,
  type InstallationConfig,
  type LifecycleGate,
  type ProjectRecord,
  type RecoveryProposal,
  type TrustedContext,
} from "@promisory/contracts";
import {
  Repository,
  DomainError,
  ensure,
  hash,
  newId,
  nowIso,
  type Stored,
} from "./primitives";
import { assessImpact } from "./impact";
import {
  assessGate,
  bindingApplies,
  evaluateConditions,
  type GateAssessment,
} from "./lifecycle";
import type {
  ExecutorPort,
  GraphContext,
  Person,
  Project,
  SourcePort,
  WorkSnapshot,
} from "./ports";

export interface Workspace {
  mode: "LIVE" | "EXAMPLE";
  principal: string;
  now: string;
  project?: Project;
  projects: Project[];
  config?: Stored<InstallationConfig>;
  projectState?: Stored<ProjectRecord>;
  work: WorkSnapshot;
  graph: GraphContext;
  commitments: Array<Stored<CommitmentRecord>>;
  assessments: ImpactAssessment[];
  gates: GateAssessment[];
  people: Person[];
  capabilities: Awaited<ReturnType<SourcePort["capabilities"]>>;
  unknowns: string[];
  canAdmin: boolean;
  canConfigure: boolean;
  configurationProjects: Project[];
  installationBinding?: Pick<
    TrustedContext,
    "appId" | "environmentId" | "installationId" | "cloudId"
  >;
}
const emptyWork = (): WorkSnapshot => ({
  work: [],
  edges: [],
  coverage: "UNKNOWN",
  unknowns: [],
  workTypes: [],
});
const emptyGraph = (): GraphContext => ({
  items: [],
  coverage: "UNKNOWN",
  unknowns: ["Graph context has not been checked."],
  sources: [],
});
export function activeVersion(
  record: CommitmentRecord,
): CommitmentVersion | undefined {
  return record.versions.at(-1);
}
function emptyProject(id: string): ProjectRecord {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    planning: [],
    artifacts: [],
    requirements: [],
    gates: [],
    bindings: [],
    edges: [],
    requirementHistory: [],
    gateHistory: [],
  };
}
const inboxSchema = z.strictObject({
  seen: z.array(z.string()).max(2000),
  quietStart: z.number(),
  quietEnd: z.number(),
  timeZone: z.string(),
});

export class PromisoryService {
  constructor(
    readonly ctx: TrustedContext,
    readonly repo: Repository,
    readonly sources: SourcePort,
    readonly executor: ExecutorPort,
    readonly options: {
      mode: "LIVE" | "EXAMPLE";
      channel?: "UI" | "ROVO";
      clock?: () => string;
    } = { mode: "LIVE" },
  ) {}
  private get now() {
    return (this.options.clock ?? nowIso)();
  }
  async config() {
    return this.repo.get("config", "installation", configSchema);
  }
  private async requireEnabled() {
    const config = await this.config();
    ensure(
      config?.value.enabled,
      "NOT_CONFIGURED",
      "An administrator needs to select a project scope.",
    );
    return config;
  }
  private async requireProject(projectId: string) {
    const config = await this.requireEnabled();
    ensure(
      config.value.selectedProjectIds.includes(projectId),
      "SCOPE_DENIED",
      "This project is outside the configured app scope.",
    );
    return this.sources.project(projectId);
  }
  private async requireAdmin(projectId?: string) {
    ensure(
      await this.sources.isAdmin(projectId),
      "FORBIDDEN",
      "A current Jira administrator permission is required.",
    );
  }
  private async projectState(projectId: string) {
    await this.requireProject(projectId);
    return (
      (await this.repo.get("project", projectId, projectRecordSchema)) ?? {
        revision: 0,
        value: emptyProject(projectId),
      }
    );
  }
  private history(record: CommitmentRecord, kind: string, summary: string) {
    record.history.push({
      id: newId("history"),
      kind,
      actorAccountId: this.ctx.principalAccountId,
      at: this.now,
      version: activeVersion(record)?.version ?? 0,
      summary,
    });
  }
  private async assertAgreementAccess(draft: CommitmentDraft) {
    await Promise.all(draft.projectIds.map((p) => this.requireProject(p)));
    if (
      (draft.requirementIds?.length ?? 0) +
        (draft.requiredGateIds?.length ?? 0) >
      0
    )
      ensure(
        (await this.requireEnabled()).value.confluenceConnected,
        "SOURCE_DENIED",
        "Required Confluence context is disconnected.",
      );
    const states = (
      await Promise.all(draft.projectIds.map((p) => this.projectState(p)))
    ).map((s) => s.value);
    for (const id of draft.supportingWorkIds ?? []) {
      const work = await this.sources.work(id.split(":").at(-1)!);
      ensure(
        work.id === id && draft.projectIds.includes(work.projectId),
        "SOURCE_DENIED",
        "A linked work item is unavailable or outside this agreement.",
      );
    }
    for (const planningId of draft.planningNodeIds ?? []) {
      const node = states
        .flatMap((s) => s.planning)
        .find((p) => p.id === planningId);
      ensure(
        node,
        "SOURCE_DENIED",
        "Required planning context is unavailable.",
      );
      if (node.nativeWorkNodeId) {
        const work = await this.sources.work(
          node.nativeWorkNodeId.split(":").at(-1)!,
        );
        ensure(
          work.id === node.nativeWorkNodeId,
          "SOURCE_DENIED",
          "Planning context is unavailable.",
        );
      }
      if (node.source.source === "CONFLUENCE")
        await this.sources.page(node.source.sourceId);
    }
    for (const requirementId of draft.requirementIds ?? []) {
      const req = states
        .flatMap((s) => s.requirements)
        .find((r) => r.id === requirementId);
      ensure(req, "SOURCE_DENIED", "A required mapping is unavailable.");
      const artifact = states
        .flatMap((s) => s.artifacts)
        .find((a) => a.id === req.artifactId);
      ensure(artifact, "SOURCE_DENIED", "A required artifact is unavailable.");
      await this.sources.page(artifact.pageId);
      for (const workId of req.confirmedWorkIds) {
        const work = await this.sources.work(workId.split(":").at(-1)!);
        ensure(
          work.id === workId && draft.projectIds.includes(work.projectId),
          "SOURCE_DENIED",
          "Mapped work is unavailable.",
        );
      }
    }
    for (const gateId of draft.requiredGateIds ?? []) {
      const state = states.find((s) => s.gates.some((g) => g.id === gateId));
      const gate = state?.gates.find((g) => g.id === gateId);
      ensure(state && gate, "SOURCE_DENIED", "A required gate is unavailable.");
      await this.assertGateAccess(gate, state);
    }
    await this.assertConditionAccess(draft.acceptance ?? [], draft.projectIds);
  }
  private async assertConditionAccess(
    conditions: AcceptanceCondition[],
    projectIds: string[],
  ) {
    for (const condition of conditions)
      for (const sourceId of condition.sourceIds) {
        if (condition.predicate === "QUALIFYING_RELEASE") {
          const release = await this.sources.release(sourceId);
          ensure(
            projectIds.includes(release.projectId),
            "SOURCE_DENIED",
            "A release is outside the selected scope.",
          );
        } else if (sourceId.startsWith("confluence:")) {
          ensure(
            condition.predicate !== "EXACT_SOURCE_STATE",
            "SOURCE_DENIED",
            "This condition requires Jira work.",
          );
          await this.sources.page(sourceId.split(":").at(-1)!);
        } else {
          const work = await this.sources.work(sourceId.split(":").at(-1)!);
          ensure(
            work.id === sourceId && projectIds.includes(work.projectId),
            "SOURCE_DENIED",
            "An acceptance source is unavailable.",
          );
        }
      }
  }
  private async assertGateAccess(gate: LifecycleGate, state: ProjectRecord) {
    for (const artifactId of gate.requiredArtifactIds) {
      const artifact = state.artifacts.find((a) => a.id === artifactId);
      ensure(artifact, "SOURCE_DENIED", "A required source is unavailable.");
      await this.sources.page(artifact.pageId);
    }
    for (const requirementId of gate.requiredRequirementIds) {
      const requirement = state.requirements.find(
        (r) => r.id === requirementId,
      );
      ensure(
        requirement,
        "SOURCE_DENIED",
        "A required mapping is unavailable.",
      );
      const artifact = state.artifacts.find(
        (a) => a.id === requirement.artifactId,
      );
      ensure(artifact, "SOURCE_DENIED", "A required source is unavailable.");
      await this.sources.page(artifact.pageId);
      for (const id of requirement.confirmedWorkIds) {
        const work = await this.sources.work(id.split(":").at(-1)!);
        ensure(
          work.id === id && work.projectId === gate.projectId,
          "SOURCE_DENIED",
          "A mapped source is unavailable.",
        );
      }
    }
    await this.assertConditionAccess(gate.conditions, [gate.projectId]);
  }
  private async assertRecordAccess(record: CommitmentRecord) {
    // Returning an aggregate also returns its draft and history. Every version
    // is therefore checked against today's source permissions, not just HEAD.
    for (const agreement of [
      ...record.versions,
      ...(record.draft ? [record.draft] : []),
    ])
      await this.assertAgreementAccess(agreement);
    for (const version of record.versions)
      for (const source of version.sourceReferences) {
        if (source.source === "CONFLUENCE")
          await this.sources.page(source.sourceId);
        if (source.source === "JIRA") {
          const work = await this.sources.work(
            source.sourceId.split(":").at(-1)!,
          );
          ensure(
            work.id === source.sourceId &&
              version.projectIds.includes(work.projectId),
            "SOURCE_DENIED",
            "Historic source context is unavailable.",
          );
        }
        // Graph snapshots are deliberately never persisted in shared agreements.
        ensure(
          source.source !== "TEAMWORK_GRAPH",
          "SOURCE_DENIED",
          "A shared graph snapshot cannot establish current access.",
        );
      }
    for (const proposal of record.proposals) {
      const work = await this.sources.work(proposal.effect.issueId);
      ensure(
        work.cloudId === this.ctx.cloudId &&
          record.versions.some((v) => v.projectIds.includes(work.projectId)),
        "SOURCE_DENIED",
        "Historic proposal evidence is unavailable.",
      );
    }
  }
  private async record(id: string): Promise<Stored<CommitmentRecord>> {
    const stored = await this.repo.get(
      "commitment",
      id,
      commitmentRecordSchema,
    );
    ensure(
      stored,
      "NOT_FOUND",
      "This commitment is unavailable with your current access.",
    );
    const agreement = activeVersion(stored.value) ?? stored.value.draft;
    ensure(agreement, "NOT_FOUND", "No agreement is available.");
    try {
      await this.assertRecordAccess(stored.value);
    } catch {
      throw new DomainError(
        "NOT_FOUND",
        "This commitment is unavailable with your current access.",
      );
    }
    return stored;
  }
  private assertRevision(stored: Stored<unknown>, expected: number) {
    ensure(
      stored.revision === expected,
      "CONFLICT",
      "This record changed. Refresh before trying again.",
    );
  }
  private async saveProject(state: Stored<ProjectRecord>) {
    const saved = await this.repo.save(
      "project",
      state.value.id,
      state.revision,
      state.value,
      projectRecordSchema,
    );
    // A mutation receipt does not export unrelated project aggregates. Views
    // refresh through the same permission-filtered workspace query.
    return { revision: saved.revision, value: { id: saved.value.id } };
  }
  private async requireOwnerOrAdmin(record: CommitmentRecord) {
    const version = activeVersion(record);
    const owner =
      version?.accountableOwnerAccountId ??
      record.draft?.accountableOwnerAccountId;
    ensure(
      owner === this.ctx.principalAccountId ||
        (await this.sources.isAdmin(
          version?.projectIds[0] ?? record.draft?.projectIds[0],
        )),
      "FORBIDDEN",
      "Only the accountable owner or a scoped administrator can prepare or apply this change.",
    );
  }
  private async assertKnownMappings(agreement: CommitmentDraft) {
    const states = await Promise.all(
      agreement.projectIds.map((id) => this.projectState(id)),
    );
    ensure(
      (agreement.planningNodeIds ?? []).every((id) =>
        states.some((s) => s.value.planning.some((p) => p.id === id)),
      ),
      "INVALID_MAPPING",
      "Select existing planning context.",
    );
    ensure(
      (agreement.requirementIds ?? []).every((id) =>
        states.some((s) => s.value.requirements.some((r) => r.id === id)),
      ),
      "INVALID_MAPPING",
      "Select existing requirement mappings.",
    );
    ensure(
      (agreement.requiredGateIds ?? []).every((id) =>
        states.some((s) => s.value.gates.some((g) => g.id === id)),
      ),
      "INVALID_MAPPING",
      "Select existing readiness gates.",
    );
  }
  private async basisFor(
    agreement: Pick<
      CommitmentVersion,
      "projectIds" | "requirementIds" | "requiredGateIds"
    >,
  ) {
    const basis: RecoveryProposal["basis"] = [];
    for (const projectId of agreement.projectIds) {
      const state = (await this.projectState(projectId)).value;
      for (const req of state.requirements.filter((r) =>
        agreement.requirementIds.includes(r.id),
      )) {
        const artifact = state.artifacts.find((a) => a.id === req.artifactId)!;
        const page = await this.sources.page(artifact.pageId);
        ensure(
          req.mappingState === "CONFIRMED" &&
            req.sourceRevision === page.revision,
          "STALE_SOURCE",
          "A required document changed. Confirm its requirement mapping first.",
        );
        basis.push(
          {
            entityKind: "REQUIREMENT",
            entityId: req.id,
            revision: `${req.version}:${req.contentFingerprint}`,
          },
          {
            entityKind: "ARTIFACT",
            entityId: artifact.id,
            revision: page.revision,
          },
        );
      }
      for (const gate of state.gates.filter((g) =>
        agreement.requiredGateIds.includes(g.id),
      )) {
        const assessment = await assessGate(
          gate,
          state.artifacts,
          state.requirements,
          this.sources,
          this.ctx.principalAccountId,
          state.bindings,
          this.now,
        );
        ensure(
          assessment.applicability === "CURRENT",
          "STALE_SOURCE",
          "A required gate source changed or cannot be checked. Prepare current gate evidence first.",
        );
        basis.push({
          entityKind: "GATE",
          entityId: gate.id,
          revision: String(gate.version),
        });
        for (const required of gate.basis)
          if (!basis.some((b) => b.entityId === required.entityId))
            basis.push(required);
      }
    }
    return basis.sort((a, b) =>
      `${a.entityKind}:${a.entityId}`.localeCompare(
        `${b.entityKind}:${b.entityId}`,
      ),
    );
  }
  private async validateProposal(
    proposal: RecoveryProposal,
    agreement: CommitmentVersion,
  ) {
    ensure(
      proposal.commitmentVersion === agreement.version,
      "STALE_PROPOSAL",
      "The agreement changed after this proposal. Prepare a new proposal.",
    );
    ensure(
      Date.parse(proposal.expiresAt) > Date.parse(this.now),
      "EXPIRED",
      "This proposal expired. Prepare a new proposal.",
    );
    const work = await this.sources.work(proposal.effect.issueId);
    ensure(
      work.cloudId === this.ctx.cloudId &&
        agreement.supportingWorkIds.includes(work.id),
      "SOURCE_DENIED",
      "The target does not support this agreement.",
    );
    ensure(
      work.source.sourceRevision === proposal.effect.expectedUpdatedAt &&
        work.targetDate === proposal.effect.expectedDueDate,
      "STALE_SOURCE",
      "The Jira source changed after this review. Prepare a new proposal.",
    );
    const currentBasis = await this.basisFor(agreement);
    ensure(
      (await hash(currentBasis)) === (await hash(proposal.basis)),
      "STALE_SOURCE",
      "A required source or mapping changed after review.",
    );
    const { intentHash: ignored, ...digestMaterial } = proposal;
    void ignored;
    ensure(
      (await hash(digestMaterial)) === proposal.intentHash,
      "INTENT_MISMATCH",
      "The proposal does not match its immutable intent.",
    );
    return work;
  }
  async workspace(projectId?: string): Promise<Workspace> {
    const config = await this.config();
    const allProjects = await this.sources.projects();
    const projects = config?.value.enabled
      ? allProjects.filter((p) =>
          config.value.selectedProjectIds.includes(p.id),
        )
      : allProjects;
    const capabilities = [
      ...(await this.sources.capabilities()),
      this.executor.capability(),
    ];
    const canConfigure = await this.sources.isAdmin();
    const base: Workspace = {
      mode: this.options.mode,
      principal: this.ctx.principalAccountId,
      now: this.now,
      projects,
      config,
      work: emptyWork(),
      graph: emptyGraph(),
      commitments: [],
      assessments: [],
      gates: [],
      people: [],
      capabilities,
      unknowns: [],
      canAdmin: canConfigure,
      canConfigure,
      configurationProjects: canConfigure ? allProjects : [],
      ...(canConfigure && this.options.channel !== "ROVO"
        ? {
            installationBinding: {
              appId: this.ctx.appId,
              environmentId: this.ctx.environmentId,
              installationId: this.ctx.installationId,
              cloudId: this.ctx.cloudId,
            },
          }
        : {}),
    };
    if (!config?.value.enabled) {
      base.unknowns.push("Choose a project in Connections to begin.");
      return base;
    }
    const chosen = projectId ?? projects[0]?.id;
    if (!chosen) {
      base.unknowns.push("No configured projects are accessible to this user.");
      return base;
    }
    base.project = await this.requireProject(chosen);
    base.canAdmin = await this.sources.isAdmin(chosen);
    const [rawProject, work, graph, allRecords] = await Promise.all([
      this.projectState(chosen),
      this.sources.importWork(chosen).catch(() => ({
        ...emptyWork(),
        unknowns: [
          "Jira is unavailable. Dependent views and writes need a fresh connection.",
        ],
      })),
      this.sources.graph().catch(() => ({
        ...emptyGraph(),
        unknowns: [
          "Teamwork Graph is unavailable with this installation or user access.",
        ],
      })),
      this.repo.list("commitment", commitmentRecordSchema),
    ]);
    base.work = work;
    const scopedGraph = graph.items.filter((item) =>
      work.work.some(
        (w) =>
          item.id ===
          `ari:cloud:jira:${this.ctx.cloudId}:issue/${w.externalId}`,
      ),
    );
    base.graph = {
      ...graph,
      items: scopedGraph,
      sources: graph.sources.filter((s) =>
        scopedGraph.some((i) => i.id === s.sourceId),
      ),
      ...(scopedGraph.length !== graph.items.length
        ? {
            coverage: "INCOMPLETE" as const,
            unknowns: [
              ...graph.unknowns,
              "Assigned graph context outside the selected visible work scope was omitted.",
            ],
          }
        : {}),
    };
    base.unknowns.push(...work.unknowns, ...base.graph.unknowns);
    const state = structuredClone(rawProject.value);
    const visibleArtifacts = [];
    for (const artifact of config.value.confluenceConnected
      ? state.artifacts
      : []) {
      try {
        const page = await this.sources.page(artifact.pageId);
        visibleArtifacts.push({
          ...artifact,
          title: page.title,
          source: page.source,
        });
        for (const req of state.requirements.filter(
          (r) => r.artifactId === artifact.id,
        ))
          if (page.revision !== req.sourceRevision) req.mappingState = "STALE";
      } catch {
        base.unknowns.push(
          "Some Confluence context is unavailable with your current access.",
        );
      }
    }
    state.artifacts = visibleArtifacts;
    state.requirements = state.requirements.filter(
      (r) =>
        state.artifacts.some((a) => a.id === r.artifactId) &&
        r.confirmedWorkIds.every((id) => work.work.some((w) => w.id === id)),
    );
    state.requirementHistory = state.requirementHistory.filter(
      (r) =>
        state.artifacts.some((a) => a.id === r.artifactId) &&
        r.confirmedWorkIds.every((id) => work.work.some((w) => w.id === id)),
    );
    const visibleGates: LifecycleGate[] = [];
    for (const gate of state.gates) {
      try {
        await this.assertGateAccess(gate, state);
        visibleGates.push(gate);
      } catch {
        /* Never expose gate metadata derived from an inaccessible source. */
      }
    }
    state.gates = visibleGates;
    const gateHistory: LifecycleGate[] = [];
    for (const gate of state.gateHistory) {
      try {
        await this.assertGateAccess(gate, state);
        gateHistory.push(gate);
      } catch {
        /* Historical content has the same access boundary. */
      }
    }
    state.gateHistory = gateHistory;
    state.planning = state.planning.filter(
      (p) =>
        !p.nativeWorkNodeId ||
        work.work.some((w) => w.id === p.nativeWorkNodeId),
    );
    state.edges = state.edges.filter(
      (e) =>
        [
          ...work.work,
          ...state.planning,
          ...state.requirements,
          ...state.artifacts,
        ].some((x) => x.id === e.fromId) &&
        [
          ...work.work,
          ...state.planning,
          ...state.requirements,
          ...state.artifacts,
        ].some((x) => x.id === e.toId),
    );
    base.projectState = { ...rawProject, value: state };
    for (const stored of allRecords) {
      const agreement = activeVersion(stored.value) ?? stored.value.draft;
      if (!agreement?.projectIds.includes(chosen)) continue;
      try {
        await this.assertRecordAccess(stored.value);
        if (
          (agreement.requirementIds ?? []).some(
            (id) => !state.requirements.some((r) => r.id === id),
          ) ||
          (agreement.requiredGateIds ?? []).some(
            (id) => !state.gates.some((g) => g.id === id),
          )
        )
          continue;
        base.commitments.push(stored);
      } catch {
        /* Omit restricted agreements and their counts. */
      }
    }
    state.bindings = state.bindings.filter(
      (b) =>
        (b.scopeType === "PROJECT" && b.scopeId === chosen) ||
        (b.scopeType === "COMMITMENT" &&
          base.commitments.some((c) => c.value.id === b.scopeId)) ||
        (b.scopeType === "GATE" && state.gates.some((g) => g.id === b.scopeId)),
    );
    base.gates = await Promise.all(
      state.gates.map((g) =>
        assessGate(
          g,
          state.artifacts,
          state.requirements,
          this.sources,
          this.ctx.principalAccountId,
          state.bindings,
          this.now,
        ),
      ),
    );
    const peopleIds = new Set([
      this.ctx.principalAccountId,
      ...work.work.flatMap((w) =>
        w.assigneeAccountId ? [w.assigneeAccountId] : [],
      ),
      ...base.commitments.flatMap((c) => [
        activeVersion(c.value)?.accountableOwnerAccountId ??
          c.value.draft?.accountableOwnerAccountId ??
          "",
      ]),
      ...state.bindings.map((b) => b.accountId),
    ]);
    for (const accountId of peopleIds)
      if (accountId) {
        try {
          base.people.push(await this.sources.person(accountId, chosen));
        } catch {
          /* Do not disclose unavailable profiles. */
        }
      }
    base.assessments = base.commitments.flatMap((record) => {
      const c = activeVersion(record.value);
      if (!c) return [];
      const lastOutcome = record.value.outcomes
        .filter((o) => o.commitmentVersion === c.version)
        .at(-1);
      return [
        assessImpact({
          commitment: c,
          work: work.work,
          edges: [...work.edges, ...state.edges],
          coverage: work.coverage,
          now: this.now,
          requirementDrift: c.requirementIds.some(
            (id) =>
              state.requirements.find((r) => r.id === id)?.mappingState !==
              "CONFIRMED",
          ),
          gateNotReady: base.gates.some(
            (g) =>
              c.requiredGateIds.includes(g.gateId) &&
              g.readiness === "NOT_READY",
          ),
          gateUnknown: c.requiredGateIds.some(
            (id) =>
              !base.gates.some(
                (g) =>
                  g.gateId === id &&
                  [
                    "ACCEPTED",
                    "READY_FOR_REVIEW",
                    "NOT_READY",
                    "NOT_APPLICABLE",
                  ].includes(g.readiness),
              ),
          ),
          outcomeVerified: lastOutcome?.status === "VERIFIED",
          ownerAvailable: base.people.some(
            (p) => p.accountId === c.accountableOwnerAccountId && p.active,
          ),
        }),
      ];
    });
    base.unknowns = [...new Set(base.unknowns)];
    return base;
  }

  async run(name: CommandName, raw: unknown): Promise<unknown> {
    switch (name) {
      case "workspace.read":
        return this.workspace(parseCommand(name, raw).projectId);
      case "connections.check":
        parseCommand(name, raw);
        return [
          ...(await this.sources.capabilities()),
          await this.executor.checkConnection(this.ctx),
        ];
      case "settings.configure": {
        const input = parseCommand(name, raw);
        await this.requireAdmin();
        await Promise.all(
          input.projectIds.map((id) => this.sources.project(id)),
        );
        const old = await this.config();
        ensure(
          (old?.revision ?? 0) === input.expectedRevision,
          "CONFLICT",
          "The configuration changed. Refresh before changing its scope.",
        );
        return this.repo.save(
          "config",
          "installation",
          old?.revision ?? 0,
          {
            schemaVersion: SCHEMA_VERSION,
            selectedProjectIds: input.projectIds,
            confluenceConnected: input.confluenceConnected,
            enabled: true,
            retentionDays: 180,
            confirmedByAccountId: this.ctx.principalAccountId,
          },
          configSchema,
        );
      }
      case "settings.disconnect": {
        const input = parseCommand(name, raw);
        await this.requireAdmin();
        const config = await this.requireEnabled();
        this.assertRevision(config, input.expectedRevision);
        // Disable first; reads and mutation entry points fail closed during cleanup.
        return this.repo.save(
          "config",
          "installation",
          config.revision,
          {
            ...config.value,
            enabled: false,
            selectedProjectIds: [],
            confluenceConnected: false,
          },
          configSchema,
        );
      }
      case "people.find": {
        const input = parseCommand(name, raw);
        await this.requireProject(input.projectId);
        return this.sources.people(input.projectId, input.query);
      }
      case "roles.bind": {
        const input = parseCommand(name, raw);
        const state = await this.projectState(input.projectId);
        this.assertRevision(state, input.expectedRevision);
        await this.requireAdmin(input.projectId);
        ensure(
          input.role !== "ACCOUNTABLE_OWNER",
          "OWNER_ACCEPTANCE_REQUIRED",
          "Accountable ownership is established only by accepting an agreement or owner transfer.",
        );
        ensure(
          ["PROJECT", "COMMITMENT", "GATE"].includes(input.scopeType),
          "UNSUPPORTED_SCOPE",
          "This release supports project, commitment, and gate review bindings.",
        );
        ensure(
          input.scopeType !== "PROJECT" || input.scopeId === input.projectId,
          "INVALID_SCOPE",
          "The project binding must name this project.",
        );
        if (input.scopeType === "COMMITMENT") {
          const c = await this.record(input.scopeId);
          ensure(
            (activeVersion(c.value) ?? c.value.draft)?.projectIds.includes(
              input.projectId,
            ),
            "INVALID_SCOPE",
            "The agreement is outside this project.",
          );
        }
        if (input.scopeType === "GATE")
          ensure(
            state.value.gates.some((g) => g.id === input.scopeId),
            "INVALID_SCOPE",
            "Select an existing gate.",
          );
        await this.sources.person(input.accountId, input.projectId);
        state.value.bindings.push({
          id: newId("role"),
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          accountId: input.accountId,
          role: input.role,
          confirmedByAccountId: this.ctx.principalAccountId,
          validFrom: this.now,
          provenance: "EXPLICIT_ADMIN",
        });
        return this.saveProject(state);
      }
      case "commitment.createDraft": {
        const input = parseCommand(name, raw);
        await this.assertAgreementAccess(input);
        await this.assertKnownMappings(input);
        const existing = await this.repo.list(
          "commitment",
          commitmentRecordSchema,
        );
        ensure(
          existing.length < 200,
          "PILOT_LIMIT",
          "The pilot supports up to 200 commitment records. Archive before adding more.",
        );
        const record: CommitmentRecord = {
          schemaVersion: SCHEMA_VERSION,
          id: newId("PM"),
          draft: input,
          versions: [],
          proposals: [],
          reviews: [],
          operations: [],
          outcomes: [],
          history: [],
        };
        this.history(
          record,
          "DRAFT_CREATED",
          "A candidate was created; owner acceptance is still required.",
        );
        return this.repo.save(
          "commitment",
          record.id,
          0,
          record,
          commitmentRecordSchema,
        );
      }
      case "commitment.confirm": {
        const input = parseCommand(name, raw);
        const stored = await this.record(input.commitmentId);
        this.assertRevision(stored, input.expectedRevision);
        ensure(
          stored.value.draft,
          "NO_DRAFT",
          "There is no proposed agreement to confirm.",
        );
        const agreement = agreementSchema.parse(stored.value.draft);
        ensure(
          agreement.accountableOwnerAccountId === this.ctx.principalAccountId,
          "OWNER_ACCEPTANCE_REQUIRED",
          "The nominated accountable owner must accept this agreement.",
        );
        ensure(
          !stored.value.operations.some((o) =>
            ["EXECUTING", "RECONCILING"].includes(o.stage),
          ),
          "ACTION_PENDING",
          "Resolve the pending action before accepting a new agreement.",
        );
        await this.assertAgreementAccess(agreement);
        await this.assertKnownMappings(agreement);
        ensure(
          (
            await this.sources.person(
              this.ctx.principalAccountId,
              agreement.projectIds[0]!,
            )
          ).active,
          "OWNER_UNAVAILABLE",
          "The accountable owner must be active.",
        );
        const previous = activeVersion(stored.value);
        const sourceBasis = await this.basisFor(agreement),
          sourceReferences = [];
        for (const workId of agreement.supportingWorkIds)
          sourceReferences.push(
            (await this.sources.work(workId.split(":").at(-1)!)).source,
          );
        const states = await Promise.all(
          agreement.projectIds.map((id) => this.projectState(id)),
        );
        for (const ref of sourceBasis.filter(
          (b) => b.entityKind === "ARTIFACT",
        )) {
          const artifact = states
            .flatMap((s) => s.value.artifacts)
            .find((a) => a.id === ref.entityId);
          if (artifact)
            sourceReferences.push(
              (await this.sources.page(artifact.pageId)).source,
            );
        }
        const version = commitmentSchema.parse({
          ...agreement,
          id: stored.value.id,
          version: (previous?.version ?? 0) + 1,
          installationId: this.ctx.installationId,
          cloudId: this.ctx.cloudId,
          originalDueAt: previous?.originalDueAt ?? agreement.agreedDueAt,
          ownerAcceptedAt: this.now,
          lifecycle: "ACTIVE",
          stakeholderBindingIds: previous?.stakeholderBindingIds ?? [],
          sourceBasis,
          sourceReferences,
          ...(previous ? { supersedesVersion: previous.version } : {}),
        });
        stored.value.versions.push(version);
        delete stored.value.draft;
        this.history(
          stored.value,
          "OWNER_ACCEPTED",
          `Owner accepted agreement version ${version.version}. The original deadline is preserved.`,
        );
        return this.repo.save(
          "commitment",
          stored.value.id,
          stored.revision,
          stored.value,
          commitmentRecordSchema,
        );
      }
      case "commitment.proposeRevision": {
        const input = parseCommand(name, raw);
        const stored = await this.record(input.commitmentId);
        this.assertRevision(stored, input.expectedRevision);
        await this.requireOwnerOrAdmin(stored.value);
        await this.assertAgreementAccess(input.draft);
        await this.assertKnownMappings(input.draft);
        stored.value.draft = draftSchema.parse(input.draft);
        this.history(
          stored.value,
          "REVISION_PROPOSED",
          "A revised agreement awaits owner acceptance; the active promise is unchanged.",
        );
        return this.repo.save(
          "commitment",
          stored.value.id,
          stored.revision,
          stored.value,
          commitmentRecordSchema,
        );
      }
      case "commitment.transferOwner": {
        const input = parseCommand(name, raw);
        const stored = await this.record(input.commitmentId);
        this.assertRevision(stored, input.expectedRevision);
        await this.requireOwnerOrAdmin(stored.value);
        const version = activeVersion(stored.value);
        ensure(version, "NO_AGREEMENT", "Confirm an agreement first.");
        await this.sources.person(
          input.incomingOwnerAccountId,
          version.projectIds[0]!,
        );
        stored.value.pendingOwner = {
          accountId: input.incomingOwnerAccountId,
          proposedBy: this.ctx.principalAccountId,
          at: this.now,
        };
        this.history(
          stored.value,
          "OWNER_TRANSFER_PROPOSED",
          "Owner transfer is pending; the current owner remains accountable.",
        );
        return this.repo.save(
          "commitment",
          stored.value.id,
          stored.revision,
          stored.value,
          commitmentRecordSchema,
        );
      }
      case "commitment.acceptOwner": {
        const input = parseCommand(name, raw);
        const stored = await this.record(input.commitmentId);
        this.assertRevision(stored, input.expectedRevision);
        ensure(
          stored.value.pendingOwner?.accountId === this.ctx.principalAccountId,
          "FORBIDDEN",
          "Only the nominated incoming owner can accept this transfer.",
        );
        ensure(
          !stored.value.operations.some((o) =>
            ["EXECUTING", "RECONCILING"].includes(o.stage),
          ),
          "ACTION_PENDING",
          "Resolve the pending action before transferring ownership.",
        );
        const previous = activeVersion(stored.value);
        ensure(previous, "NO_AGREEMENT", "No accepted agreement exists.");
        stored.value.versions.push({
          ...previous,
          version: previous.version + 1,
          supersedesVersion: previous.version,
          accountableOwnerAccountId: this.ctx.principalAccountId,
          ownerAcceptedAt: this.now,
        });
        delete stored.value.pendingOwner;
        this.history(
          stored.value,
          "OWNER_TRANSFER_ACCEPTED",
          "The incoming owner accepted accountability.",
        );
        return this.repo.save(
          "commitment",
          stored.value.id,
          stored.revision,
          stored.value,
          commitmentRecordSchema,
        );
      }
      case "planning.create": {
        const input = parseCommand(name, raw);
        const state = await this.projectState(input.projectId);
        this.assertRevision(state, input.expectedRevision);
        await this.requireAdmin(input.projectId);
        await this.sources.person(input.ownerAccountId, input.projectId);
        if (input.nativeWorkNodeId) {
          const w = await this.sources.work(
            input.nativeWorkNodeId.split(":").at(-1)!,
          );
          ensure(
            w.id === input.nativeWorkNodeId &&
              w.projectId === input.projectId &&
              w.hierarchyLevel > 1,
            "NOT_NATIVE_INITIATIVE",
            "Bind only an existing higher-level Jira item.",
          );
        }
        state.value.planning.push({
          id: newId("plan"),
          projectId: input.projectId,
          kind: input.kind,
          title: input.title,
          ownerAccountId: input.ownerAccountId,
          ...(input.nativeWorkNodeId
            ? { nativeWorkNodeId: input.nativeWorkNodeId }
            : {}),
          source: sourceSchema.parse({
            source: "USER_ATTESTATION",
            sourceId: this.ctx.principalAccountId,
            sourceRevision: "1",
            observedAt: this.now,
            checkedAt: this.now,
            lineage: "INDEPENDENT_INTENT",
            visibility: "CURRENT_USER",
            verification: "UNVERIFIED",
          }),
        });
        return this.saveProject(state);
      }
      case "lifecycle.mapArtifact": {
        const input = parseCommand(name, raw);
        const state = await this.projectState(input.projectId);
        this.assertRevision(state, input.expectedRevision);
        await this.requireAdmin(input.projectId);
        ensure(
          (await this.requireEnabled()).value.confluenceConnected,
          "NOT_CONNECTED",
          "Enable the Confluence connection first.",
        );
        const page = await this.sources.page(input.pageId);
        ensure(
          page.revision === input.expectedSourceRevision,
          "STALE_SOURCE",
          "The page changed. Check its current version.",
        );
        await this.sources.person(input.ownerAccountId, input.projectId);
        const existing = state.value.artifacts.find(
          (a) =>
            a.pageId === input.pageId && a.artifactRole === input.artifactRole,
        );
        const artifact = {
          id: existing?.id ?? newId("artifact"),
          projectId: input.projectId,
          pageId: page.id,
          spaceId: page.spaceId,
          title: page.title,
          phase: input.phase,
          artifactRole: input.artifactRole,
          ownerAccountId: input.ownerAccountId,
          source: page.source,
        };
        state.value.artifacts = state.value.artifacts.filter(
          (a) => a.id !== artifact.id,
        );
        state.value.artifacts.push(artifact);
        return this.saveProject(state);
      }
      case "requirement.linkWork": {
        const input = parseCommand(name, raw);
        const state = await this.projectState(input.projectId);
        this.assertRevision(state, input.expectedRevision);
        await this.requireAdmin(input.projectId);
        const artifact = state.value.artifacts.find(
          (a) => a.id === input.artifactId,
        );
        ensure(artifact, "NOT_FOUND", "Select a mapped artifact.");
        const page = await this.sources.page(artifact.pageId);
        ensure(
          page.revision === input.expectedSourceRevision,
          "STALE_SOURCE",
          "The page changed. Check its current revision.",
        );
        // The section must be present exactly once. Heading text alone is not used as a stable ID.
        const occurrences = page.body.split(input.sectionReference).length - 1;
        ensure(
          occurrences === 1,
          "AMBIGUOUS_SECTION",
          "Select a unique section anchor present in this page revision.",
        );
        const work = await Promise.all(
          input.workIds.map((id) => this.sources.work(id.split(":").at(-1)!)),
        );
        ensure(
          work.every(
            (w) =>
              w.projectId === input.projectId && input.workIds.includes(w.id),
          ),
          "INVALID_SCOPE",
          "Work must be in this project.",
        );
        const previous = state.value.requirements.find(
          (r) => r.id === input.requirementId,
        );
        if (input.requirementId)
          ensure(
            previous,
            "NOT_FOUND",
            "The requirement mapping is unavailable.",
          );
        const requirement = {
          id: previous?.id ?? newId("REQ"),
          version: (previous?.version ?? 0) + 1,
          artifactId: artifact.id,
          sourceRevision: page.revision,
          sectionReference: input.sectionReference,
          contentFingerprint: await hash({
            pageId: page.id,
            revision: page.revision,
            anchor: input.sectionReference,
            body: page.body,
          }),
          mappingState: "CONFIRMED" as const,
          description: input.description,
          ownerAccountId: this.ctx.principalAccountId,
          acceptanceConditionIds: input.acceptanceConditionIds,
          confirmedWorkIds: input.workIds,
        };
        if (previous) state.value.requirementHistory.push(previous);
        state.value.requirements = state.value.requirements.filter(
          (r) => r.id !== requirement.id,
        );
        state.value.requirements.push(requirement);
        return this.saveProject(state);
      }
      case "lifecycle.createGate": {
        const input = parseCommand(name, raw);
        const state = await this.projectState(input.projectId);
        this.assertRevision(state, input.expectedRevision);
        await this.requireAdmin(input.projectId);
        await this.assertConditionAccess(input.conditions, [input.projectId]);
        const basis: LifecycleGate["basis"] = [];
        for (const artifactId of input.artifactIds) {
          const artifact = state.value.artifacts.find(
            (a) => a.id === artifactId,
          );
          ensure(artifact, "NOT_FOUND", "A selected artifact is unavailable.");
          const page = await this.sources.page(artifact.pageId);
          basis.push({
            entityKind: "ARTIFACT",
            entityId: artifactId,
            revision: page.revision,
          });
        }
        for (const requirementId of input.requirementIds) {
          const requirement = state.value.requirements.find(
            (r) => r.id === requirementId,
          );
          ensure(
            requirement &&
              input.artifactIds.includes(requirement.artifactId) &&
              requirement.mappingState === "CONFIRMED",
            "INVALID_MAPPING",
            "Include current source artifacts for every requirement.",
          );
          const a = state.value.artifacts.find(
            (a) => a.id === requirement.artifactId,
          )!;
          ensure(
            (await this.sources.page(a.pageId)).revision ===
              requirement.sourceRevision,
            "STALE_SOURCE",
            "Confirm changed requirements before preparing a gate.",
          );
          basis.push({
            entityKind: "REQUIREMENT",
            entityId: requirementId,
            revision: `${requirement.version}:${requirement.contentFingerprint}`,
          });
        }
        for (const condition of input.conditions)
          for (const sourceId of condition.sourceIds) {
            if (condition.predicate === "EXACT_SOURCE_STATE") {
              const work = await this.sources.work(sourceId.split(":").at(-1)!);
              if (
                !basis.some(
                  (b) => b.entityKind === "WORK" && b.entityId === work.id,
                )
              )
                basis.push({
                  entityKind: "WORK",
                  entityId: work.id,
                  revision: work.source.sourceRevision,
                });
            }
            if (condition.predicate === "QUALIFYING_RELEASE") {
              const release = await this.sources.release(sourceId);
              if (
                !basis.some(
                  (b) => b.entityKind === "SCHEDULE" && b.entityId === sourceId,
                )
              )
                basis.push({
                  entityKind: "SCHEDULE",
                  entityId: sourceId,
                  revision: release.source.sourceRevision,
                });
            }
          }
        ensure(
          input.reviewerBindingIds.every((id) =>
            state.value.bindings.some(
              (b) =>
                b.id === id &&
                b.scopeId === input.projectId &&
                ["APPROVER", "RELEASE_OWNER"].includes(b.role),
            ),
          ),
          "REVIEWER_REQUIRED",
          "Select an explicit project reviewer binding.",
        );
        const previous = state.value.gates.find((g) => g.id === input.gateId);
        if (input.gateId)
          ensure(previous, "NOT_FOUND", "The existing gate is unavailable.");
        if (previous) {
          await this.assertGateAccess(previous, state.value);
          state.value.gateHistory.push(previous);
          state.value.gates = state.value.gates.filter(
            (g) => g.id !== previous.id,
          );
        }
        state.value.gates.push({
          id: previous?.id ?? newId("gate"),
          version: (previous?.version ?? 0) + 1,
          projectId: input.projectId,
          title: input.title,
          phase: "VALIDATION",
          ownerAccountId: this.ctx.principalAccountId,
          requiredArtifactIds: input.artifactIds,
          requiredRequirementIds: input.requirementIds,
          conditions: input.conditions,
          reviewerBindingIds: input.reviewerBindingIds,
          basis,
          reviews: [],
        });
        return this.saveProject(state);
      }
      case "lifecycle.assessReadiness": {
        const input = parseCommand(name, raw);
        const state = await this.projectState(input.projectId);
        const gate = state.value.gates.find((g) => g.id === input.gateId);
        ensure(gate, "NOT_FOUND", "This gate is unavailable.");
        await this.assertGateAccess(gate, state.value);
        return assessGate(
          gate,
          state.value.artifacts,
          state.value.requirements,
          this.sources,
          this.ctx.principalAccountId,
          state.value.bindings,
          this.now,
        );
      }
      case "lifecycle.reviewGate": {
        const input = parseCommand(name, raw);
        const state = await this.projectState(input.projectId);
        this.assertRevision(state, input.expectedRevision);
        const gate = state.value.gates.find((g) => g.id === input.gateId);
        ensure(gate, "NOT_FOUND", "This gate is unavailable.");
        await this.assertGateAccess(gate, state.value);
        const binding = state.value.bindings.find(
          (b) =>
            gate.reviewerBindingIds.includes(b.id) &&
            bindingApplies(
              b,
              this.ctx,
              this.now,
              [input.projectId, gate.id],
              ["APPROVER", "RELEASE_OWNER"],
            ),
        );
        ensure(
          binding,
          "FORBIDDEN",
          "A current designated gate reviewer is required.",
        );
        const assessment = await assessGate(
          gate,
          state.value.artifacts,
          state.value.requirements,
          this.sources,
          this.ctx.principalAccountId,
          state.value.bindings,
          this.now,
        );
        ensure(
          assessment.basisHash === input.basisHash &&
            assessment.applicability === "CURRENT",
          "STALE_SOURCE",
          "Review the gate against its current source versions.",
        );
        if (input.disposition === "ACCEPT")
          ensure(
            ["READY_FOR_REVIEW", "ACCEPTED"].includes(assessment.readiness),
            "GATE_NOT_READY",
            "Required evidence must pass before acceptance.",
          );
        gate.reviews.push({
          id: newId("gate-review"),
          reviewerAccountId: this.ctx.principalAccountId,
          bindingId: binding.id,
          basisHash: input.basisHash,
          disposition: input.disposition,
          note: input.note,
          at: this.now,
        });
        return this.saveProject(state);
      }
      case "impact.trace": {
        const input = parseCommand(name, raw);
        const workspace = await this.workspace(input.projectId);
        return workspace.assessments.filter(
          (a) =>
            (!input.commitmentId || a.commitmentId === input.commitmentId) &&
            (!input.workId ||
              a.paths.some((p) => p.nodeIds.includes(input.workId!))),
        );
      }
      case "evidence.refresh":
        return this.workspace(parseCommand(name, raw).projectId);
      case "proposal.prepare": {
        const input = parseCommand(name, raw);
        const stored = await this.record(input.commitmentId);
        this.assertRevision(stored, input.expectedRevision);
        await this.requireOwnerOrAdmin(stored.value);
        const c = activeVersion(stored.value);
        ensure(
          c,
          "NO_AGREEMENT",
          "Confirm the commitment before preparing a recovery.",
        );
        const work = await this.sources.work(input.issueId);
        ensure(
          work.cloudId === this.ctx.cloudId &&
            c.supportingWorkIds.includes(work.id),
          "SOURCE_DENIED",
          "Select work linked to this commitment.",
        );
        ensure(
          work.targetDate !== input.desiredDueDate,
          "NO_CHANGE",
          "Choose a date different from the current Jira date.",
        );
        const material = {
          id: newId("proposal"),
          commitmentId: c.id,
          commitmentVersion: c.version,
          createdByAccountId: this.ctx.principalAccountId,
          createdAt: this.now,
          expiresAt: new Date(Date.parse(this.now) + 30 * 60_000).toISOString(),
          effect: {
            kind: "SET_JIRA_DUE_DATE" as const,
            cloudId: this.ctx.cloudId,
            issueId: work.externalId,
            expectedUpdatedAt: work.source.sourceRevision,
            expectedDueDate: work.targetDate,
            desiredDueDate: input.desiredDueDate,
          },
          effectOrigin:
            this.options.channel === "ROVO"
              ? ("ATLASSIAN_ONLY" as const)
              : ("USER_AUTHORED" as const),
          evidenceSourceIds: [work.id],
          basis: await this.basisFor(c),
          canonicalizationVersion: "promisory.canonical-json.v1" as const,
          alternative: input.alternative,
        };
        stored.value.proposals.push(
          proposalSchema.parse({
            ...material,
            intentHash: await hash(material),
          }),
        );
        this.history(
          stored.value,
          "PROPOSAL_PREPARED",
          "Prepared an exact Jira due-date change. The commitment deadline is unchanged.",
        );
        return this.repo.save(
          "commitment",
          stored.value.id,
          stored.revision,
          stored.value,
          commitmentRecordSchema,
        );
      }
      case "review.record": {
        const input = parseCommand(name, raw);
        const stored = await this.record(input.commitmentId);
        this.assertRevision(stored, input.expectedRevision);
        const c = activeVersion(stored.value);
        ensure(c, "NO_AGREEMENT", "No accepted agreement exists.");
        const proposal = stored.value.proposals.find(
          (p) => p.id === input.proposalId,
        );
        ensure(
          proposal && proposal.intentHash === input.intentHash,
          "INTENT_MISMATCH",
          "Review the exact prepared proposal.",
        );
        await this.validateProposal(proposal, c);
        ensure(
          !stored.value.operations.some(
            (o) =>
              o.proposalId === proposal.id &&
              ["EXECUTING", "RECONCILING", "SUCCEEDED"].includes(o.stage),
          ),
          "ACTION_PENDING",
          "This proposal has an execution attempt; resolve its result before changing reviews.",
        );
        const bindings = (
          await Promise.all(c.projectIds.map((id) => this.projectState(id)))
        ).flatMap((s) => s.value.bindings);
        const binding = bindings.find((b) =>
          bindingApplies(
            b,
            this.ctx,
            this.now,
            [c.id, ...c.projectIds],
            ["APPROVER"],
          ),
        );
        ensure(
          binding,
          "FORBIDDEN",
          "A current, explicitly designated approver is required.",
        );
        ensure(
          proposal.createdByAccountId !== this.ctx.principalAccountId,
          "INDEPENDENT_REVIEW_REQUIRED",
          "The proposal needs a different designated reviewer.",
        );
        stored.value.reviews.push({
          id: newId("review"),
          proposalId: proposal.id,
          proposalIntentHash: proposal.intentHash,
          reviewerAccountId: this.ctx.principalAccountId,
          roleBindingId: binding.id,
          disposition: input.disposition,
          recordedAt: this.now,
          note: input.note,
        });
        this.history(
          stored.value,
          "REVIEW_RECORDED",
          `Recorded ${input.disposition.toLowerCase()} for the exact proposal. Execution authority remains separate.`,
        );
        return this.repo.save(
          "commitment",
          stored.value.id,
          stored.revision,
          stored.value,
          commitmentRecordSchema,
        );
      }
      case "action.apply":
        return this.apply(parseCommand(name, raw));
      case "action.reconcile":
        return this.reconcile(parseCommand(name, raw));
      case "outcome.verify": {
        const input = parseCommand(name, raw);
        const stored = await this.record(input.commitmentId);
        this.assertRevision(stored, input.expectedRevision);
        const c = activeVersion(stored.value);
        ensure(c, "NO_AGREEMENT", "No accepted agreement exists.");
        const bindings = (
          await Promise.all(c.projectIds.map((id) => this.projectState(id)))
        ).flatMap((s) => s.value.bindings);
        ensure(
          c.accountableOwnerAccountId === this.ctx.principalAccountId ||
            c.acceptance.some(
              (c) =>
                c.designatedVerifierAccountId === this.ctx.principalAccountId,
            ) ||
            bindings.some((b) =>
              bindingApplies(
                b,
                this.ctx,
                this.now,
                [c.id, ...c.projectIds],
                ["VERIFIER"],
              ),
            ),
          "FORBIDDEN",
          "The owner or a designated verifier must request verification.",
        );
        const attested = [
          ...input.attestedConditionIds,
          ...input.revokedConditionIds,
        ];
        ensure(
          new Set(attested).size === attested.length,
          "CONFLICTING_ATTESTATION",
          "Accept or revoke a condition, not both.",
        );
        ensure(
          attested.every((id) =>
            c.acceptance.some(
              (condition) =>
                condition.id === id &&
                ["DESIGNATED_HUMAN_ACCEPTANCE", "EXPLICIT_EVIDENCE"].includes(
                  condition.predicate,
                ) &&
                condition.designatedVerifierAccountId ===
                  this.ctx.principalAccountId,
            ),
          ),
          "FORBIDDEN",
          "You can attest only your designated conditions.",
        );
        if (attested.length)
          ensure(
            input.evidenceNote.trim().length > 0,
            "EVIDENCE_REQUIRED",
            "Describe the evidence behind this acceptance or revocation.",
          );
        const currentAttestations = attested.map((id) => ({
          conditionId: id,
          conditionVersion: c.acceptance.find(
            (condition) => condition.id === id,
          )!.version,
          verifierAccountId: this.ctx.principalAccountId,
          recordedAt: this.now,
          disposition: input.revokedConditionIds.includes(id)
            ? ("REVOKE" as const)
            : ("ACCEPT" as const),
          evidenceNote: input.evidenceNote,
        }));
        const previousAttestations = stored.value.outcomes
          .filter((o) => o.commitmentVersion === c.version)
          .flatMap((o) => o.attestations);
        const latestAttestations = new Map(
          [...previousAttestations, ...currentAttestations].map((a) => [
            a.conditionId,
            a,
          ]),
        );
        const results = await evaluateConditions(
          c.acceptance,
          this.sources,
          this.ctx.principalAccountId,
        );
        for (const condition of c.acceptance.filter((c) =>
          ["DESIGNATED_HUMAN_ACCEPTANCE", "EXPLICIT_EVIDENCE"].includes(
            c.predicate,
          ),
        )) {
          const evidence = latestAttestations.get(condition.id),
            result = results.find((r) => r.conditionId === condition.id)!;
          if (
            evidence &&
            evidence.conditionVersion === condition.version &&
            evidence.verifierAccountId === condition.designatedVerifierAccountId
          ) {
            result.result = evidence.disposition === "ACCEPT" ? "PASS" : "FAIL";
            result.evidenceSourceIds = [
              `attestation:${evidence.verifierAccountId}:${condition.id}`,
            ];
            result.explanation =
              evidence.disposition === "ACCEPT"
                ? "The designated verifier explicitly accepted this versioned condition."
                : "The designated verifier explicitly revoked acceptance of this condition.";
          }
        }
        const prior = stored.value.outcomes
          .filter(
            (o) => o.commitmentVersion === c.version && o.status === "VERIFIED",
          )
          .at(-1);
        const pass = c.acceptance
          .filter((c) => c.required)
          .every(
            (c) =>
              results.find((r) => r.conditionId === c.id)?.result === "PASS",
          );
        const regressed =
          !!prior &&
          c.acceptance
            .filter((c) => c.required)
            .some(
              (c) =>
                results.find((r) => r.conditionId === c.id)?.result === "FAIL",
            );
        const outcome = {
          id: newId("outcome"),
          commitmentId: c.id,
          commitmentVersion: c.version,
          conditionResults: results,
          attestations: currentAttestations,
          verifierAccountId: this.ctx.principalAccountId,
          verifiedAt: this.now,
          status: pass
            ? ("VERIFIED" as const)
            : regressed
              ? ("REGRESSED" as const)
              : ("PENDING" as const),
          timeliness:
            prior?.timeliness ??
            (Date.parse(this.now) > Date.parse(c.originalDueAt)
              ? ("LATE" as const)
              : ("ON_TIME" as const)),
          ...(regressed ? { regressionOfOutcomeId: prior!.id } : {}),
        };
        stored.value.outcomes.push(outcome);
        this.history(
          stored.value,
          "OUTCOME_CHECKED",
          pass
            ? "Required acceptance conditions were verified."
            : regressed
              ? "Later evidence fails a required condition; the historic outcome is preserved."
              : "Outcome verification remains pending; missing evidence is not proof of regression.",
        );
        return this.repo.save(
          "commitment",
          stored.value.id,
          stored.revision,
          stored.value,
          commitmentRecordSchema,
        );
      }
      case "inbox.read": {
        const input = parseCommand(name, raw);
        const workspace = await this.workspace(input.projectId);
        const pref = await this.repo.get(
          "inbox",
          this.ctx.principalAccountId,
          inboxSchema,
        );
        const notices = [];
        for (const assessment of workspace.assessments) {
          const agreement = activeVersion(
            workspace.commitments.find(
              (c) => c.value.id === assessment.commitmentId,
            )!.value,
          )!;
          const related =
            agreement.accountableOwnerAccountId ===
              this.ctx.principalAccountId ||
            workspace.projectState?.value.bindings.some((b) =>
              bindingApplies(
                b,
                this.ctx,
                this.now,
                [input.projectId, agreement.id],
                [
                  "APPROVER",
                  "CONTRIBUTOR",
                  "OBSERVER",
                  "DELIVERY_OWNER",
                  "RELEASE_OWNER",
                  "VERIFIER",
                  "PRODUCT_OWNER",
                  "SCRUM_FACILITATOR",
                ],
              ),
            ) ||
            assessment.paths.some((p) =>
              p.nodeIds.some((id) =>
                workspace.work.work.some(
                  (w) =>
                    w.id === id &&
                    w.assigneeAccountId === this.ctx.principalAccountId,
                ),
              ),
            );
          if (!related) continue;
          for (const reason of assessment.reasons) {
            const id = await hash([
              assessment.commitmentId,
              assessment.commitmentVersion,
              reason.code,
              reason.evidenceSourceIds,
            ]);
            notices.push({
              id,
              commitmentId: assessment.commitmentId,
              reason: reason.explanation,
              evidenceSourceIds: reason.evidenceSourceIds,
              severity: assessment.health,
              seen: pref?.value.seen.includes(id) ?? false,
            });
          }
        }
        const preferences = pref?.value ?? {
          seen: [],
          quietStart: 18,
          quietEnd: 8,
          timeZone: "UTC",
        };
        const local = Temporal.Instant.from(this.now).toZonedDateTimeISO(
            preferences.timeZone,
          ),
          start = preferences.quietStart,
          end = preferences.quietEnd;
        const quiet =
          start === end
            ? false
            : start < end
              ? local.hour >= start && local.hour < end
              : local.hour >= start || local.hour < end;
        let next = local.with({
          hour: end,
          minute: 0,
          second: 0,
          millisecond: 0,
        });
        if (quiet && Temporal.ZonedDateTime.compare(next, local) <= 0)
          next = next.add({ days: 1 });
        return {
          notices,
          preferences,
          digest: {
            state: quiet ? "QUIET_HOURS" : "AVAILABLE",
            unreadCount: quiet ? 0 : notices.filter((n) => !n.seen).length,
            nextAvailableAt: quiet ? next.toInstant().toString() : this.now,
            timeZone: preferences.timeZone,
          },
          externalSending: false,
        };
      }
      case "inbox.markRead": {
        const input = parseCommand(name, raw);
        const pref = await this.repo.get(
          "inbox",
          this.ctx.principalAccountId,
          inboxSchema,
        );
        const value = pref?.value ?? {
          seen: [],
          quietStart: 18,
          quietEnd: 8,
          timeZone: "UTC",
        };
        value.seen = [...new Set([...value.seen, input.notificationId])].slice(
          -2000,
        );
        return this.repo.save(
          "inbox",
          this.ctx.principalAccountId,
          pref?.revision ?? 0,
          value,
          inboxSchema,
        );
      }
      case "inbox.preferences": {
        const input = parseCommand(name, raw);
        const pref = await this.repo.get(
          "inbox",
          this.ctx.principalAccountId,
          inboxSchema,
        );
        return this.repo.save(
          "inbox",
          this.ctx.principalAccountId,
          pref?.revision ?? 0,
          { ...input, seen: pref?.value.seen ?? [] },
          inboxSchema,
        );
      }
    }
  }
  private async apply(input: ReturnType<typeof parseCommand<"action.apply">>) {
    const stored = await this.record(input.commitmentId);
    const record = stored.value;
    const existing = record.operations.find(
      (o) =>
        o.idempotencyKey === input.idempotencyKey ||
        o.proposalId === input.proposalId,
    );
    if (existing) {
      ensure(
        existing.context.principalAccountId === this.ctx.principalAccountId &&
          existing.proposalId === input.proposalId,
        "IDEMPOTENCY_CONFLICT",
        "This operation belongs to a different request.",
      );
      // Every earlier attempt is returned; a new key cannot bypass an uncertain dispatch.
      return existing;
    }
    this.assertRevision(stored, input.expectedRevision);
    await this.requireOwnerOrAdmin(record);
    const c = activeVersion(record);
    ensure(c, "NO_AGREEMENT", "No accepted agreement exists.");
    const proposal = record.proposals.find((p) => p.id === input.proposalId);
    ensure(proposal, "NOT_FOUND", "The proposal is unavailable.");
    ensure(
      proposal.effectOrigin === "USER_AUTHORED",
      "RESTRICTED_EGRESS",
      "Rovo proposals stay inside Atlassian because their fields may derive from graph context. Prepare a separate user-authored Jira date intent before external execution.",
    );
    await this.validateProposal(proposal, c);
    ensure(
      await this.sources.canEdit(proposal.effect.issueId),
      "NATIVE_PERMISSION_REQUIRED",
      "Your current Jira user must be allowed to edit this issue.",
    );
    const bindings = (
      await Promise.all(c.projectIds.map((id) => this.projectState(id)))
    ).flatMap((s) => s.value.bindings);
    const reviews = record.reviews.filter(
      (r) =>
        r.proposalId === proposal.id &&
        r.proposalIntentHash === proposal.intentHash,
    );
    const latest = new Map<string, (typeof reviews)[number]>();
    for (const review of reviews) latest.set(review.reviewerAccountId, review);
    const valid = [...latest.values()].filter(
      (r) =>
        r.reviewerAccountId !== proposal.createdByAccountId &&
        bindings.some(
          (b) =>
            b.id === r.roleBindingId &&
            bindingApplies(
              b,
              { ...this.ctx, principalAccountId: r.reviewerAccountId },
              this.now,
              [c.id, ...c.projectIds],
              ["APPROVER"],
            ),
        ),
    );
    ensure(
      valid.some((r) => r.disposition === "APPROVE") &&
        valid.every((r) => r.disposition === "APPROVE"),
      "REVIEW_REQUIRED",
      "This exact proposal needs an independent current approval without an active hold or rejection.",
    );
    const operation: ActionOperation = {
      id: newId("operation"),
      context: this.ctx,
      proposalId: proposal.id,
      intentHash: proposal.intentHash,
      idempotencyKey: input.idempotencyKey,
      stage: "EXECUTING",
      authorityMode: "UNKNOWN",
      message: "Checking execution authority. No result is confirmed.",
      updatedAt: this.now,
      leaseUntil: new Date(Date.parse(this.now) + 60_000).toISOString(),
      finalization: "NOT_REQUIRED",
    };
    record.operations.push(operation);
    await this.repo.save(
      "commitment",
      record.id,
      stored.revision,
      record,
      commitmentRecordSchema,
    );
    let result;
    try {
      result = await this.executor.execute({
        context: this.ctx,
        proposal,
        operationId: operation.id,
        idempotencyKey: input.idempotencyKey,
      });
    } catch {
      result = {
        stage: "RECONCILING" as const,
        mode: "UNKNOWN" as const,
        message:
          "The executor response was lost. Check the result before attempting another change.",
        observed: "UNKNOWN" as const,
        finalization: "PENDING" as const,
      };
    }
    const current = await this.record(record.id);
    const target = current.value.operations.find((o) => o.id === operation.id)!;
    Object.assign(target, {
      stage: result.stage,
      authorityMode: result.mode,
      message: result.message,
      updatedAt: this.now,
      finalization: result.finalization,
      ...(result.evaluationReference
        ? { evaluationReference: result.evaluationReference }
        : {}),
      ...(result.grantReference
        ? { grantReference: result.grantReference }
        : {}),
      ...(result.externalReceiptReference
        ? { externalReceiptReference: result.externalReceiptReference }
        : {}),
      ...(result.observed ? { lastObservedResult: result.observed } : {}),
    });
    delete target.leaseUntil;
    this.history(current.value, "ACTION_RESULT", target.message);
    await this.repo.save(
      "commitment",
      current.value.id,
      current.revision,
      current.value,
      commitmentRecordSchema,
    );
    return target;
  }
  private async reconcile(
    input: ReturnType<typeof parseCommand<"action.reconcile">>,
  ) {
    const stored = await this.record(input.commitmentId);
    const operation = stored.value.operations.find(
      (o) => o.id === input.operationId,
    );
    ensure(operation, "NOT_FOUND", "This operation is unavailable.");
    ensure(
      operation.context.principalAccountId === this.ctx.principalAccountId,
      "FRESH_USER_REQUIRED",
      "The original user needs to obtain a fresh authorized invocation.",
    );
    if (
      !["RECONCILING", "EXECUTING"].includes(operation.stage) &&
      operation.finalization !== "PENDING"
    )
      return operation;
    ensure(
      !operation.leaseUntil ||
        Date.parse(operation.leaseUntil) <= Date.parse(this.now),
      "IN_PROGRESS",
      "The current attempt is still in progress.",
    );
    const proposal = stored.value.proposals.find(
      (p) => p.id === operation.proposalId,
    )!;
    const result = await this.executor.reconcile({
      context: this.ctx,
      operationId: operation.id,
      effect: proposal.effect,
    });
    Object.assign(operation, {
      stage: result.stage,
      authorityMode: result.mode,
      message: result.message,
      updatedAt: this.now,
      finalization: result.finalization,
      ...(result.observed ? { lastObservedResult: result.observed } : {}),
    });
    delete operation.leaseUntil;
    this.history(stored.value, "ACTION_RECONCILED", result.message);
    await this.repo.save(
      "commitment",
      stored.value.id,
      stored.revision,
      stored.value,
      commitmentRecordSchema,
    );
    return operation;
  }
}
