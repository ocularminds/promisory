import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recoveryMarkerName,
  recoveryScope,
} from "../../scripts/live/recovery-probe";
import {
  createHistoryObserver,
  historyObservationName,
  observedOperationId,
  projectHistoryResponse,
} from "../../scripts/live/recovery-history-observer";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
const tagged = (items: unknown[]) => ({
  historyMetadata: {
    extraData: {
      promisoryOperationId: observedOperationId,
      confidential: "synthetic-private-context",
    },
  },
  items,
});
const url = `https://api.atlassian.com/ex/jira/${recoveryScope.cloudId}/rest/api/3/issue/10001/changelog?startAt=0&maxResults=100`;
describe("recovery history observation preserves native results and data boundaries", () => {
  it("projects only exact-operation date representation and approved dates", () => {
    const result = projectHistoryResponse(
      {
        values: [
          {
            historyMetadata: null,
            items: [
              { field: "description", fromString: "synthetic-private-context" },
            ],
          },
          tagged([
            {
              field: "duedate",
              fieldId: "duedate",
              from: "2026-11-18T00:00:00.000+0000",
              to: "2026-11-19T00:00:00.000+0000",
              fromString: "18/Nov/26",
              toString: "synthetic-private-context",
            },
            { field: "description", fromString: "synthetic-private-context" },
          ]),
        ],
      },
      0,
      200,
    );
    expect(result).toMatchObject({
      entryCount: 2,
      taggedEntryCount: 1,
      dateItems: [
        {
          from: { format: "ISO_DATE_TIME", calendarDate: "2026-11-18" },
          to: { format: "ISO_DATE_TIME", calendarDate: "2026-11-19" },
          fromString: { format: "DISPLAY_DATE" },
          toString: { format: "OTHER" },
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("synthetic-private-context");
    expect(result.dateItems).toHaveLength(1);
    expect(
      projectHistoryResponse({ values: new Array(101).fill({}) }, 0, 200)
        .pageParsed,
    ).toBe(false);
  });
  it("leaves the original response and request unchanged and never stores credentials", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "promisory-history-observer-"),
    );
    temporary.push(directory);
    await mkdir(join(directory, "recovery-tests"));
    await writeFile(
      join(directory, "recovery-tests", recoveryMarkerName),
      JSON.stringify({
        schemaVersion: "promisory.recovery-probe.v1",
        policyId: recoveryScope.policyId,
        operationId: observedOperationId,
        phase: "ACKNOWLEDGEMENT_SUPPRESSED",
        reservedAt: "2026-11-11T04:53:03.541Z",
        updatedAt: "2026-11-11T04:53:04.478Z",
        httpStatus: 204,
      }),
    );
    const payload = {
      values: [
        tagged([
          {
            field: "duedate",
            fromString: "2026-11-18",
            toString: "2026-11-19",
          },
        ]),
      ],
    };
    const response = Response.json(payload);
    const original = vi.fn(async () => response),
      init = { headers: { Authorization: "Bearer synthetic-secret-oauth" } };
    expect(await createHistoryObserver(original, directory)(url, init)).toBe(
      response,
    );
    expect(original).toHaveBeenCalledExactlyOnceWith(url, init);
    expect(await response.json()).toEqual(payload);
    const bytes = await readFile(
      join(directory, "recovery-tests", historyObservationName),
      "utf8",
    );
    expect(bytes).not.toContain("synthetic-secret-oauth");
    expect(bytes).not.toContain("synthetic-private-context");
    const next = new Response("synthetic-private-error", { status: 403 });
    await createHistoryObserver(
      async () => next,
      directory,
    )(url.replace("startAt=0", "startAt=100"));
    expect(
      await readFile(
        join(directory, "recovery-tests", historyObservationName),
        "utf8",
      ),
    ).toBe(bytes);
    const nextBytes = await readFile(
      join(
        directory,
        "recovery-tests",
        historyObservationName.replace(".json", "-100.json"),
      ),
      "utf8",
    );
    expect(JSON.parse(nextBytes)).toMatchObject({
      startAt: 100,
      httpStatus: 403,
      pageParsed: false,
    });
    expect(nextBytes).not.toContain("synthetic-private-error");
  });
  it("never changes or retries a write, another route, or a failed observation", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "promisory-history-observer-"),
    );
    temporary.push(directory);
    const response = new Response(null, { status: 403 }),
      original = vi.fn(async () => response);
    const observe = createHistoryObserver(original, directory);
    expect(await observe(url, { method: "PUT" })).toBe(response);
    expect(await observe(url.replace("10001", "10002"))).toBe(response);
    expect(await observe(url)).toBe(response);
    expect(original).toHaveBeenCalledTimes(3);
    await expect(
      readFile(join(directory, "recovery-tests", historyObservationName)),
    ).rejects.toThrow();
  });
});
