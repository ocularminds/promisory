import { describe, expect, it } from "vitest";
import type { GraphRelations } from "@promisory/domain";
import { createExample } from "@promisory/test-fixtures";

describe("graph.relations command", () => {
  it("returns relations for visible supporting work and refuses a commitment whose work became restricted", async () => {
    const f = await createExample();
    const relations = (await f.service.run("graph.relations", {
      projectId: "10000",
      commitmentId: "PM-101",
    })) as GraphRelations;
    expect(relations.deployments).toHaveLength(1);
    expect(relations.unknowns[0]).toContain("Illustrative");

    f.sources.hiddenWork.add("121");
    await expect(
      f.service.run("graph.relations", {
        projectId: "10000",
        commitmentId: "PM-101",
      }),
    ).rejects.toThrow("unavailable with your current access");
  });
  it("rejects unknown commitments and identity overrides", async () => {
    const f = await createExample();
    await expect(
      f.service.run("graph.relations", {
        projectId: "10000",
        commitmentId: "PM-999",
      }),
    ).rejects.toThrow();
    await expect(
      f.service.run("graph.relations", {
        projectId: "10000",
        commitmentId: "PM-101",
        principalAccountId: "jon",
      }),
    ).rejects.toThrow();
  });
});
