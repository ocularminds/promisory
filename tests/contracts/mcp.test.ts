import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

vi.mock("../../apps/forge/src/context", () => ({ serviceFor: vi.fn() }));
vi.mock("../../apps/forge/src/diagnostics", () => ({ reportFailure: vi.fn() }));
const { externalProjection } = await import("../../apps/forge/src/rovo");

const manifest = parse(
  readFileSync(
    new URL("../../apps/forge/manifest.yml", import.meta.url),
    "utf8",
  ),
) as {
  modules: {
    "rovo:mcp": Array<{ key: string; tools: string[] }>;
    action: Array<{ key: string; actionVerb: string; function: string }>;
    function: Array<{ key: string; handler: string }>;
  };
};

describe("Atlassian MCP exposure", () => {
  it("exposes only read-only tools backed by the shared Rovo handlers", () => {
    const [server] = manifest.modules["rovo:mcp"];
    expect(server).toBeDefined();
    expect(manifest.modules["rovo:mcp"]).toHaveLength(1);
    for (const tool of server!.tools) {
      const action = manifest.modules.action.find((a) => a.key === tool);
      expect(action?.actionVerb).toBe("GET");
      const fn = manifest.modules.function.find(
        (f) => f.key === action!.function,
      );
      expect(fn?.handler).toMatch(/^rovo\.mcp[A-Z]/);
    }
    expect(server!.tools).not.toContain("promisory-propose");
    expect(server!.tools).not.toContain("promisory-recovery");
  });

  it("removes Teamwork Graph data, graph source references and Rovo-origin proposals before external serialization", () => {
    const projected = externalProjection({
      result: {
        assessments: [{ commitmentId: "PM-101", health: "AT_RISK" }],
        graph: {
          items: [{ id: "ari:cloud:jira:x:issue/1", title: "graph title" }],
        },
        graphRelations: { deployments: [{ id: "d" }] },
        graphRelationsNote: "x",
        people: [{ accountId: "maya" }],
        graphTeams: [{ id: "team" }],
        proposals: [
          { id: "p1", effectOrigin: "USER_AUTHORED" },
          { id: "p2", effectOrigin: "ROVO" },
        ],
      },
      sourceReferences: [
        { source: "JIRA", sourceId: "1", lineage: "ATLASSIAN_ONLY" },
        { source: "TEAMWORK_GRAPH", sourceId: "g", lineage: "ATLASSIAN_ONLY" },
      ],
    });
    const text = JSON.stringify(projected);
    expect(text).not.toContain("graph title");
    expect(text).not.toContain("TEAMWORK_GRAPH");
    expect(text).not.toContain("graphRelations");
    expect(text).not.toContain("graphTeams");
    expect(text).not.toContain('"p2"');
    expect(text).toContain('"p1"');
    expect(text).toContain("AT_RISK");
    expect(text).toContain("maya");
  });
});
