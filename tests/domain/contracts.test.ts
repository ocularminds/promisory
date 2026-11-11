import { describe, it, expect } from "vitest";
import {
  deadlineFromLocal,
  commands,
  sourceSchema,
  edgeSchema,
  commitmentRecordSchema,
  projectRecordSchema,
} from "@promisory/contracts";
import {
  canonicalJson,
  hash,
  MemoryStore,
  Repository,
} from "@promisory/domain";
import {
  exampleContext,
  exampleSource,
  createExample,
} from "@promisory/test-fixtures";

describe("strict versioned command boundaries", () => {
  it("rejects tenant, principal, policy, and arbitrary endpoint overrides", () => {
    for (const key of [
      "organizationId",
      "accountId",
      "executionMode",
      "url",
      "approverRole",
    ])
      expect(() =>
        commands["workspace.read"].parse({
          projectId: "10000",
          [key]: "forged",
        }),
      ).toThrow();
    expect(() =>
      commands["proposal.prepare"].parse({
        commitmentId: "PM-101",
        expectedRevision: 1,
        issueId: "121",
        desiredDueDate: "2026-02-30",
        alternative: "REPAIR",
      }),
    ).toThrow();
  });
  it("requires a real date, explicit cutoff, and an IANA zone", () => {
    expect(deadlineFromLocal("2026-11-20", "17:00", "Europe/Stockholm")).toBe(
      "2026-11-20T16:00:00Z",
    );
    for (const [date, time, zone] of [
      ["2026-02-30", "17:00", "UTC"],
      ["2026-11-20", "", "Europe/Stockholm"],
      ["2026-11-20", "17:00", "CET"],
      ["2026-03-29", "02:30", "Europe/Stockholm"],
      ["2026-10-25", "02:30", "Europe/Stockholm"],
    ])
      expect(() => deadlineFromLocal(date!, time!, zone!)).toThrow();
  });
  it("rejects graph provenance laundering and fabricated hierarchy", () => {
    expect(() =>
      sourceSchema.parse({
        ...exampleSource("graph", "TEAMWORK_GRAPH"),
        lineage: "PERMITTED_REST_EVIDENCE",
      }),
    ).toThrow();
    expect(() =>
      edgeSchema.parse({
        id: "fake",
        fromId: "page",
        toId: "task",
        fromKind: "ARTIFACT",
        toKind: "WORK",
        kind: "PARENT_OF",
        state: "CONFIRMED",
        provenance: exampleSource("page", "CONFLUENCE"),
      }),
    ).toThrow();
  });
  it("canonicalizes object order and rejects undefined, cycles, and nonfinite numbers", async () => {
    expect(await hash({ b: 2, a: 1 })).toBe(await hash({ a: 1, b: 2 }));
    expect(await hash({ a: [1, 2] })).not.toBe(await hash({ a: [2, 1] }));
    expect(() => canonicalJson({ token: undefined })).toThrow();
    expect(() => canonicalJson({ amount: NaN })).toThrow();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow();
  });
});
describe("repository isolation and codec gates", () => {
  it("migrates additive v1 fields without rewriting agreements or allowing an unknown-origin proposal to leave Atlassian", async () => {
    const fixture = await createExample();
    await fixture.service.run("proposal.prepare", {
      commitmentId: "PM-101",
      expectedRevision: 1,
      issueId: "121",
      desiredDueDate: "2026-11-23",
      alternative: "REPAIR",
    });
    const stored = (await fixture.repo.get(
      "commitment",
      "PM-101",
      commitmentRecordSchema,
    ))!;
    const legacy = JSON.parse(JSON.stringify(stored.value));
    delete legacy.proposals[0].effectOrigin;
    for (const version of legacy.versions) delete version.sourceBasis;
    const decoded = commitmentRecordSchema.parse(legacy);
    expect(decoded.proposals[0]?.effectOrigin).toBe("ATLASSIAN_ONLY");
    expect(decoded.versions[0]?.sourceBasis).toEqual([]);
    expect(decoded.versions[0]?.originalDueAt).toBe(
      stored.value.versions[0]?.originalDueAt,
    );
    const project = JSON.parse(
      JSON.stringify(
        (await fixture.repo.get("project", "10000", projectRecordSchema))!
          .value,
      ),
    );
    delete project.requirementHistory;
    delete project.gateHistory;
    expect(projectRecordSchema.parse(project)).toMatchObject({
      requirementHistory: [],
      gateHistory: [],
    });
  });
  it("round-trips accepted contracts and refuses unsupported schema versions", async () => {
    const fixture = await createExample();
    const record = (await fixture.repo.get(
      "commitment",
      "PM-101",
      commitmentRecordSchema,
    ))!;
    expect(
      commitmentRecordSchema.parse(JSON.parse(JSON.stringify(record.value))),
    ).toEqual(record.value);
    expect(() =>
      commitmentRecordSchema.parse({
        ...record.value,
        schemaVersion: "promisory.v2",
      }),
    ).toThrow();
  });
  it("isolates installation, environment, app, and cloud but shares data across authorized principals", async () => {
    const fixture = await createExample();
    expect(
      await new Repository(fixture.raw, exampleContext("jon")).get(
        "commitment",
        "PM-101",
        commitmentRecordSchema,
      ),
    ).toBeDefined();
    for (const override of [
      { installationId: "reinstalled" },
      { environmentId: "production" },
      { appId: "another-app" },
      { cloudId: "913b15d7-6b44-478a-849b-1498ab0db6db" },
    ])
      expect(
        await new Repository(fixture.raw, {
          ...exampleContext(),
          ...override,
        }).get("commitment", "PM-101", commitmentRecordSchema),
      ).toBeUndefined();
  });
  it("allows only one winner for concurrent optimistic writes", async () => {
    const fixture = await createExample();
    const current = (await fixture.repo.get(
      "commitment",
      "PM-101",
      commitmentRecordSchema,
    ))!;
    const outcomes = await Promise.allSettled([
      fixture.repo.save(
        "commitment",
        "PM-101",
        current.revision,
        current.value,
        commitmentRecordSchema,
      ),
      fixture.repo.save(
        "commitment",
        "PM-101",
        current.revision,
        current.value,
        commitmentRecordSchema,
      ),
    ]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
});
