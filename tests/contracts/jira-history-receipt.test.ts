import { describe, expect, it, vi } from "vitest";
import type { JiraDueDateEffect } from "@promisory/contracts";
import { InvocationJira } from "../../apps/remote/src/index";

const apiBase = "https://api.atlassian.com/ex/jira/fixture-cloud";
const operationId = "operation-synthetic-recovery";
const effect: JiraDueDateEffect = {
  kind: "SET_JIRA_DUE_DATE",
  cloudId: "fixture-cloud",
  issueId: "10001",
  expectedUpdatedAt: "2026-11-11T03:51:24.479Z",
  expectedDueDate: "2026-11-18",
  desiredDueDate: "2026-11-19",
};
const dateItem = () => ({
  fieldId: "duedate",
  field: "Localized field label",
  from: effect.expectedDueDate,
  to: effect.desiredDueDate,
  fromString: "18/nov./26 at 00:00",
  toString: "19/nov./26 at 00:00",
});
const entry = (items: unknown[] = [dateItem()], tag = operationId) => ({
  historyMetadata: { extraData: { promisoryOperationId: tag } },
  items,
});
function adapter(payload: unknown, status = 200) {
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json(payload, { status }));
  return {
    jira: new InvocationJira(apiBase, "synthetic-user-token", request),
    request,
  };
}

describe("native Jira receipt contract with synthetic changelog responses", () => {
  it("matches the exact tagged raw dates despite localized display text and unrelated history", async () => {
    const { jira, request } = adapter({
      isLast: true,
      values: [
        {
          historyMetadata: null,
          items: [
            { fieldId: "description", toString: "synthetic private prose" },
          ],
        },
        { items: [{ fieldId: "summary" }] },
        entry(),
      ],
    });
    expect(await jira.receipt(effect, operationId)).toBe(true);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `${apiBase}/rest/api/3/issue/10001/changelog?startAt=0&maxResults=100`,
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer synthetic-user-token",
        }),
      }),
    );
    expect(request.mock.calls[0]?.[1]).not.toHaveProperty("body");
  });

  it("rejects a different operation, field, date or display-only match", async () => {
    const cases: [string, unknown][] = [
      ["other operation", entry([dateItem()], "operation-other")],
      [
        "different stable field",
        entry([
          { ...dateItem(), fieldId: "customfield_10001", field: "duedate" },
        ]),
      ],
      [
        "missing stable field",
        entry([{ ...dateItem(), fieldId: undefined, field: "duedate" }]),
      ],
      [
        "different raw date",
        entry([{ ...dateItem(), to: "2026-11-20", toString: "2026-11-19" }]),
      ],
      [
        "display-only ISO dates",
        entry([
          {
            fieldId: "duedate",
            fromString: "2026-11-18",
            toString: "2026-11-19",
          },
        ]),
      ],
      [
        "timestamp is not a calendar date",
        entry([{ ...dateItem(), from: "2026-11-18T00:00:00Z" }]),
      ],
      ["missing operation tag", { historyMetadata: null, items: [dateItem()] }],
    ];
    for (const [label, value] of cases) {
      const { jira } = adapter({ isLast: true, values: [value] });
      expect(await jira.receipt(effect, operationId), label).toBe(false);
    }
  });

  it("matches an explicitly unset prior date without treating a missing value as null", async () => {
    const withoutDate = { ...effect, expectedDueDate: null };
    expect(
      await adapter({
        values: [entry([{ ...dateItem(), from: null }])],
      }).jira.receipt(withoutDate, operationId),
    ).toBe(true);
    expect(
      await adapter({
        values: [entry([{ ...dateItem(), from: undefined }])],
      }).jira.receipt(withoutDate, operationId),
    ).toBe(false);
  });

  it("paginates only within the fixed issue route and stops after finding the receipt", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          isLast: false,
          nextPage: "https://untrusted.invalid/history",
          values: new Array(100).fill({}),
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ isLast: true, values: [entry()] }),
      );
    const jira = new InvocationJira(apiBase, "synthetic-user-token", request);
    expect(await jira.receipt(effect, operationId)).toBe(true);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      `${apiBase}/rest/api/3/issue/10001/changelog?startAt=0&maxResults=100`,
      `${apiBase}/rest/api/3/issue/10001/changelog?startAt=100&maxResults=100`,
    ]);
  });

  it("keeps a bounded, denied or malformed history lookup unproven", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        Response.json({ isLast: false, values: new Array(100).fill({}) }),
      );
    expect(
      await new InvocationJira(
        apiBase,
        "synthetic-user-token",
        request,
      ).receipt(effect, operationId),
    ).toBe(false);
    expect(request).toHaveBeenCalledTimes(5);
    expect(
      await adapter({ values: [entry()] }, 403).jira.receipt(
        effect,
        operationId,
      ),
    ).toBe(false);
    expect(
      await adapter({ values: new Array(101).fill(entry()) }).jira.receipt(
        effect,
        operationId,
      ),
    ).toBe(false);
    expect(
      await adapter({ values: null }).jira.receipt(effect, operationId),
    ).toBe(false);
    const malformed = new InvocationJira(
      apiBase,
      "synthetic-user-token",
      async () => new Response("not JSON"),
    );
    expect(await malformed.receipt(effect, operationId)).toBe(false);
  });
});
