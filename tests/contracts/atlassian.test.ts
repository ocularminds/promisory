import { describe, expect, it, vi } from "vitest";
import {
  AtlassianSources,
  normalizeIssue,
  workId,
  type UserTransport,
} from "@promisory/integrations-atlassian";
import {
  exampleContext,
  EXAMPLE_CLOCK,
  EXAMPLE_CLOUD,
} from "@promisory/test-fixtures";

const project = { id: "10000", key: "PILOT", name: "Contract fixture only" };
const types = [
  { id: "1", name: "Portfolio initiative", hierarchyLevel: 2 },
  { id: "2", name: "Feature collection", hierarchyLevel: 1 },
  { id: "3", name: "Story", hierarchyLevel: 0 },
  { id: "4", name: "Task", hierarchyLevel: 0 },
  { id: "5", name: "Bug", hierarchyLevel: 0 },
  { id: "6", name: "Implementation step", hierarchyLevel: -1, subtask: true },
];
function issue(id: string, type: number, parent?: string) {
  return {
    id,
    key: `PILOT-${id}`,
    fields: {
      summary: `Fixture work ${id}`,
      updated: EXAMPLE_CLOCK,
      project,
      issuetype: types[type - 1]!,
      status: {
        id: "open",
        name: "In progress",
        statusCategory: { key: "indeterminate" },
      },
      assignee: null,
      duedate: null,
      ...(parent ? { parent: { id: parent } } : {}),
      issuelinks: [] as Array<Record<string, unknown>>,
    },
  };
}
const response = (
  body: unknown,
  status = 200,
  retryAfter: string | null = null,
) => ({
  status,
  ok: status < 300,
  headers: { get: () => retryAfter },
  json: async () => body,
});
const transport = (jira: UserTransport["jira"]): UserTransport => ({
  jira,
  confluence: async () => response({}, 403),
  graph: async () => response({}, 403),
});

