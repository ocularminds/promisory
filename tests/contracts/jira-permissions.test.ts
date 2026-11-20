import { describe, expect, it, vi } from "vitest";
import { AtlassianSources } from "@promisory/integrations-atlassian";
import { exampleContext } from "@promisory/test-fixtures";
import { InvocationJira } from "../../apps/remote/src/index";

const base = `https://api.atlassian.com/ex/jira/${exampleContext().cloudId}`;
const path =
  "/rest/api/3/mypermissions?issueId=121&permissions=BROWSE_PROJECTS,EDIT_ISSUES,SCHEDULE_ISSUES";
const allowed = () => ({
  permissions: {
    BROWSE_PROJECTS: { havePermission: true },
    EDIT_ISSUES: { havePermission: true },
    SCHEDULE_ISSUES: { havePermission: true },
  },
});

function adapter(kind: "hosted" | "remote", payload: unknown, status = 200) {
  const request = vi.fn<typeof fetch>(async () =>
    Response.json(payload, { status }),
  );
  const jira =
    kind === "remote"
      ? new InvocationJira(base, "synthetic-active-user-token", request)
      : new AtlassianSources(exampleContext(), {
          jira: (route) => request(`${base}${route}`),
          confluence: vi.fn(),
          graph: vi.fn(),
        });
  return { jira, request };
}

describe.each(["hosted", "remote"] as const)(
  "%s Jira due-date permission checks — synthetic product responses",
  (kind) => {
    it("requires all three issue-scoped permissions and rechecks after revocation", async () => {
      const f = adapter(kind, allowed());
      expect(await f.jira.canSetDueDate("121")).toBe(true);
      expect(f.request.mock.calls[0]?.[0]).toBe(`${base}${path}`);
      const revoked = allowed();
      revoked.permissions.SCHEDULE_ISSUES.havePermission = false;
      f.request.mockResolvedValueOnce(Response.json(revoked));
      expect(await f.jira.canSetDueDate("121")).toBe(false);
      expect(f.request).toHaveBeenCalledTimes(2);
      if (kind === "remote")
        expect(f.request.mock.calls[0]?.[1]).toMatchObject({
          redirect: "error",
          headers: { Authorization: "Bearer synthetic-active-user-token" },
        });
    });
    it.each(["BROWSE_PROJECTS", "EDIT_ISSUES", "SCHEDULE_ISSUES"] as const)(
      "refuses missing, denied or non-Boolean %s even when the user is an administrator",
      async (key) => {
        for (const evidence of [
          undefined,
          { havePermission: false },
          { havePermission: "true" },
        ]) {
          const payload = {
            permissions: {
              ...allowed().permissions,
              ADMINISTER: { havePermission: true },
              [key]: evidence,
            },
          };
          const f = adapter(kind, payload);
          expect(await f.jira.canSetDueDate("121")).toBe(false);
        }
      },
    );
    it.each([401, 403, 404, 302])(
      "refuses HTTP %s even if its body claims permission",
      async (status) => {
        const f = adapter(kind, allowed(), status);
        expect(await f.jira.canSetDueDate("121")).toBe(false);
      },
    );
    it("fails closed on a network failure or malformed response", async () => {
      const f = adapter(kind, allowed());
      f.request.mockRejectedValueOnce(new Error("Synthetic network failure"));
      expect(await f.jira.canSetDueDate("121")).toBe(false);
      f.request.mockResolvedValueOnce(new Response("not JSON"));
      expect(await f.jira.canSetDueDate("121")).toBe(false);
      f.request.mockResolvedValueOnce(Response.json({ permissions: {} }));
      expect(await f.jira.canSetDueDate("121")).toBe(false);
    });
    it("rejects an issue identifier that could alter the permission query", async () => {
      const f = adapter(kind, allowed());
      await expect(f.jira.canSetDueDate("121&issueId=999")).rejects.toThrow();
      expect(f.request).not.toHaveBeenCalled();
    });
  },
);
