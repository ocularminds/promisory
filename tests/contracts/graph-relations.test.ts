import { describe, expect, it } from "vitest";
import {
  AtlassianSources,
  type UserTransport,
} from "@promisory/integrations-atlassian";
import {
  exampleContext,
  EXAMPLE_CLOCK,
  EXAMPLE_CLOUD,
} from "@promisory/test-fixtures";

const response = (body: unknown, status = 200) => ({
  status,
  ok: status < 300,
  headers: { get: () => null },
  json: async () => body,
});
const connection = (field: string, nodes: unknown[]) => ({
  data: {
    [field]: {
      edges: nodes.map((node) => ({ node })),
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
});
const validationError = {
  errors: [{ message: "Unknown type 'ExternalDeployment'" }],
  data: null,
};

/** Synthetic tenant responses; not live Teamwork Graph evidence. */
function transport(
  answer: (query: string, variables: Record<string, unknown>) => unknown,
): UserTransport & { queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    jira: async () => response({}, 403),
    confluence: async () => response({}, 403),
    graph: async (query, variables) => {
      queries.push(query);
      const body = answer(query, variables as Record<string, unknown>);
      return body instanceof Error ? response({}, 503) : response(body);
    },
  };
}

describe("Teamwork Graph relations, synthetic contracts", () => {
  it("falls back to a smaller selection, records the answering tier, and keeps graph lineage inside Atlassian", async () => {
    const api = transport((query) => {
      if (query.includes("jiraWorkItemLinkedExternalDeployments"))
        return query.includes("displayName")
          ? validationError
          : connection("jiraWorkItemLinkedExternalDeployments", [
              {
                __typename: "ExternalDeployment",
                id: "ari:cloud:graph::deployment/1",
              },
            ]);
      if (query.includes("jiraWorkItemGoals"))
        return connection("jiraWorkItemGoals", [
          {
            __typename: "AtlassianGoal",
            id: "ari:cloud:townsquare::goal/7",
            name: "Self-service activation",
          },
        ]);
      if (query.includes("atlassianTeamsBySpace"))
        return connection("atlassianTeamsBySpace", [
          {
            __typename: "AtlassianTeam",
            id: "ari:cloud:identity::team/abc",
            displayName: "Merchant platform",
          },
        ]);
      if (query.includes("atlassianTeamMembers"))
        return connection("atlassianTeamMembers", [
          { __typename: "AtlassianUser", id: "ari:cloud:identity::user/maya" },
          { __typename: "AtlassianUser", id: "not-a-user-ari" },
        ]);
      return { data: null };
    });
    const relations = await new AtlassianSources(
      exampleContext(),
      api,
      () => EXAMPLE_CLOCK,
    ).graphRelations({ projectId: "10000", issueIds: ["121", "../x"] });

    expect(relations.selections).toEqual({
      deployments: "IDENTIFIERS",
      goals: "DETAILED",
      teams: "DETAILED",
      members: "IDENTIFIERS",
    });
    expect(relations.deployments).toEqual([
      {
        workId: `jira:${EXAMPLE_CLOUD}:121`,
        id: "ari:cloud:graph::deployment/1",
      },
    ]);
    expect(relations.goals[0]).toMatchObject({
      name: "Self-service activation",
    });
    expect(relations.teams).toEqual([
      {
        id: "ari:cloud:identity::team/abc",
        name: "Merchant platform",
        memberAccountIds: ["maya"],
      },
    ]);
    expect(relations.coverage).toBe("INCOMPLETE");
    expect(relations.sources.every((s) => s.lineage === "ATLASSIAN_ONLY")).toBe(
      true,
    );
    // Only the valid numeric issue was queried; the hostile ID never reached the graph.
    expect(api.queries.join("\n")).not.toContain("../x");
    expect(relations.unknowns.some((u) => u.includes("does not prove"))).toBe(
      true,
    );
  });

  it("reports failures explicitly instead of an empty, healthy answer", async () => {
    const relations = await new AtlassianSources(
      exampleContext(),
      transport(() => new Error("unavailable")),
      () => EXAMPLE_CLOCK,
    ).graphRelations({ projectId: "10000", issueIds: ["121"] });
    expect(relations.deployments).toEqual([]);
    expect(relations.selections.deployments).toBe("FAILED");
    expect(relations.coverage).toBe("INCOMPLETE");
    expect(relations.unknowns).toContain(
      "Some Teamwork Graph relations could not be read.",
    );
  });
});