describe("Atlassian REST and graph adapters, synthetic response contracts", () => {
  it("uses configured levels above epics, real standard peers, paginated IDs and an explicit deduplicated Blocks link", async () => {
    const task = issue("121", 4, "100"),
      bug = issue("137", 5, "100");
    const block = {
      id: "70",
      type: {
        id: "9",
        name: "Blocks",
        inward: "is blocked by",
        outward: "blocks",
      },
    };
    task.fields.issuelinks = [{ ...block, inwardIssue: { id: "137" } }];
    bug.fields.issuelinks = [{ ...block, outwardIssue: { id: "121" } }];
    const searches: Record<string, unknown>[] = [];
    const api = transport(async (path, options) => {
      if (path === "/rest/api/3/project/10000") return response(project);
      if (path === "/rest/api/3/issuetype/project?projectId=10000")
        return response(types);
      expect(path).toBe("/rest/api/3/search/jql");
      expect(options?.method).toBe("POST");
      const body = JSON.parse(options!.body!);
      searches.push(body);
      return body.nextPageToken
        ? response({
            issues: [task, bug, issue("122", 6, "121")],
            isLast: true,
          })
        : response({
            issues: [
              issue("99", 1),
              issue("100", 2, "99"),
              issue("110", 3, "100"),
              task,
            ],
            nextPageToken: "page-two",
            isLast: false,
          });
    });
    const sources = new AtlassianSources(
      exampleContext(),
      api,
      () => EXAMPLE_CLOCK,
    );
    const imported = await sources.importWork("10000");
    expect(imported.coverage).toBe("COMPLETE");
    expect(imported.work).toHaveLength(6);
    expect(searches.map((body) => body.nextPageToken)).toEqual([
      undefined,
      "page-two",
    ]);
    const peers = imported.work.filter((work) => work.hierarchyLevel === 0);
    expect(new Set(peers.map((work) => work.parentId))).toEqual(
      new Set([workId(EXAMPLE_CLOUD, "100")]),
    );
    expect(
      imported.work.find((work) => work.externalId === "99")?.hierarchyLevel,
    ).toBe(2);
    expect(imported.work.find((work) => work.externalId === "100")?.type).toBe(
      "EPIC",
    );
    expect(
      imported.edges.filter((edge) => edge.kind === "BLOCKS"),
    ).toMatchObject([
      {
        fromId: workId(EXAMPLE_CLOUD, "137"),
        toId: workId(EXAMPLE_CLOUD, "121"),
      },
    ]);
    const copy = await sources.work("121");
    copy.title = "Cannot mutate invocation cache";
    expect((await sources.work("121")).title).toBe("Fixture work 121");
  });
  it("ends a repeated pagination cursor and reports omitted dependencies without inventing links", async () => {
    const raw = issue("121", 4, "999");
    raw.fields.issuelinks = [
      {
        id: "8",
        type: {
          id: "9",
          name: "Blocks",
          outward: "blocks",
          inward: "is blocked by",
        },
        outwardIssue: { id: "404" },
      },
    ];
    let pages = 0;
    const api = transport(async (path) =>
      path.includes("/project/10000")
        ? response(project)
        : path.includes("issuetype")
          ? response(types)
          : (pages++,
            response({ issues: [raw], nextPageToken: "same", isLast: false })),
    );
    const result = await new AtlassianSources(
      exampleContext(),
      api,
      () => EXAMPLE_CLOCK,
    ).importWork("10000");
    expect(pages).toBe(2);
    expect(result.work).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.coverage).toBe("INCOMPLETE");
    expect(result.unknowns.join(" ")).toMatch(
      /pagination.*parents.*dependencies/s,
    );
  });
  it("keeps issue identity through key changes and project moves, and separates identical IDs across sites", () => {
    const before = issue("121", 4),
      renamed = structuredClone(before);
    renamed.key = "MOVED-7";
    renamed.fields.project = {
      id: "20000",
      key: "MOVED",
      name: "Other project",
    };
    const a = normalizeIssue(before, exampleContext(), types, EXAMPLE_CLOCK),
      b = normalizeIssue(renamed, exampleContext(), types, EXAMPLE_CLOCK);
    expect(a.id).toBe(b.id);
    expect(b.displayKey).toBe("MOVED-7");
    expect(b.projectId).toBe("20000");
    expect(
      normalizeIssue(
        before,
        {
          ...exampleContext(),
          cloudId: "2810706a-f4e7-4c53-a24b-57b365291d48",
        },
        types,
        EXAMPLE_CLOCK,
      ).id,
    ).not.toBe(a.id);
  });
  it("does not reuse a prior principal's permission result and refuses missing/deleted pages without reading their bodies", async () => {
    const body = vi.fn(async () => ({ sensitive: "must never be parsed" }));
    const api = transport(async () => response(project));
    api.confluence = async () => ({ ...response({}, 403), json: body });
    const denied = new AtlassianSources(exampleContext("owen"), api);
    await expect(denied.page("203")).rejects.toThrow("current access");
    expect(body).not.toHaveBeenCalled();
    const good = {
      ...api,
      confluence: async () =>
        response({
          id: "203",
          spaceId: "2",
          title: "Allowed PRD",
          version: { number: 4 },
          body: { storage: { value: "<p>Mapped source</p>" } },
        }),
    };
    const allowed = new AtlassianSources(
      exampleContext("maya"),
      good,
      () => EXAMPLE_CLOCK,
    );
    expect((await allowed.page("203")).revision).toBe("4");
    await expect(denied.page("203")).rejects.toThrow("current access");
    api.confluence = async () => response({}, 429, "3600");
    await expect(
      new AtlassianSources(exampleContext(), api).page("203"),
    ).rejects.toThrow("later retry");
  });
  it("binds graph traversal to the current principal, paginates and keeps errors, null nodes and lineage explicit", async () => {
    const api = transport(async () => response({}));
    const graph = vi.fn<UserTransport["graph"]>(async (_query, variables) => {
      const node = {
        id: `ari:cloud:jira:${EXAMPLE_CLOUD}:issue/121`,
        title: "Current-user result",
        status: { name: "Open" },
      };
      expect(_query).toMatch(/title:\s*summary/);
      return response({
        ...(variables.after
          ? {}
          : { errors: [{ message: "Permission-filtered partial traversal" }] }),
        data: {
          atlassianUserAssignedJiraWorkItems: {
            edges: variables.after
              ? [{ node }]
              : [
                  { node },
                  { node: null },
                  {
                    node: {
                      id: "redacted-node",
                      title: null,
                      status: { name: null },
                    },
                  },
                ],
            pageInfo: {
              hasNextPage: !variables.after,
              endCursor: variables.after ? null : "next",
            },
          },
        },
      });
    });
    api.graph = graph;
    const result = await new AtlassianSources(
      exampleContext("owen"),
      api,
      () => EXAMPLE_CLOCK,
    ).graph();
    expect(graph.mock.calls.map((call) => call[1])).toEqual([
      { userId: "ari:cloud:identity::user/owen", after: null },
      { userId: "ari:cloud:identity::user/owen", after: "next" },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.coverage).toBe("INCOMPLETE");
    expect(result.unknowns).toHaveLength(2);
    expect(result.sources[0]).toMatchObject({
      source: "TEAMWORK_GRAPH",
      lineage: "ATLASSIAN_ONLY",
      visibility: "CURRENT_USER",
    });
    api.graph = async () =>
      response({ data: null, errors: [{ message: "missing scope" }] });
    const empty = await new AtlassianSources(exampleContext(), api).graph();
    expect(empty.coverage).toBe("INCOMPLETE");
    expect(empty.items).toHaveLength(0);
    const capabilities = await new AtlassianSources(
      exampleContext(),
      api,
    ).capabilities();
    expect(
      capabilities.find(
        (capability) => capability.key === "Teamwork Graph transport",
      )?.state,
    ).toBe("UNAVAILABLE");
  });
  it("uses operation names accepted by the live graph service for probes and traversal", async () => {
    const api = transport(async () => response({}));
    api.graph = vi.fn(async (query) => {
      const name = query.match(/^query ([A-Za-z0-9_]+)/)?.[1];
      if (
        !name ||
        !/^[A-Za-z0-9]{3,}_[A-Za-z0-9]{4,}$/.test(name) ||
        name.length > 100
      )
        return response({
          errors: [{ message: "Operation name format rejected" }],
        });
      return query.includes("echo(")
        ? response({ data: { echo: "Promisory" } })
        : response({
            data: {
              atlassianUserAssignedJiraWorkItems: {
                edges: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          });
    });
    const sources = new AtlassianSources(exampleContext(), api);
    expect(
      (await sources.capabilities()).find(
        (c) => c.key === "Teamwork Graph transport",
      )?.state,
    ).toBe("AVAILABLE");
    const graph = await sources.graph();
    expect(graph.unknowns).toEqual([
      "No graph rows were returned; this does not establish that context or dependencies are absent.",
    ]);
  });
});
