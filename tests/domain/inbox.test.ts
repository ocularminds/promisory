import { describe, expect, it } from "vitest";
import {
  PromisoryService,
  Repository,
  UnconfiguredExecutor,
} from "@promisory/domain";
import { createExample, exampleContext } from "@promisory/test-fixtures";

type Inbox = {
  notices: Array<{
    id: string;
    commitmentId: string;
    seen: boolean;
    evidenceSourceIds: string[];
  }>;
  digest: { state: string; unreadCount: number; nextAvailableAt: string };
  externalSending: boolean;
};
describe("current-access inbox and local quiet digest", () => {
  it("deduplicates findings, scopes read marks to the principal, and removes newly inaccessible evidence", async () => {
    const f = await createExample();
    const first = (await f.service.run("inbox.read", {
      projectId: "10000",
    })) as Inbox;
    const again = (await f.service.run("inbox.read", {
      projectId: "10000",
    })) as Inbox;
    expect(first.notices.map((n) => n.id)).toEqual(
      again.notices.map((n) => n.id),
    );
    expect(new Set(first.notices.map((n) => n.id)).size).toBe(
      first.notices.length,
    );
    const finding = first.notices.find((n) => n.commitmentId === "PM-101")!;
    expect(finding.evidenceSourceIds.length).toBeGreaterThan(0);
    await f.service.run("inbox.markRead", { notificationId: finding.id });
    expect(
      (
        (await f.service.run("inbox.read", { projectId: "10000" })) as Inbox
      ).notices.find((n) => n.id === finding.id)?.seen,
    ).toBe(true);
    expect(
      (
        (await f.as("jon").run("inbox.read", { projectId: "10000" })) as Inbox
      ).notices.find((n) => n.id === finding.id)?.seen,
    ).toBe(false);
    const unrelated = (await f
      .as("alex")
      .run("inbox.read", { projectId: "10000" })) as Inbox;
    expect(unrelated.notices.every((n) => n.commitmentId === "PM-103")).toBe(
      true,
    );
    f.sources.hiddenPages.add("203");
    const restricted = (await f
      .as("maya")
      .run("inbox.read", { projectId: "10000" })) as Inbox;
    expect(restricted.notices.some((n) => n.commitmentId === "PM-101")).toBe(
      false,
    );
  });
  it("holds overnight digest counts until the next local cutoff without hiding the manually opened inbox", async () => {
    const f = await createExample(),
      ctx = exampleContext();
    let now = "2026-11-18T19:30:00Z";
    const service = new PromisoryService(
      ctx,
      new Repository(f.raw, ctx),
      f.sources,
      new UnconfiguredExecutor(),
      { mode: "EXAMPLE", clock: () => now },
    );
    await service.run("inbox.preferences", {
      quietStart: 18,
      quietEnd: 8,
      timeZone: "Europe/Stockholm",
    });
    const quiet = (await service.run("inbox.read", {
      projectId: "10000",
    })) as Inbox;
    expect(quiet.notices.length).toBeGreaterThan(0);
    expect(quiet.digest).toMatchObject({
      state: "QUIET_HOURS",
      unreadCount: 0,
      nextAvailableAt: "2026-11-19T07:00:00Z",
    });
    expect(quiet.externalSending).toBe(false);
    now = "2026-11-19T07:00:00Z";
    const available = (await service.run("inbox.read", {
      projectId: "10000",
    })) as Inbox;
    expect(available.digest.state).toBe("AVAILABLE");
    expect(available.digest.unreadCount).toBeGreaterThan(0);
    await expect(
      service.run("inbox.preferences", {
        quietStart: 25,
        quietEnd: 8,
        timeZone: "Unspecified",
      }),
    ).rejects.toThrow();
  });
});
