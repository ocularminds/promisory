import { z } from "zod";
import {
  externalId,
  id,
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
  async canEdit(issueId: string): Promise<boolean> {
    const result = permissionSchema.parse(
      await this.read(() =>
        this.api.jira(
          `/rest/api/3/mypermissions?issueId=${externalId.parse(issueId)}&permissions=EDIT_ISSUES`,
        ),
      ),
    );
    return result.permissions.EDIT_ISSUES?.havePermission === true;
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
