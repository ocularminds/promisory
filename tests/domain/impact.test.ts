import { describe, it, expect } from "vitest";
import {
  activeVersion,
  assessImpact,
  tracePaths,
  validateNativeHierarchy,
} from "@promisory/domain";
import { commitmentRecordSchema } from "@promisory/contracts";
import {
  createExample,
  EXAMPLE_CLOCK,
  exampleSource,
} from "@promisory/test-fixtures";

describe("typed hierarchy and deterministic impact", () => {
  it("traces a child toward its actual ancestors without treating siblings as descendants", async () => {
    const { sources } = await createExample();
    const task = sources.workItems.find((w) => w.externalId === "121")!;
    const story = sources.workItems.find((w) => w.externalId === "110")!;
    const epic = sources.workItems.find((w) => w.externalId === "100")!;
    const parent = {
      id: "native-above-epic",
      fromId: "native-initiative",
      toId: epic.id,
      fromKind: "WORK" as const,
      toKind: "WORK" as const,
      kind: "PARENT_OF" as const,
      state: "CONFIRMED" as const,
      provenance: exampleSource("native-parent"),
    };
    const edges = [
      ...sources.edges.filter((edge) => edge.kind === "PARENT_OF"),
      parent,
    ];
    expect(
      tracePaths(task.id, new Set(["native-initiative"]), edges).paths[0]
        ?.nodeIds,
    ).toEqual([task.id, epic.id, "native-initiative"]);
    expect(tracePaths(epic.id, new Set([story.id]), edges).paths).toEqual([]);
    expect(tracePaths(task.id, new Set([story.id]), edges).paths).toEqual([]);
    expect(
      tracePaths(task.id, new Set([story.id]), sources.edges).paths[0]?.edgeIds,
    ).toEqual(["implements-121-110"]);
    expect(parent.fromId).toBe("native-initiative");
  });
  it("keeps stories, tasks, and bugs as peers and the real subtask below its task", async () => {
    const { sources } = await createExample(),
      work = sources.workItems;
    const standard = work.filter((w) =>
      ["STORY", "TASK", "BUG"].includes(w.type),
    );
    expect(new Set(standard.map((w) => w.parentId)).size).toBe(1);
    expect(standard.every((w) => w.hierarchyLevel === 0)).toBe(true);
    expect(work.find((w) => w.type === "SUBTASK")?.parentId).toBe(
      work.find((w) => w.type === "TASK")?.id,
    );
    expect(validateNativeHierarchy(work, sources.edges)).toEqual([]);
    const task = work.find((w) => w.type === "TASK")!,
      bug = work.find((w) => w.type === "BUG")!;
    expect(
      validateNativeHierarchy(work, [
        {
          id: "fabricated",
          fromId: task.id,
          toId: bug.id,
          fromKind: "WORK",
          toKind: "WORK",
          kind: "PARENT_OF",
          state: "CONFIRMED",
          provenance: exampleSource("fake"),
        },
      ]),
    ).toEqual(["fabricated"]);
  });
  it("deduplicates a shared blocker and retains the reason and unknown coverage together", async () => {
    const fixture = await createExample(),
      c = activeVersion(
        (await fixture.repo.get(
          "commitment",
          "PM-101",
          commitmentRecordSchema,
        ))!.value,
      )!;
    const result = assessImpact({
      commitment: c,
      work: fixture.sources.workItems,
      edges: [...fixture.sources.edges, ...fixture.sources.edges],
      coverage: "INCOMPLETE",
      now: EXAMPLE_CLOCK,
    });
    expect(result.health).toBe("AT_RISK");
    expect(result.coverage).toBe("INCOMPLETE");
    expect(
      result.reasons.filter((r) => r.code === "BLOCKING_DEFECT"),
    ).toHaveLength(1);
    expect(result.reasons.map((r) => r.code)).toContain(
      "DELIVERY_AFTER_PROMISE",
    );
    expect(result.paths.some((p) => p.nodeIds[0]?.endsWith(":137"))).toBe(true);
  });
  it("reports a known breach even with stale sources", async () => {
    const fixture = await createExample(),
      c = activeVersion(
        (await fixture.repo.get(
          "commitment",
          "PM-101",
          commitmentRecordSchema,
        ))!.value,
      )!;
    const result = assessImpact({
      commitment: c,
      work: fixture.sources.workItems,
      edges: fixture.sources.edges,
      coverage: "COMPLETE",
      now: "2026-11-21T09:00:00Z",
    });
    expect(result.health).toBe("BREACHED");
    expect(result.coverage).toBe("INCOMPLETE");
    expect(result.reasons.map((r) => r.code)).toContain("STALE_EVIDENCE");
  });
  it("never converts missing data to on-track", async () => {
    const fixture = await createExample(),
      c = activeVersion(
        (await fixture.repo.get(
          "commitment",
          "PM-102",
          commitmentRecordSchema,
        ))!.value,
      )!;
    expect(
      assessImpact({
        commitment: c,
        work: [],
        edges: [],
        coverage: "UNKNOWN",
        now: EXAMPLE_CLOCK,
      }).health,
    ).toBe("UNKNOWN");
  });
  it("ignores model-suggested dependencies until confirmed", async () => {
    const fixture = await createExample(),
      c = activeVersion(
        (await fixture.repo.get(
          "commitment",
          "PM-101",
          commitmentRecordSchema,
        ))!.value,
      )!;
    const edges = fixture.sources.edges.map((e) =>
      e.kind === "BLOCKS" ? { ...e, state: "DISCOVERED" as const } : e,
    );
    const result = assessImpact({
      commitment: c,
      work: fixture.sources.workItems,
      edges,
      coverage: "COMPLETE",
      now: EXAMPLE_CLOCK,
    });
    expect(result.reasons.map((r) => r.code)).not.toContain("BLOCKING_DEFECT");
  });
  it("terminates cycles and declares exhausted budgets", () => {
    const edge = (from: string, to: string) => ({
      id: `${from}-${to}`,
      fromId: from,
      toId: to,
      fromKind: "WORK" as const,
      toKind: "WORK" as const,
      kind: "BLOCKS" as const,
      state: "CONFIRMED" as const,
      provenance: exampleSource("edge"),
    });
    expect(
      tracePaths("a", new Set(["z"]), [edge("a", "b"), edge("b", "a")]).cycles,
    ).toHaveLength(1);
    expect(
      tracePaths("a", new Set(["z"]), [edge("a", "b"), edge("b", "c")], {
        depth: 1,
        nodes: 5,
        paths: 5,
      }).truncated,
    ).toBe(true);
  });
});
