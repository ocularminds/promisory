import {
  SCHEMA_VERSION,
  phases,
  phaseLabels,
  configSchema,
  projectRecordSchema,
  commitmentRecordSchema,
  type CommitmentRecord,
  type ProjectRecord,
  type SourceReference,
  type TrustedContext,
  type WorkEdge,
  type WorkNode,
} from "@promisory/contracts";
import {
  MemoryStore,
  PromisoryService,
  Repository,
  UnconfiguredExecutor,
  DomainError,
  hash,
  type SourcePort,
  type SourcePage,
} from "@promisory/domain";
import { workId } from "@promisory/integrations-atlassian";

export const EXAMPLE_CLOCK = "2026-11-18T08:00:00.000Z";
export const EXAMPLE_CLOUD = "c57632b8-3167-4d85-990d-c0cb58c5ea70";
export const exampleContext = (principal = "maya"): TrustedContext => ({
  appId: "example-promisory",
  environmentId: "example-development",
  installationId: "example-installation",
  cloudId: EXAMPLE_CLOUD,
  principalAccountId: principal,
});
export const exampleSource = (
  sourceId: string,
  kind: SourceReference["source"] = "JIRA",
  revision = EXAMPLE_CLOCK,
): SourceReference => ({
  source: kind,
  sourceId,
  sourceRevision: revision,
  observedAt: EXAMPLE_CLOCK,
  checkedAt: EXAMPLE_CLOCK,
  lineage:
    kind === "USER_ATTESTATION" ? "INDEPENDENT_INTENT" : "ATLASSIAN_ONLY",
  visibility: "CURRENT_USER",
  verification: "UNVERIFIED",
});
export const people = [
  { accountId: "maya", displayName: "Maya Chen", active: true },
  { accountId: "leah", displayName: "Leah Ortiz", active: true },
  { accountId: "owen", displayName: "Owen Reed", active: true },
  { accountId: "alex", displayName: "Alex Morgan", active: true },
  { accountId: "jon", displayName: "Jon Bell", active: true },
];

