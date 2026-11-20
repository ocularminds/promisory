import { z } from "zod";
import {
  externalId,
  hasJiraDueDatePermissions,
  id,
  jiraDueDatePermissionKeys,
  sourceSchema,
  workSchema,
  type Capability,
  type SourceReference,
  type TrustedContext,
  type WorkEdge,
  type WorkNode,
} from "@promisory/contracts";
import {
  DomainError,
  ensure,
  validateNativeHierarchy,
  type GraphContext,
  type GraphRelations,
  type Person,
  type Project,
  type SourcePage,
  type SourcePort,
  type WorkSnapshot,
} from "@promisory/domain";

export interface ApiResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}
export interface UserTransport {
  jira(
    path: string,
    options?: { method?: "GET" | "POST"; body?: string },
  ): Promise<ApiResponse>;
  confluence(path: string): Promise<ApiResponse>;
  graph(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<ApiResponse>;
}
const issueTypeSchema = z.object({
  id: externalId,
  name: z.string(),
  subtask: z.boolean().optional(),
  hierarchyLevel: z.number().int().optional(),
});
const personSchema = z.object({
  accountId: id,
  displayName: z.string(),
  active: z.boolean().default(true),
});
const projectSchema = z.object({
  id: externalId,
  key: z.string(),
  name: z.string(),
});
const issueSchema = z.object({
  id: externalId,
  key: z.string(),
  fields: z.object({
    summary: z.string(),
    updated: z.string(),
    project: projectSchema,
    issuetype: issueTypeSchema,
    status: z.object({
      id: id,
      name: z.string(),
      statusCategory: z.object({ key: z.string() }),
    }),
    resolution: z.unknown().nullable().optional(),
    assignee: personSchema.nullable().optional(),
    duedate: z.string().nullable().optional(),
    parent: z.object({ id: externalId }).optional(),
    issuelinks: z
      .array(
        z.object({
          id: externalId,
          type: z.object({
            id: externalId,
            name: z.string(),
            inward: z.string(),
            outward: z.string(),
          }),
          inwardIssue: z.object({ id: externalId }).optional(),
          outwardIssue: z.object({ id: externalId }).optional(),
        }),
      )
      .optional(),
  }),
});
type JiraIssue = z.infer<typeof issueSchema>;
export const workId = (cloudId: string, issueId: string) =>
  `jira:${cloudId}:${issueId}`;
const source = (
  ctx: TrustedContext,
  kind: "JIRA" | "CONFLUENCE" | "TEAMWORK_GRAPH",
  sourceId: string,
  revision: string,
  now: string,
): SourceReference =>
  sourceSchema.parse({
    source: kind,
    sourceId,
    sourceRevision: revision,
    observedAt: now,
    checkedAt: now,
    lineage: "ATLASSIAN_ONLY",
    visibility: "CURRENT_USER",
    verification: "UNVERIFIED",
  });
export function normalizeIssue(
  raw: unknown,
  ctx: TrustedContext,
  types: z.infer<typeof issueTypeSchema>[],
  now: string,
): WorkNode {
  const issue = issueSchema.parse(raw),
    fields = issue.fields;
  const type =
    types.find((t) => t.id === fields.issuetype.id) ?? fields.issuetype;
  const level =
    type.hierarchyLevel ??
    fields.issuetype.hierarchyLevel ??
    (type.subtask ? -1 : 0);
  // Names are display labels, never proof of hierarchy. Unknown standard types remain CUSTOM.
  const displayType =
    level > 1
      ? "CUSTOM"
      : level === 1
        ? "EPIC"
        : level === -1
          ? "SUBTASK"
          : ["Story", "Task", "Bug"].includes(type.name)
            ? type.name.toUpperCase()
            : "CUSTOM";
  return workSchema.parse({
    id: workId(ctx.cloudId, issue.id),
    cloudId: ctx.cloudId,
    externalId: issue.id,
    projectId: fields.project.id,
    displayKey: issue.key,
    type: displayType,
    nativeTypeId: type.id,
    nativeTypeName: type.name,
    hierarchyLevel: level,
    ...(fields.parent
      ? { parentId: workId(ctx.cloudId, fields.parent.id) }
      : {}),
    title: fields.summary.slice(0, 240),
    statusId: fields.status.id,
    statusName: fields.status.name,
    resolved: fields.status.statusCategory.key === "done",
    ...(fields.assignee
      ? { assigneeAccountId: fields.assignee.accountId }
      : {}),
    targetDate: fields.duedate ?? null,
    source: source(
      ctx,
      "JIRA",
      workId(ctx.cloudId, issue.id),
      new Date(fields.updated).toISOString(),
      now,
    ),
  });
}
const permissionSchema = z.object({
  permissions: z.record(z.string(), z.object({ havePermission: z.boolean() })),
});
const fields =
  "summary,updated,project,issuetype,status,resolution,assignee,duedate,parent,issuelinks";

/** No caller chooses a URL or execution context; every read uses the injected native current-user client. */
type Tier = "DETAILED" | "IDENTIFIERS" | "TYPENAMES";
/**
 * Selection tiers for curated Teamwork Graph fields whose node types are not
 * documented. The first tier that validates is used, and the tier is recorded so
 * live evidence shows which schema the tenant actually served.
 */
export const GRAPH_SELECTIONS: Record<
  "deployments" | "goals" | "teams" | "members",
  { field: string; arg: string; tiers: Array<[Tier, string]> }
> = {
  deployments: {
    field: "jiraWorkItemLinkedExternalDeployments",
    arg: "id",
    tiers: [
      [
        "DETAILED",
        "__typename ... on ExternalDeployment { id displayName environmentType state lastUpdated }",
      ],
      ["IDENTIFIERS", "__typename ... on ExternalDeployment { id }"],
      ["TYPENAMES", "__typename"],
    ],
  },
  goals: {
    field: "jiraWorkItemGoals",
    arg: "id",
    tiers: [
      ["DETAILED", "__typename ... on AtlassianGoal { id name }"],
      ["IDENTIFIERS", "__typename ... on AtlassianGoal { id }"],
      ["TYPENAMES", "__typename"],
    ],
  },
  teams: {
    field: "atlassianTeamsBySpace",
    arg: "spaceAri",
    tiers: [
      ["DETAILED", "__typename ... on AtlassianTeam { id displayName }"],
      ["IDENTIFIERS", "__typename ... on AtlassianTeam { id }"],
      ["TYPENAMES", "__typename"],
    ],
  },
  members: {
    field: "atlassianTeamMembers",
    arg: "teamAri",
    tiers: [
      ["IDENTIFIERS", "__typename ... on AtlassianUser { id }"],
      ["TYPENAMES", "__typename"],
    ],
  },
};
export const curatedQuery = (field: string, arg: string, selection: string) =>
  `query Promisory_${field}($value: ID!) {
  ${field}(${arg}: $value, first: 25) {
    edges { node { ${selection} } }
    pageInfo { hasNextPage endCursor }
  }
}`;
const graphText = z
  .string()
  .max(300)
  .transform((v) => v.trim())
  .optional()
  .catch(undefined);
const graphNode = z
  .object({
    __typename: z.string().optional(),
    id: z.string().max(500).optional(),
    displayName: graphText,
    name: graphText,
    state: graphText,
    environmentType: graphText,
    lastUpdated: graphText,
  })
  .passthrough();
type GraphNode = z.infer<typeof graphNode>;

export class AtlassianSources implements SourcePort {
  // An adapter is constructed per Forge invocation and principal. This cache
  // never survives an invocation or becomes a shared permission projection.
  private reads = new Map<string, Promise<unknown>>();
  constructor(
    private ctx: TrustedContext,
    private api: UserTransport,
    private clock: () => string = () => new Date().toISOString(),
  ) {}
  private async memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    let pending = this.reads.get(key);
    if (!pending) {
      ensure(
        this.reads.size < 2500,
        "SOURCE_LIMIT",
        "Narrow the pilot scope to refresh this view.",
      );
      pending = load();
      this.reads.set(key, pending);
    }
    return structuredClone(await pending) as T;
  }
  private async read(call: () => Promise<ApiResponse>): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await call();
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const raw = response.headers.get("retry-after");
        const delay =
          raw && /^\d+$/.test(raw)
            ? Number(raw) * 1000
            : raw
              ? Date.parse(raw) - Date.now()
              : 250 * 2 ** attempt;
        if (!Number.isFinite(delay) || delay > 2000)
          throw new DomainError(
            "SOURCE_RATE_LIMITED",
            "The source asked for a later retry. Refresh after its retry window.",
          );
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, delay)));
        continue;
      }
      ensure(
        response.ok,
        "SOURCE_UNAVAILABLE",
        response.status === 403 || response.status === 404
          ? "This source is unavailable with your current access."
          : "The source connection is unavailable.",
      );
      return response.json();
    }
    throw new DomainError(
      "SOURCE_UNAVAILABLE",
      "The source connection is unavailable.",
    );
  }
  async projects(): Promise<Project[]> {
    const projects: Project[] = [];
    for (let startAt = 0; startAt < 500; startAt += 50) {
      const page = z
        .object({
          values: z.array(projectSchema),
          isLast: z.boolean().optional(),
        })
        .parse(
          await this.read(() =>
            this.api.jira(
              `/rest/api/3/project/search?startAt=${startAt}&maxResults=50`,
            ),
          ),
        );
      projects.push(...page.values);
      if (page.isLast || page.values.length < 50) break;
    }
    return projects;
  }
  async project(projectId: string) {
    return this.memo(`project:${projectId}`, async () =>
      projectSchema.parse(
        await this.read(() =>
          this.api.jira(`/rest/api/3/project/${externalId.parse(projectId)}`),
        ),
      ),
    );
  }
  async people(projectId: string, query: string): Promise<Person[]> {
    const raw = await this.read(() =>
      this.api.jira(
        `/rest/api/3/user/assignable/search?project=${externalId.parse(projectId)}&query=${encodeURIComponent(query)}&maxResults=25`,
      ),
    );
    return z.array(personSchema).parse(raw);
  }
  async person(accountId: string, projectId: string): Promise<Person> {
    await this.project(projectId);
    return this.memo(`person:${accountId}`, async () =>
      personSchema.parse(
        await this.read(() =>
          this.api.jira(
            `/rest/api/3/user?accountId=${encodeURIComponent(id.parse(accountId))}`,
          ),
        ),
      ),
    );
  }
  async isAdmin(projectId?: string): Promise<boolean> {
    try {
      const query = projectId
        ? `projectId=${externalId.parse(projectId)}&permissions=ADMINISTER,ADMINISTER_PROJECTS`
        : "permissions=ADMINISTER";
      const result = permissionSchema.parse(
        await this.read(() =>
          this.api.jira(`/rest/api/3/mypermissions?${query}`),
        ),
      );
      return (
        result.permissions.ADMINISTER?.havePermission === true ||
        !!(projectId && result.permissions.ADMINISTER_PROJECTS?.havePermission)
      );
    } catch {
      return false;
    }
  }
  async canSetDueDate(issueId: string): Promise<boolean> {
    const path = `/rest/api/3/mypermissions?issueId=${externalId.parse(issueId)}&permissions=${jiraDueDatePermissionKeys.join(",")}`;
    try {
      return hasJiraDueDatePermissions(
        await this.read(() => this.api.jira(path)),
      );
    } catch {
      return false;
    }
  }
  async work(issueId: string): Promise<WorkNode> {
    return this.memo(`work:${issueId}`, async () =>
      normalizeIssue(
        await this.read(() =>
          this.api.jira(
            `/rest/api/3/issue/${externalId.parse(issueId)}?fields=${fields}`,
          ),
        ),
        this.ctx,
        [],
        this.clock(),
      ),
    );
  }
  async importWork(projectId: string): Promise<WorkSnapshot> {
    externalId.parse(projectId);
    await this.project(projectId);
    const types = z
      .array(issueTypeSchema)
      .parse(
        await this.read(() =>
          this.api.jira(`/rest/api/3/issuetype/project?projectId=${projectId}`),
        ),
      );
    const now = this.clock(),
      work: WorkNode[] = [],
      rawIssues: JiraIssue[] = [],
      unknowns: string[] = [];
    let token: string | undefined;
    const tokens = new Set<string>();
    for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
      const body = {
        jql: `project = ${projectId} ORDER BY id ASC`,
        maxResults: 50,
        fields: fields.split(","),
        ...(token ? { nextPageToken: token } : {}),
      };
      const page = z
        .object({
          issues: z.array(issueSchema),
          isLast: z.boolean().optional(),
          nextPageToken: z.string().optional(),
        })
        .parse(
          await this.read(() =>
            this.api.jira("/rest/api/3/search/jql", {
              method: "POST",
              body: JSON.stringify(body),
            }),
          ),
        );
      for (const issue of page.issues)
        if (!rawIssues.some((w) => w.id === issue.id)) {
          rawIssues.push(issue);
          work.push(normalizeIssue(issue, this.ctx, types, now));
        }
      if (page.isLast || !page.nextPageToken) break;
      if (tokens.has(page.nextPageToken)) {
        unknowns.push(
          "Jira pagination did not advance. The import is incomplete.",
        );
        break;
      }
      tokens.add(page.nextPageToken);
      token = page.nextPageToken;
      if (pageNumber === 19)
        unknowns.push(
          "The 1,000-item pilot import limit was reached. Narrow the selected scope.",
        );
    }
    const edges: WorkEdge[] = [],
      seen = new Set<string>(),
      ids = new Set(work.map((w) => w.id));
    const add = (edge: WorkEdge) => {
      if (!seen.has(edge.id)) {
        seen.add(edge.id);
        edges.push(edge);
      }
    };
    for (const node of work)
      if (node.parentId) {
        if (ids.has(node.parentId))
          add({
            id: `parent-${node.externalId}`,
            fromId: node.parentId,
            toId: node.id,
            fromKind: "WORK",
            toKind: "WORK",
            kind: "PARENT_OF",
            state: "CONFIRMED",
            provenance: node.source,
          });
        else
          unknowns.push(
            "Some native parents are outside the visible imported scope.",
          );
      }
    for (const issue of rawIssues)
      for (const link of issue.fields.issuelinks ?? []) {
        // Jira describes direction relative to this issue. Only the explicit Blocks link is interpreted.
        if (
          link.type.outward.toLowerCase() !== "blocks" ||
          link.type.inward.toLowerCase() !== "is blocked by"
        ) {
          unknowns.push(
            "Some Jira relationship types are not mapped as blocking dependencies.",
          );
          continue;
        }
        const from = link.outwardIssue
          ? workId(this.ctx.cloudId, issue.id)
          : workId(this.ctx.cloudId, link.inwardIssue?.id ?? issue.id);
        const to = link.outwardIssue
          ? workId(this.ctx.cloudId, link.outwardIssue.id)
          : workId(this.ctx.cloudId, issue.id);
        if (!ids.has(from) || !ids.has(to)) {
          unknowns.push(
            "Some dependencies are outside the visible imported scope.",
          );
          continue;
        }
        add({
          id: `jira-link-${link.id}`,
          fromId: from,
          toId: to,
          fromKind: "WORK",
          toKind: "WORK",
          kind: "BLOCKS",
          state: "CONFIRMED",
          provenance: source(
            this.ctx,
            "JIRA",
            `link:${link.id}`,
            new Date(issue.fields.updated).toISOString(),
            now,
          ),
        });
      }
    const invalid = new Set(validateNativeHierarchy(work, edges));
    if (invalid.size)
      unknowns.push(
        "Native hierarchy metadata is inconsistent; affected parent edges are omitted.",
      );
    if (types.some((t) => t.hierarchyLevel === undefined && !t.subtask))
      unknowns.push(
        "Some native work levels were not supplied by Jira metadata.",
      );
    for (const node of work)
      this.reads.set(`work:${node.externalId}`, Promise.resolve(node));
    return {
      work,
      edges: edges.filter((e) => !invalid.has(e.id)),
      coverage: unknowns.length ? "INCOMPLETE" : "COMPLETE",
      unknowns: [...new Set(unknowns)],
      workTypes: types.map((t) => ({
        id: t.id,
        name: t.name,
        hierarchyLevel: t.hierarchyLevel ?? (t.subtask ? -1 : 0),
      })),
    };
  }
  async page(pageId: string): Promise<SourcePage> {
    return this.memo(`page:${pageId}`, async () => {
      const page = z
        .object({
          id: externalId,
          spaceId: externalId,
          title: z.string(),
          version: z.object({ number: z.number().int().positive() }),
          body: z.object({
            storage: z.object({ value: z.string().max(1_000_000) }),
          }),
        })
        .parse(
          await this.read(() =>
            this.api.confluence(
              `/wiki/api/v2/pages/${externalId.parse(pageId)}?body-format=storage`,
            ),
          ),
        );
      return {
        id: page.id,
        spaceId: page.spaceId,
        title: page.title,
        revision: String(page.version.number),
        body: page.body.storage.value,
        source: source(
          this.ctx,
          "CONFLUENCE",
          page.id,
          String(page.version.number),
          this.clock(),
        ),
      };
    });
  }
  async release(versionId: string) {
    const release = z
      .object({
        id: externalId,
        projectId: z.number().int(),
        released: z.boolean(),
      })
      .parse(
        await this.read(() =>
          this.api.jira(`/rest/api/3/version/${externalId.parse(versionId)}`),
        ),
      );
    await this.project(String(release.projectId));
    return {
      released: release.released,
      projectId: String(release.projectId),
      source: source(
        this.ctx,
        "JIRA",
        `version:${release.id}`,
        release.released ? "released" : "unreleased",
        this.clock(),
      ),
    };
  }
  async graph(): Promise<GraphContext> {
    const items: GraphContext["items"] = [],
      sources: SourceReference[] = [];
    let after: string | undefined;
    const cursors = new Set<string>();
    const unknowns: string[] = [];
    for (let page = 0; page < 4; page++) {
      const raw = await this.read(() =>
        this.api.graph(ASSIGNED_WORK_QUERY, {
          userId: `ari:cloud:identity::user/${this.ctx.principalAccountId}`,
          after: after ?? null,
        }),
      );
      const envelope = z
        .object({
          errors: z.array(z.unknown()).optional(),
          data: z
            .object({
              atlassianUserAssignedJiraWorkItems: z.object({
                edges: z.array(
                  z.object({
                    node: z
                      .object({
                        id: z.string(),
                        title: z.string().nullable(),
                        status: z
                          .object({ name: z.string().nullable() })
                          .nullable()
                          .optional(),
                      })
                      .nullable(),
                  }),
                ),
                pageInfo: z.object({
                  hasNextPage: z.boolean(),
                  endCursor: z.string().nullable(),
                }),
              }),
            })
            .nullable()
            .optional(),
        })
        .parse(raw);
      if (envelope.errors?.length)
        unknowns.push(
          "Teamwork Graph returned partial context or a scope error.",
        );
      const connection = envelope.data?.atlassianUserAssignedJiraWorkItems;
      if (!connection) {
        unknowns.push("Teamwork Graph did not return the selected traversal.");
        break;
      }
      if (connection.edges.some((edge) => !edge.node?.title?.trim()))
        unknowns.push("Some assigned graph context could not be returned.");
      for (const edge of connection.edges)
        if (
          edge.node?.title?.trim() &&
          !items.some((i) => i.id === edge.node!.id)
        ) {
          items.push({
            id: edge.node.id,
            title: edge.node.title,
            ...(edge.node.status?.name
              ? { status: edge.node.status.name }
              : {}),
          });
          sources.push(
            source(
              this.ctx,
              "TEAMWORK_GRAPH",
              edge.node.id,
              this.clock(),
              this.clock(),
            ),
          );
        }
      if (!connection.pageInfo.hasNextPage) break;
      const cursor = connection.pageInfo.endCursor;
      if (!cursor || cursors.has(cursor)) {
        unknowns.push("Graph pagination did not advance.");
        break;
      }
      cursors.add(cursor);
      after = cursor;
      if (page === 3)
        unknowns.push("The 100-item interactive graph limit was reached.");
    }
    if (!items.length)
      unknowns.push(
        "No graph rows were returned; this does not establish that context or dependencies are absent.",
      );
    return {
      items,
      sources,
      coverage: unknowns.length ? "INCOMPLETE" : "COMPLETE",
      unknowns,
    };
  }
  /** One curated field, trying selection tiers until one validates. */
  private async curated(
    key: keyof typeof GRAPH_SELECTIONS,
    value: string,
  ): Promise<{ tier: Tier | "FAILED"; nodes: GraphNode[]; more: boolean }> {
    const spec = GRAPH_SELECTIONS[key];
    for (const [tier, selection] of spec.tiers) {
      let raw: unknown;
      try {
        raw = await this.read(() =>
          this.api.graph(curatedQuery(spec.field, spec.arg, selection), {
            value,
          }),
        );
      } catch {
        return { tier: "FAILED", nodes: [], more: false };
      }
      const envelope = z
        .object({
          errors: z.array(z.unknown()).optional(),
          data: z.record(z.string(), z.unknown()).nullable().optional(),
        })
        .safeParse(raw);
      if (!envelope.success) return { tier: "FAILED", nodes: [], more: false };
      const connection = z
        .object({
          edges: z.array(z.object({ node: graphNode.nullable() })).max(25),
          pageInfo: z.object({ hasNextPage: z.boolean() }).optional(),
        })
        .safeParse(envelope.data.data?.[spec.field]);
      // A validation error returns no data; try the next, smaller selection.
      if (!connection.success) continue;
      return {
        tier,
        nodes: connection.data.edges.flatMap((e) => (e.node ? [e.node] : [])),
        more: connection.data.pageInfo?.hasNextPage ?? false,
      };
    }
    return { tier: "FAILED", nodes: [], more: false };
  }
  async graphRelations(input: {
    projectId: string;
    issueIds: string[];
  }): Promise<GraphRelations> {
    const now = this.clock();
    const unknowns: string[] = [];
    const selections: GraphRelations["selections"] = {};
    const sources: SourceReference[] = [];
    const note = (key: string, tier: Tier | "FAILED") => {
      const prior = selections[key];
      const rank = ["DETAILED", "IDENTIFIERS", "TYPENAMES", "FAILED"];
      if (!prior || rank.indexOf(tier) > rank.indexOf(prior))
        selections[key] = tier;
    };
    const issueAri = (issueId: string) =>
      `ari:cloud:jira:${this.ctx.cloudId}:issue/${issueId}`;
    const deployments: GraphRelations["deployments"] = [];
    const goals: GraphRelations["goals"] = [];
    const issueIds = input.issueIds
      .filter((i) => externalId.safeParse(i).success)
      .slice(0, 5);
    await Promise.all(
      issueIds.map(async (issueId) => {
        const workId = `jira:${this.ctx.cloudId}:${issueId}`;
        const [d, g] = await Promise.all([
          this.curated("deployments", issueAri(issueId)),
          this.curated("goals", issueAri(issueId)),
        ]);
        note("deployments", d.tier);
        note("goals", g.tier);
        if (d.more || g.more)
          unknowns.push("More than 25 graph relations exist for some work.");
        d.nodes.forEach((n, index) =>
          deployments.push({
            workId,
            id: n.id ?? `${issueId}-deployment-${index}`,
            ...(n.displayName ? { name: n.displayName } : {}),
            ...(n.environmentType ? { environment: n.environmentType } : {}),
            ...(n.state ? { state: n.state } : {}),
            ...(n.lastUpdated ? { updatedAt: n.lastUpdated } : {}),
          }),
        );
        g.nodes.forEach((n, index) =>
          goals.push({
            workId,
            id: n.id ?? `${issueId}-goal-${index}`,
            ...(n.name ? { name: n.name } : {}),
          }),
        );
      }),
    );
    for (const item of [...deployments, ...goals])
      if (item.id.startsWith("ari:"))
        sources.push(source(this.ctx, "TEAMWORK_GRAPH", item.id, now, now));
    const teams: GraphRelations["teams"] = [];
    const t = await this.curated(
      "teams",
      `ari:cloud:jira:${this.ctx.cloudId}:project/${input.projectId}`,
    );
    note("teams", t.tier);
    for (const team of t.nodes.slice(0, 5)) {
      if (!team.id) continue;
      const m = await this.curated("members", team.id);
      note("members", m.tier);
      if (m.more) unknowns.push("Some team membership lists exceed 25 people.");
      teams.push({
        id: team.id,
        ...(team.displayName ? { name: team.displayName } : {}),
        memberAccountIds: m.nodes.flatMap((n) => {
          const match = n.id?.match(/^ari:cloud:identity::user\/(.+)$/);
          return match && id.safeParse(match[1]).success ? [match[1]!] : [];
        }),
      });
      sources.push(source(this.ctx, "TEAMWORK_GRAPH", team.id, now, now));
    }
    if (Object.values(selections).includes("FAILED"))
      unknowns.push("Some Teamwork Graph relations could not be read.");
    if (Object.values(selections).includes("TYPENAMES"))
      unknowns.push(
        "Some graph relations returned only their type; identifiers and details are unavailable.",
      );
    unknowns.push(
      "Missing graph scopes return empty results, so an empty relation list does not prove that none exist.",
    );
    return {
      deployments,
      goals,
      teams,
      selections,
      coverage: Object.values(selections).some((v) => v !== "DETAILED")
        ? "INCOMPLETE"
        : "COMPLETE",
      unknowns: [...new Set(unknowns)],
      sources,
    };
  }
  async capabilities(): Promise<Capability[]> {
    const checks = await Promise.allSettled([
      this.read(() => this.api.jira("/rest/api/3/myself")),
      this.read(() => this.api.confluence("/wiki/api/v2/spaces?limit=1")),
      this.read(() =>
        this.api.graph(
          'query Promisory_Connection { echo(myString: "Promisory") }',
          {},
        ),
      ).then((raw) => {
        const value = z
          .object({
            errors: z.array(z.unknown()).optional(),
            data: z.object({ echo: z.string() }).nullable().optional(),
          })
          .parse(raw);
        ensure(
          !value.errors?.length && value.data?.echo === "Promisory",
          "GRAPH_UNAVAILABLE",
          "Graph transport did not confirm the probe.",
        );
        return value;
      }),
    ]);
    return [
      "Jira user access",
      "Confluence connection",
      "Teamwork Graph transport",
    ].map((key, index) => ({
      key,
      state:
        checks[index]?.status === "fulfilled" ? "AVAILABLE" : "UNAVAILABLE",
      detail:
        checks[index]?.status === "fulfilled"
          ? index === 2
            ? "Graph transport responded; the curated query is checked separately."
            : "Authenticated current-user read succeeded."
          : "Unavailable for this installation or current user.",
    }));
  }
}
/** Documented curated traversal. Results and all derivatives stay inside Forge and the Atlassian UI. */
export const ASSIGNED_WORK_QUERY = `query Promisory_AssignedWork($userId: ID!, $after: String) {
  atlassianUserAssignedJiraWorkItems(userId: $userId, first: 25, after: $after) {
    edges { node { ... on JiraWorkItem { id title: summary status { name } } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const fieldName = z.string().regex(/^[A-Za-z0-9_.:-]{1,64}$/);
/**
 * Reduce a Forge product event to metadata: stable IDs, change kind and the
 * names of changed fields. Values, summaries, bodies and actors are dropped.
 * Unknown shapes return undefined rather than guessing.
 */
export function parseSourceEvent(
  event: unknown,
  observedAt: string,
):
  | {
      source: "JIRA_ISSUE" | "JIRA_LINK" | "CONFLUENCE_PAGE";
      kind: "CREATED" | "UPDATED" | "DELETED";
      sourceId: string;
      relatedSourceIds: string[];
      fields: string[];
      observedAt: string;
    }
  | undefined {
  const parsed = z
    .object({
      eventType: z.string().optional(),
      issue: z.object({ id: z.coerce.string() }).optional(),
      changelog: z
        .object({
          items: z
            .array(
              z.object({
                fieldId: z.string().optional(),
                field: z.string().optional(),
              }),
            )
            .max(200)
            .optional(),
        })
        .optional(),
      issueLink: z
        .object({
          id: z.coerce.string(),
          sourceIssueId: z.coerce.string(),
          destinationIssueId: z.coerce.string(),
        })
        .optional(),
      id: z.coerce.string().optional(),
      sourceIssueId: z.coerce.string().optional(),
      destinationIssueId: z.coerce.string().optional(),
      content: z.object({ id: z.coerce.string() }).optional(),
    })
    .safeParse(event);
  if (!parsed.success) return undefined;
  const e = parsed.data;
  const type = e.eventType ?? "";
  const kind = /:created:/.test(type)
    ? "CREATED"
    : /:deleted:/.test(type)
      ? "DELETED"
      : "UPDATED";
  const numeric = (v: string | undefined) =>
    v && /^\d{1,20}$/.test(v) ? v : undefined;
  const link =
    e.issueLink ??
    (e.sourceIssueId && e.destinationIssueId && e.id
      ? {
          id: e.id,
          sourceIssueId: e.sourceIssueId,
          destinationIssueId: e.destinationIssueId,
        }
      : undefined);
  if (/issuelink/.test(type) && link) {
    const ends = [
      numeric(link.sourceIssueId),
      numeric(link.destinationIssueId),
    ];
    const linkId = numeric(link.id);
    if (!linkId || ends.some((x) => !x)) return undefined;
    return {
      source: "JIRA_LINK",
      kind,
      sourceId: linkId,
      relatedSourceIds: ends as string[],
      fields: [],
      observedAt,
    };
  }
  if (e.issue) {
    const issueId = numeric(e.issue.id);
    if (!issueId) return undefined;
    const fields = [
      ...new Set(
        (e.changelog?.items ?? []).flatMap((i) => {
          const name = fieldName.safeParse(i.fieldId ?? i.field);
          return name.success ? [name.data] : [];
        }),
      ),
    ].slice(0, 20);
    return {
      source: "JIRA_ISSUE",
      kind,
      sourceId: issueId,
      relatedSourceIds: [],
      fields,
      observedAt,
    };
  }
  if (e.content) {
    const pageId = numeric(e.content.id);
    if (!pageId) return undefined;
    return {
      source: "CONFLUENCE_PAGE",
      kind,
      sourceId: pageId,
      relatedSourceIds: [],
      fields: [],
      observedAt,
    };
  }
  return undefined;
}
