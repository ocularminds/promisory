import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  commitmentRecordSchema,
  projectRecordSchema,
  type CommitmentRecord,
} from "@promisory/contracts";
import {
  anonymizeClosedAccounts,
  collectAccounts,
  PromisoryService,
  purgeExpired,
  retentionStart,
  UnconfiguredExecutor,
} from "@promisory/domain";
import {
  createExample,
  exampleContext,
  EXAMPLE_CLOCK,
} from "@promisory/test-fixtures";

const later = (days: number) =>
  new Date(Date.parse(EXAMPLE_CLOCK) + days * 86_400_000).toISOString();
const read = async (f: Awaited<ReturnType<typeof createExample>>, id: string) =>
  (await f.repo.get("commitment", id, commitmentRecordSchema))?.value;

describe("retention", () => {
  it("keeps active commitments and unresolved changes, and starts the clock at closure or verification", async () => {
    const f = await createExample();
    expect(retentionStart((await read(f, "PM-101"))!)).toBeUndefined();
    expect(retentionStart((await read(f, "PM-104"))!)).toBe(
      Date.parse("2026-11-17T14:00:00.000Z"),
    );
    const pending = structuredClone((await read(f, "PM-104"))!);
    pending.operations.push({ stage: "RECONCILING" } as never);
    expect(retentionStart(pending)).toBeUndefined();
  });
  it("deletes only records past the configured period", async () => {
    const f = await createExample();
    await f.as("alex").run("commitment.cancel", {
      commitmentId: "PM-103",
      expectedRevision: 1,
      reason: "Handover moved to another programme.",
    });
    expect(await purgeExpired(f.repo, later(30))).toEqual({ deleted: 0 });
    expect(await purgeExpired(f.repo, later(200))).toEqual({ deleted: 2 });
    expect(await read(f, "PM-103")).toBeUndefined(); // cancelled
    expect(await read(f, "PM-104")).toBeUndefined(); // verified
    expect(await read(f, "PM-101")).toBeDefined(); // active
    expect(await read(f, "PM-102")).toBeDefined(); // active
  });
  it("refuses to delete a record that changed since it was read", async () => {
    const f = await createExample();
    await expect(f.repo.remove("commitment", "PM-104", 99)).rejects.toThrow(
      "changed",
    );
    expect(await read(f, "PM-104")).toBeDefined();
  });
});

describe("personal data", () => {
  it("reports stored account IDs, excluding system principals", async () => {
    const f = await createExample();
    await f.service.run("inbox.preferences", {
      quietStart: 22,
      quietEnd: 7,
      timeZone: "Europe/Stockholm",
    });
    const ids = (await collectAccounts(f.repo, EXAMPLE_CLOCK)).map(
      (a) => a.accountId,
    );
    expect(ids).toEqual(expect.arrayContaining(["maya", "jon", "leah"]));
    expect(ids.some((id) => id.startsWith("system-"))).toBe(false);
  });
  it("replaces a closed account with a stable pseudonym everywhere and drops its inbox state", async () => {
    const f = await createExample();
    await f.as("jon").run("inbox.preferences", {
      quietStart: 22,
      quietEnd: 7,
      timeZone: "UTC",
    });
    const result = await anonymizeClosedAccounts(f.repo, ["jon"]);
    expect(result.changed).toBeGreaterThan(0);
    const pm102 = (await read(f, "PM-102")) as CommitmentRecord;
    expect(pm102.versions[0]!.accountableOwnerAccountId).toMatch(
      /^deleted-user-[0-9a-f]{16}$/,
    );
    expect(JSON.stringify(pm102)).not.toContain('"jon"');
    expect(commitmentRecordSchema.safeParse(pm102).success).toBe(true);
    const project = await f.repo.get("project", "10000", projectRecordSchema);
    expect(JSON.stringify(project)).not.toContain('"jon"');
    expect(await f.repo.get("inbox", "jon", z.unknown())).toBeUndefined();
    // Other people and the record structure are unchanged.
    expect(pm102.history).toHaveLength(1);
    expect(JSON.stringify(await read(f, "PM-101"))).toContain('"maya"');
  });
});

describe("administrator export", () => {
  it("exports only accessible records and excludes graph context", async () => {
    const f = await createExample();
    const exported = (await f.service.run("data.export", {
      projectId: "10000",
    })) as { commitments: CommitmentRecord[]; notes: string[] };
    expect(exported.commitments.map((c) => c.id).sort()).toEqual([
      "PM-101",
      "PM-102",
      "PM-103",
      "PM-104",
    ]);
    expect(JSON.stringify(exported)).not.toContain("TEAMWORK_GRAPH");
    f.sources.hiddenWork.add("121");
    const restricted = (await f.service.run("data.export", {
      projectId: "10000",
    })) as { commitments: CommitmentRecord[] };
    expect(restricted.commitments.map((c) => c.id)).not.toContain("PM-101");
  });
  it("is refused for a non-administrator", async () => {
    const f = await createExample();
    f.sources.currentPrincipal = "owen";
    const service = new PromisoryService(
      exampleContext("owen"),
      f.repo,
      f.sources,
      new UnconfiguredExecutor(),
      { mode: "EXAMPLE", clock: () => EXAMPLE_CLOCK },
    );
    await expect(
      service.run("data.export", { projectId: "10000" }),
    ).rejects.toThrow();
  });
});