export class ExampleSources implements SourcePort {
  readonly hiddenWork = new Set<string>();
  readonly hiddenPages = new Set<string>();
  readonly workItems: WorkNode[];
  readonly pages = new Map<string, SourcePage>();
  readonly edges: WorkEdge[] = [];
  graphAvailable = true;
  currentPrincipal = "maya";
  constructor() {
    this.workItems = [
      [
        "100",
        "MX-100",
        "EPIC",
        1,
        "Merchant launch",
        "maya",
        undefined,
        "In progress",
      ],
      [
        "110",
        "MX-110",
        "STORY",
        0,
        "Activate a merchant once",
        "jon",
        "100",
        "In progress",
      ],
      [
        "121",
        "MX-121",
        "TASK",
        0,
        "Enable production onboarding",
        "leah",
        "100",
        "In progress",
      ],
      [
        "122",
        "MX-122",
        "SUBTASK",
        -1,
        "Confirm tenant configuration",
        "owen",
        "121",
        "Done",
      ],
      [
        "137",
        "MX-137",
        "BUG",
        0,
        "Duplicate onboarding events",
        "owen",
        "100",
        "Reopened",
      ],
    ].map(
      (
        [externalId, key, type, level, title, assignee, parent, status],
        index,
      ) => ({
        id: workId(EXAMPLE_CLOUD, String(externalId)),
        cloudId: EXAMPLE_CLOUD,
        externalId: String(externalId),
        projectId: "10000",
        displayKey: String(key),
        type: type as WorkNode["type"],
        nativeTypeId: String(index + 1),
        nativeTypeName: String(type)
          .toLowerCase()
          .replace(/^./, (s) => s.toUpperCase()),
        hierarchyLevel: Number(level),
        ...(parent ? { parentId: workId(EXAMPLE_CLOUD, String(parent)) } : {}),
        title: String(title),
        statusId: status === "Done" ? "done" : "open",
        statusName: String(status),
        resolved: status === "Done",
        assigneeAccountId: String(assignee),
        targetDate: externalId === "137" ? "2026-11-24" : "2026-11-19",
        source: exampleSource(workId(EXAMPLE_CLOUD, String(externalId))),
      }),
    );
    for (const node of this.workItems)
      if (node.parentId)
        this.edges.push({
          id: `parent-${node.externalId}`,
          fromId: node.parentId,
          toId: node.id,
          fromKind: "WORK",
          toKind: "WORK",
          kind: "PARENT_OF",
          state: "CONFIRMED",
          provenance: node.source,
        });
    this.edges.push(
      {
        id: "block-137-121",
        fromId: workId(EXAMPLE_CLOUD, "137"),
        toId: workId(EXAMPLE_CLOUD, "121"),
        fromKind: "WORK",
        toKind: "WORK",
        kind: "BLOCKS",
        state: "CONFIRMED",
        provenance: exampleSource("link:1"),
      },
      {
        id: "implements-121-110",
        fromId: workId(EXAMPLE_CLOUD, "121"),
        toId: workId(EXAMPLE_CLOUD, "110"),
        fromKind: "WORK",
        toKind: "WORK",
        kind: "IMPLEMENTS",
        state: "CONFIRMED",
        provenance: exampleSource("link:2"),
      },
    );
    phases.forEach((phase, index) => {
      const pageId = String(200 + index),
        revision = phase === "DEFINITION" ? "3" : "1";
      this.pages.set(pageId, {
        id: pageId,
        spaceId: "20000",
        title:
          phase === "DEFINITION"
            ? "Merchant activation PRD"
            : phaseLabels[phase],
        revision,
        body: `<h2 id="activation-integrity">${phaseLabels[phase]}</h2><p>One activation per merchant request.</p>`,
        source: exampleSource(pageId, "CONFLUENCE", revision),
      });
    });
  }
  async projects() {
    return [{ id: "10000", key: "MX", name: "Merchant Experience" }];
  }
  async project(projectId: string) {
    if (projectId !== "10000")
      throw new DomainError("SOURCE_UNAVAILABLE", "Project unavailable.");
    return (await this.projects())[0]!;
  }
  async people(projectId: string, query: string) {
    await this.project(projectId);
    return people.filter((p) =>
      p.displayName.toLowerCase().includes(query.toLowerCase()),
    );
  }
  async person(accountId: string, projectId: string) {
    await this.project(projectId);
    const person = people.find((p) => p.accountId === accountId);
    if (!person)
      throw new DomainError("SOURCE_UNAVAILABLE", "Person unavailable.");
    return person;
  }
  async isAdmin() {
    return ["maya", "jon"].includes(this.currentPrincipal);
  }
  async canEdit(issueId: string) {
    return !this.hiddenWork.has(issueId);
  }
  async work(issueId: string) {
    const work = this.workItems.find((w) => w.externalId === issueId);
    if (!work || this.hiddenWork.has(issueId))
      throw new DomainError("SOURCE_UNAVAILABLE", "Work unavailable.");
    return structuredClone(work);
  }
  async importWork(projectId: string) {
    await this.project(projectId);
    const work = this.workItems.filter(
      (w) => !this.hiddenWork.has(w.externalId),
    );
    return {
      work: structuredClone(work),
      edges: structuredClone(
        this.edges.filter(
          (e) =>
            work.some((w) => w.id === e.fromId) &&
            work.some((w) => w.id === e.toId),
        ),
      ),
      coverage: this.hiddenWork.size
        ? ("INCOMPLETE" as const)
        : ("COMPLETE" as const),
      unknowns: this.hiddenWork.size
        ? ["Some context is unavailable with your current access."]
        : [],
      workTypes: work.map((w) => ({
        id: w.nativeTypeId,
        name: w.nativeTypeName,
        hierarchyLevel: w.hierarchyLevel,
      })),
    };
  }
  async page(pageId: string) {
    const page = this.pages.get(pageId);
    if (!page || this.hiddenPages.has(pageId))
      throw new DomainError("SOURCE_UNAVAILABLE", "Page unavailable.");
    return structuredClone(page);
  }
  async release(versionId: string) {
    return {
      released: versionId === "300",
      projectId: "10000",
      source: exampleSource(`version:${versionId}`),
    };
  }
  async graph() {
    if (!this.graphAvailable)
      throw new DomainError("GRAPH_UNAVAILABLE", "Graph unavailable.");
    return {
      items: [
        {
          id: `ari:cloud:jira:${EXAMPLE_CLOUD}:issue/121`,
          title: "Enable production onboarding",
          status: "In progress",
        },
      ],
      coverage: "COMPLETE" as const,
      unknowns: [
        "Illustrative graph context; no live Teamwork Graph request was made.",
      ],
      sources: [
        exampleSource(
          `ari:cloud:jira:${EXAMPLE_CLOUD}:issue/121`,
          "TEAMWORK_GRAPH",
        ),
      ],
    };
  }
  async capabilities() {
    return ["Jira", "Confluence", "Teamwork Graph", "Rovo"].map((key) => ({
      key,
      state: "UNVERIFIED" as const,
      detail: "Example mode. No live integration has been tested.",
    }));
  }
  changeRequirement() {
    const page = this.pages.get("203")!;
    page.revision = String(Number(page.revision) + 1);
    page.body += "<p>Changed acceptance scope.</p>";
    page.source.sourceRevision = page.revision;
  }
  reopenBug() {
    const bug = this.workItems.find((w) => w.externalId === "137")!;
    bug.resolved = false;
    bug.statusId = "open";
    bug.statusName = "Reopened";
    bug.targetDate = "2026-11-24";
  }
}
export async function createExample() {
  const raw = new MemoryStore(),
    sources = new ExampleSources(),
    ctx = exampleContext(),
    repo = new Repository(raw, ctx);
  await repo.save(
    "config",
    "installation",
    0,
    {
      schemaVersion: SCHEMA_VERSION,
      selectedProjectIds: ["10000"],
      confluenceConnected: true,
      enabled: true,
      retentionDays: 180,
      confirmedByAccountId: "maya",
    },
    configSchema,
  );
  const roles = [
    "STRATEGY",
    "RESEARCH",
    "INITIATIVE_CHARTER",
    "PRD",
    "DELIVERY_PLAN",
    "DESIGN_DECISION",
    "READINESS",
    "LAUNCH",
    "OUTCOME_REVIEW",
    "RETIREMENT_PLAN",
  ] as const;
  const prd = await sources.page("203");
  const project: ProjectRecord = {
    schemaVersion: SCHEMA_VERSION,
    id: "10000",
    planning: [
      {
        id: "goal-activation",
        projectId: "10000",
        kind: "OBJECTIVE",
        title: "Reliable self-service activation",
        ownerAccountId: "jon",
        source: exampleSource("goal-activation", "USER_ATTESTATION", "1"),
      },
      {
        id: "initiative-activation",
        projectId: "10000",
        kind: "INITIATIVE",
        title: "Self-service merchant activation",
        ownerAccountId: "maya",
        source: exampleSource("initiative-activation", "USER_ATTESTATION", "1"),
      },
    ],
    artifacts: phases.map((phase, index) => {
      const page = sources.pages.get(String(200 + index))!;
      return {
        id: `artifact-${phase.toLowerCase()}`,
        projectId: "10000",
        phase,
        artifactRole: roles[index]!,
        ownerAccountId: index < 4 ? "jon" : "maya",
        pageId: page.id,
        spaceId: page.spaceId,
        title: page.title,
        source: page.source,
      };
    }),
    requirements: [
      {
        id: "REQ-07",
        version: 1,
        artifactId: "artifact-definition",
        sourceRevision: "3",
        sectionReference: "activation-integrity",
        contentFingerprint: await hash({
          pageId: prd.id,
          revision: prd.revision,
          anchor: "activation-integrity",
          body: prd.body,
        }),
        mappingState: "CONFIRMED",
        description: "One activation per merchant request",
        ownerAccountId: "jon",
        acceptanceConditionIds: ["production-onboarding"],
        confirmedWorkIds: ["100", "110", "121"].map((id) =>
          workId(EXAMPLE_CLOUD, id),
        ),
      },
    ],
    gates: [],
    requirementHistory: [],
    gateHistory: [],
    bindings: [
      {
        id: "reviewer-jon",
        scopeType: "PROJECT",
        scopeId: "10000",
        accountId: "jon",
        role: "APPROVER",
        confirmedByAccountId: "maya",
        validFrom: EXAMPLE_CLOCK,
        provenance: "EXPLICIT_ADMIN",
      },
    ],
    edges: [
      {
        id: "planning-epic",
        fromId: "initiative-activation",
        toId: workId(EXAMPLE_CLOUD, "100"),
        fromKind: "PLANNING",
        toKind: "WORK",
        kind: "SUPPORTS",
        state: "CONFIRMED",
        provenance: exampleSource("planning-epic", "USER_ATTESTATION", "1"),
      },
    ],
  };
  project.gates.push({
    id: "release-readiness",
    version: 1,
    projectId: "10000",
    title: "Merchant launch readiness",
    phase: "VALIDATION",
    ownerAccountId: "maya",
    requiredArtifactIds: ["artifact-definition"],
    requiredRequirementIds: ["REQ-07"],
    conditions: [
      {
        id: "tenant-config",
        version: 1,
        description: "Tenant configuration subtask is Done",
        predicate: "EXACT_SOURCE_STATE",
        required: true,
        sourceIds: [workId(EXAMPLE_CLOUD, "122")],
        expectedState: { field: "statusId", value: "done" },
      },
    ],
    reviewerBindingIds: ["reviewer-jon"],
    basis: [
      {
        entityKind: "ARTIFACT",
        entityId: "artifact-definition",
        revision: "3",
      },
      {
        entityKind: "REQUIREMENT",
        entityId: "REQ-07",
        revision: `1:${project.requirements[0]!.contentFingerprint}`,
      },
    ],
    reviews: [],
  });
  await repo.save("project", "10000", 0, project, projectRecordSchema);
  const examples = [
    [
      "PM-101",
      "Launch merchant onboarding",
      "maya",
      "Northstar Retail",
      "2026-11-20",
    ],
    [
      "PM-102",
      "Publish reconciliation export",
      "jon",
      "Finance team",
      "2026-11-25",
    ],
    [
      "PM-103",
      "Complete support handover",
      "alex",
      "Support team",
      "2026-11-23",
    ],
    [
      "PM-104",
      "Verify settlement status page",
      "leah",
      "Merchant operations",
      "2026-11-17",
    ],
  ];
  for (const [id, title, owner, beneficiary, due] of examples) {
    const first = id === "PM-101";
    const record: CommitmentRecord = {
      schemaVersion: SCHEMA_VERSION,
      id: id!,
      versions: [
        {
          id: id!,
          version: 1,
          installationId: ctx.installationId,
          cloudId: ctx.cloudId,
          title: title!,
          outcome: first
            ? "Merchants can activate production onboarding without duplicate events."
            : title!,
          beneficiary: {
            kind: first ? "CUSTOMER" : "INTERNAL_TEAM",
            reference: beneficiary!,
          },
          projectIds: ["10000"],
          accountableOwnerAccountId: owner!,
          originalDueAt: `${due}T16:00:00.000Z`,
          agreedDueAt: `${due}T16:00:00.000Z`,
          timeZone: "Europe/Stockholm",
          ownerAcceptedAt: "2026-11-10T09:00:00.000Z",
          lifecycle: "ACTIVE",
          acceptance: [
            {
              id: "production-onboarding",
              version: 1,
              description: first
                ? "Production onboarding is released and the customer owner confirms acceptance."
                : "The designated owner accepts the agreed evidence.",
              predicate: "DESIGNATED_HUMAN_ACCEPTANCE",
              required: true,
              sourceIds: [],
              designatedVerifierAccountId: owner!,
            },
          ],
          supportingWorkIds: first ? [workId(EXAMPLE_CLOUD, "121")] : [],
          planningNodeIds: first
            ? ["goal-activation", "initiative-activation"]
            : [],
          requirementIds: first ? ["REQ-07"] : [],
          requiredGateIds: first ? ["release-readiness"] : [],
          phase: "DELIVERY",
          stakeholderBindingIds: [],
          sourceReferences: [],
          sourceBasis: [],
        },
      ],
      proposals: [],
      reviews: [],
      operations: [],
      outcomes: [],
      history: [
        {
          id: `history-${id}`,
          kind: "OWNER_ACCEPTED",
          actorAccountId: owner!,
          at: "2026-11-10T09:00:00.000Z",
          version: 1,
          summary:
            "The example owner accepted the commitment and its original deadline.",
        },
      ],
    };
    if (id === "PM-104")
      record.outcomes.push({
        id: "outcome-example-104",
        commitmentId: id,
        commitmentVersion: 1,
        conditionResults: [
          {
            conditionId: "production-onboarding",
            result: "PASS",
            evidenceSourceIds: ["attestation:leah:production-onboarding"],
            explanation: "Illustrative service-owner acceptance.",
          },
        ],
        verifierAccountId: "leah",
        verifiedAt: "2026-11-17T14:00:00.000Z",
        status: "VERIFIED",
        timeliness: "ON_TIME",
        attestations: [
          {
            conditionId: "production-onboarding",
            conditionVersion: 1,
            verifierAccountId: "leah",
            recordedAt: "2026-11-17T14:00:00.000Z",
            disposition: "ACCEPT",
            evidenceNote:
              "Illustrative service-owner acceptance in example mode.",
          },
        ],
      });
    await repo.save("commitment", id!, 0, record, commitmentRecordSchema);
  }
  const as = (principal: string) => {
    sources.currentPrincipal = principal;
    const ctx = exampleContext(principal);
    return new PromisoryService(
      ctx,
      new Repository(raw, ctx),
      sources,
      new UnconfiguredExecutor(),
      { mode: "EXAMPLE", clock: () => EXAMPLE_CLOCK },
    );
  };
  return { raw, sources, repo, service: as("maya"), as };
}
