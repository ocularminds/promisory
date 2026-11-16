import { describe, expect, it } from "vitest";
import {
  CHANGE_FEED_ID,
  changeFeedSchema,
  SCHEMA_VERSION,
  type ChangeSignal,
} from "@promisory/contracts";
import {
  appendChange,
  visibleChanges,
  type Workspace,
} from "@promisory/domain";
import { parseSourceEvent } from "@promisory/integrations-atlassian";
import { createExample } from "@promisory/test-fixtures";

const T0 = "2026-11-16T10:00:00.000Z";
const signal = (over: Partial<ChangeSignal> = {}): ChangeSignal => ({
  id: `sig-${Math.random()}`,
  source: "JIRA_ISSUE",
  kind: "UPDATED",
  sourceId: "137",
  relatedSourceIds: [],
  fields: ["status"],
  observedAt: T0,
  ...over,
});

describe("metadata-only source event parsing", () => {
  it("keeps stable IDs and changed field names but drops values, summaries and actors", () => {
    const parsed = parseSourceEvent(
      {
        eventType: "avi:jira:updated:issue",
        atlassianId: "712020:secret-actor",
        issue: { id: "137", key: "MX-137", fields: { summary: "Customer X" } },
        changelog: {
          items: [
            { fieldId: "status", fromString: "Open", toString: "Reopened" },
            { fieldId: "duedate", from: "2026-11-19", to: "2026-11-24" },
            { field: "summary with spaces and values" },
          ],
        },
      },
      T0,
    );
    expect(parsed).toEqual({
      source: "JIRA_ISSUE",
      kind: "UPDATED",
      sourceId: "137",
      relatedSourceIds: [],
      fields: ["status", "duedate"],
      observedAt: T0,
    });
    expect(JSON.stringify(parsed)).not.toMatch(/Customer X|Reopened|secret/);
  });
  it("parses issue links in nested and top-level shapes and rejects non-numeric IDs", () => {
    expect(
      parseSourceEvent(
        {
          eventType: "avi:jira:created:issuelink",
          issueLink: { id: 9, sourceIssueId: 137, destinationIssueId: 121 },
        },
        T0,
      ),
    ).toMatchObject({
      source: "JIRA_LINK",
      kind: "CREATED",
      sourceId: "9",
      relatedSourceIds: ["137", "121"],
    });
    expect(
      parseSourceEvent(
        {
          eventType: "avi:jira:deleted:issuelink",
          id: "10",
          sourceIssueId: "137",
          destinationIssueId: "121",
        },
        T0,
      ),
    ).toMatchObject({ source: "JIRA_LINK", kind: "DELETED" });
    expect(
      parseSourceEvent(
        { eventType: "avi:jira:updated:issue", issue: { id: "../etc" } },
        T0,
      ),
    ).toBeUndefined();
    expect(parseSourceEvent({ something: "else" }, T0)).toBeUndefined();
  });
});

describe("change feed", () => {
  it("coalesces repeated deliveries, keeps later changes, and prunes beyond retention", () => {
    let feed = appendChange(undefined, signal(), T0);
    feed = appendChange(
      feed,
      signal({ fields: ["duedate"], observedAt: "2026-11-16T10:01:00.000Z" }),
      "2026-11-16T10:01:00.000Z",
    );
    expect(feed.signals).toHaveLength(1);
    expect(feed.signals[0]!.fields).toEqual(["status", "duedate"]);
    feed = appendChange(
      feed,
      signal({ observedAt: "2026-11-16T11:00:00.000Z" }),
      "2026-11-16T11:00:00.000Z",
    );
    expect(feed.signals).toHaveLength(2);
    feed = appendChange(
      feed,
      signal({ sourceId: "121", observedAt: "2026-11-24T12:00:00.000Z" }),
      "2026-11-24T12:00:00.000Z",
    );
    expect(feed.signals.map((s) => s.sourceId)).toEqual(["121"]);
    let big = feed;
    for (let i = 0; i < 250; i++)
      big = appendChange(
        big,
        signal({
          sourceId: String(1000 + i),
          observedAt: `2026-11-24T12:${String(i % 60).padStart(2, "0")}:00.000Z`,
        }),
        "2026-11-24T13:00:00.000Z",
      );
    expect(big.signals.length).toBeLessThanOrEqual(200);
    expect(changeFeedSchema.safeParse(big).success).toBe(true);
  });
  it("omits a link whose other end is not visible, so restricted IDs are not disclosed", () => {
    const feed = {
      schemaVersion: SCHEMA_VERSION,
      signals: [
        signal({
          source: "JIRA_LINK",
          sourceId: "9",
          relatedSourceIds: ["137", "999"],
        }),
        signal({ sourceId: "999" }),
        signal({ sourceId: "137" }),
      ],
    };
    expect(
      visibleChanges(feed, new Set(["137", "121"]), new Set()).map(
        (s) => s.sourceId,
      ),
    ).toEqual(["137"]);
  });
});

describe("change-driven impact and notices", () => {
  async function withFeed(signals: ChangeSignal[]) {
    const f = await createExample();
    await f.repo.save(
      "event",
      CHANGE_FEED_ID,
      0,
      { schemaVersion: SCHEMA_VERSION, signals },
      changeFeedSchema,
    );
    return f;
  }
  it("joins a changed blocker to the commitment it threatens and creates one inbox change notice", async () => {
    const f = await withFeed([
      signal({ sourceId: "137", fields: ["status"] }),
      signal({
        sourceId: "137",
        fields: ["duedate"],
        observedAt: "2026-11-16T11:00:00.000Z",
      }),
    ]);
    const workspace = (await f.service.run("workspace.read", {
      projectId: "10000",
    })) as Workspace;
    const impacts = workspace.changeImpacts.filter(
      (i) => i.commitmentId === "PM-101",
    );
    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toMatchObject({ relation: "DEPENDENCY_PATH" });
    expect(impacts[0]!.signal.observedAt).toBe("2026-11-16T11:00:00.000Z");
    const inbox = (await f.service.run("inbox.read", {
      projectId: "10000",
    })) as {
      notices: Array<{ kind: string; reason: string; commitmentId: string }>;
    };
    const changes = inbox.notices.filter((n) => n.kind === "CHANGE");
    expect(changes).toHaveLength(1);
    expect(changes[0]!.reason).toContain("MX-137 was updated (duedate)");
    expect(changes[0]!.commitmentId).toBe("PM-101");
  });
  it("hides changes to work the reader cannot see, including their notices", async () => {
    const f = await withFeed([signal({ sourceId: "137" })]);
    f.sources.hiddenWork.add("137");
    const workspace = (await f.service.run("workspace.read", {
      projectId: "10000",
    })) as Workspace;
    expect(workspace.changes).toEqual([]);
    expect(workspace.changeImpacts).toEqual([]);
  });
  it("does not raise change notices for closed commitments", async () => {
    const f = await withFeed([signal({ sourceId: "121" })]);
    await f.service.run("commitment.cancel", {
      commitmentId: "PM-101",
      expectedRevision: 1,
      reason: "No longer required.",
    });
    const workspace = (await f.service.run("workspace.read", {
      projectId: "10000",
    })) as Workspace;
    expect(
      workspace.changeImpacts.some((i) => i.commitmentId === "PM-101"),
    ).toBe(false);
  });
});
