import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertRecoveryEnvironment,
  createRecoveryRequest,
  recoveryMarkerName,
  recoveryMarkerSchema,
  recoveryScope,
} from "../../scripts/live/recovery-probe";

const target = `https://api.atlassian.com/ex/jira/${recoveryScope.cloudId}/rest/api/3/issue/10001`;
const clock = () => Date.parse("2026-11-11T12:00:00.000Z");
const request = (
  operation = "operation-11111111-1111-4111-8111-111111111111",
) => ({
  method: "PUT",
  headers: { Authorization: "Bearer synthetic-sensitive-user-token" },
  body: JSON.stringify({
    fields: { duedate: "2026-11-19" },
    historyMetadata: {
      type: "promisory",
      extraData: { promisoryOperationId: operation },
    },
  }),
});
const environment = () => ({
  PROMISORY_RECOVERY_PROBE: "true",
  PROMISORY_APP_ID: recoveryScope.appId,
  PROMISORY_ENVIRONMENT_ID: recoveryScope.environmentId,
  PROMISORY_INSTALLATION_ID: recoveryScope.installationId,
  PROMISORY_CLOUD_ID: recoveryScope.cloudId,
  PROMISORY_ORGANIZATION_ID: recoveryScope.organizationId,
  PROMISORY_AUTHORITY_POLICY_ID: recoveryScope.policyId,
  PROMISORY_AUTHORITY_URL: "https://api.decionis.com",
  PROMISORY_STATE_DIRECTORY: "/var/lib/promisory",
  PROMISORY_MODE: "ENFORCEMENT",
  PROMISORY_ENFORCEMENT_VERIFIED: "true",
  PROMISORY_SHARE_DUE_DATE_INTENT: "true",
  PROMISORY_SHARE_JIRA_DATE_SNAPSHOT: "true",
});

describe("isolated recovery acceptance probe (synthetic transport only)", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "promisory-recovery-probe-"));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const markerPath = () =>
    join(directory, "recovery-tests", recoveryMarkerName);

  it("suppresses a successful acknowledgement once and keeps restart/concurrent retries from dispatching", async () => {
    const original = vi.fn(async () => new Response(null, { status: 204 }));
    const wrapped = createRecoveryRequest(original, directory, clock);
    const first = request();
    await expect(wrapped(target, first)).rejects.toThrow(
      "ACKNOWLEDGEMENT_SUPPRESSED",
    );
    expect(original).toHaveBeenCalledExactlyOnceWith(target, first);
    const bytes = await readFile(markerPath(), "utf8");
    expect(recoveryMarkerSchema.parse(JSON.parse(bytes))).toMatchObject({
      phase: "ACKNOWLEDGEMENT_SUPPRESSED",
      httpStatus: 204,
      operationId: "operation-11111111-1111-4111-8111-111111111111",
    });
    expect(bytes).not.toContain("synthetic-sensitive-user-token");
    expect(bytes).not.toContain("Authorization");
    expect((await stat(markerPath())).mode & 0o777).toBe(0o600);
    const restarted = createRecoveryRequest(original, directory, clock);
    await expect(restarted(target, first)).rejects.toThrow(
      "RESERVATION_REFUSED",
    );
    await expect(
      restarted(
        target,
        request("operation-22222222-2222-4222-8222-222222222222"),
      ),
    ).rejects.toThrow("RESERVATION_REFUSED");
    expect(original).toHaveBeenCalledTimes(1);
  });

  it("atomically limits two concurrent proposals to one forwarded request", async () => {
    const original = vi.fn(async () => new Response(null, { status: 204 }));
    const wrapped = createRecoveryRequest(original, directory, clock);
    const results = await Promise.allSettled([
      wrapped(target, request()),
      wrapped(
        target,
        request("operation-33333333-3333-4333-8333-333333333333"),
      ),
    ]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(original).toHaveBeenCalledTimes(1);
  });

  it("leaves reads and the authority transport intact while refusing a wider Jira write", async () => {
    const original = vi.fn(async () => new Response("{}", { status: 200 }));
    const wrapped = createRecoveryRequest(original, directory, clock);
    const read = { method: "GET", headers: request().headers };
    await wrapped(`${target}?fields=updated,duedate`, read);
    await wrapped("https://api.decionis.com/v1/authority/grants", {
      method: "POST",
      body: "{}",
    });
    expect(original).toHaveBeenCalledTimes(2);
    for (const [url, init] of [
      [target.replace("10001", "10002"), request()],
      [
        target.replace(
          recoveryScope.cloudId,
          "e207942a-9edf-4952-b945-2ed6ed3707a8",
        ),
        request(),
      ],
      [`${target}?override=true`, request()],
      [
        target,
        {
          ...request(),
          body: request().body.replace("2026-11-19", "2026-11-20"),
        },
      ],
      [
        target,
        {
          ...request(),
          body: request().body.replace(
            '"fields":{',
            '"fields":{"description":"unreviewed",',
          ),
        },
      ],
    ] as const)
      await expect(wrapped(url, init)).rejects.toThrow("REQUEST_REFUSED");
    expect(original).toHaveBeenCalledTimes(2);
  });

  it("preserves real non-success responses and never retries an uncertain transport", async () => {
    const refused = new Response(null, { status: 403 });
    const original = vi.fn(async () => refused);
    expect(
      await createRecoveryRequest(
        original,
        directory,
        clock,
      )(target, request()),
    ).toBe(refused);
    expect(
      recoveryMarkerSchema.parse(
        JSON.parse(await readFile(markerPath(), "utf8")),
      ),
    ).toMatchObject({ phase: "NON_SUCCESS_RESPONSE", httpStatus: 403 });
    const other = join(directory, "separate-synthetic-run");
    const failed = vi.fn(async () => {
      throw new Error("provider text with synthetic-sensitive-user-token");
    });
    const wrapped = createRecoveryRequest(failed, other, clock);
    await expect(wrapped(target, request())).rejects.toThrow(
      "TRANSPORT_UNCERTAIN",
    );
    await expect(wrapped(target, request())).rejects.toThrow(
      "RESERVATION_REFUSED",
    );
    const bytes = await readFile(
      join(other, "recovery-tests", recoveryMarkerName),
      "utf8",
    );
    expect(bytes).not.toContain("synthetic-sensitive-user-token");
    expect(recoveryMarkerSchema.parse(JSON.parse(bytes)).phase).toBe(
      "TRANSPORT_UNCERTAIN",
    );
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it("refuses a write if it cannot reserve durable state or the test has expired", async () => {
    const original = vi.fn(async () => new Response(null, { status: 204 }));
    const unavailable = join(directory, "not-a-directory");
    await writeFile(unavailable, "synthetic state failure");
    await expect(
      createRecoveryRequest(original, unavailable, clock)(target, request()),
    ).rejects.toThrow();
    await expect(
      createRecoveryRequest(original, directory, () =>
        Date.parse(recoveryScope.expiresAt),
      )(target, request()),
    ).rejects.toThrow("PROBE_EXPIRED");
    expect(original).not.toHaveBeenCalled();
  });

  it("requires the exact test binding and preserves approval separation", () => {
    expect(() =>
      assertRecoveryEnvironment(environment(), clock()),
    ).not.toThrow();
    for (const key of Object.keys(environment()))
      expect(() =>
        assertRecoveryEnvironment(
          { ...environment(), [key]: "other" },
          clock(),
        ),
      ).toThrow("CONTEXT_REFUSED");
    expect(() =>
      assertRecoveryEnvironment(
        environment(),
        Date.parse(recoveryScope.expiresAt),
      ),
    ).toThrow("CONTEXT_REFUSED");
  });
});
