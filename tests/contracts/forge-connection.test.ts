import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAppContext, invokeRemote } from "@forge/api";
import { createHmac, randomUUID } from "node:crypto";
import { configuredExecutor } from "../../apps/forge/optional/remote";
import {
  connectionCheckRequestSchema,
  connectionFailureSchema,
  hostedInvocationSchema,
  authenticatedRemotePayload,
} from "@promisory/integrations-decionis";
import { exampleContext } from "@promisory/test-fixtures";

vi.mock("@forge/api", () => ({
  invokeRemote: vi.fn(),
  getAppContext: vi.fn(),
}));
const remote = vi.mocked(invokeRemote);
beforeEach(() => {
  const context = exampleContext();
  vi.mocked(getAppContext).mockReturnValue({
    appAri: { appId: "synthetic-app", toString: () => context.appId },
    environmentAri: {
      environmentId: "synthetic-env",
      toString: () => context.environmentId,
    },
    installationAri: {
      installationId: "synthetic-install",
      toString: () => context.installationId,
    },
    appVersion: "3.1.0",
    invocationId: randomUUID(),
    moduleKey: "promisory-resolver",
    environmentType: "DEVELOPMENT",
    invocationRemainingTimeInMillis: () => 10_000,
  });
  vi.stubEnv("PROMISORY_REMOTE_ENABLED", "true");
  vi.stubEnv(
    "PROMISORY_REMOTE_SIGNING_KEY",
    "synthetic-forge-hmac-key-32-characters",
  );
  vi.stubEnv("PROMISORY_SHARE_DUE_DATE_INTENT", "true");
  vi.stubEnv("PROMISORY_SHARE_JIRA_DATE_SNAPSHOT", "true");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  remote.mockReset();
});
function response(override: Record<string, unknown> = {}) {
  remote.mockImplementation(async (_, options) => {
    const input = connectionCheckRequestSchema.parse(
      JSON.parse(String(options.body)),
    );
    return Response.json({
      schemaVersion: "promisory.remote-connection.v2",
      context: input.context,
      requestId: input.requestId,
      checkedAt: new Date().toISOString(),
      moduleKey: "promisory-resolver",
      fitModuleKey: "promisory-resolver",
      moduleVerification: "FIT_AND_HOSTED_CONTEXT",
      appVersion: "3.1.0",
      currentUserVerified: true,
      readOnly: true,
      mode: "ENFORCEMENT",
      enforcementVerificationHeld: true,
      dataSharingEnabled: true,
      ...override,
    });
  });
}
describe("Forge-side read-only connection boundary", () => {
  it("uses server context and the fixed remote route, reports a held connection, and logs only parsed metadata", async () => {
    response();
    const executor = await configuredExecutor();
    expect(await executor.checkConnection(exampleContext())).toMatchObject({
      state: "UNVERIFIED",
      detail: expect.stringContaining("writes remain held"),
    });
    expect(remote).toHaveBeenCalledTimes(1);
    expect(remote).toHaveBeenCalledWith(
      "promisory-executor",
      expect.objectContaining({ path: "/v1/connection/check", method: "POST" }),
    );
    const options = remote.mock.calls[0]![1];
    const headers = options.headers as Record<string, string>;
    const origin = hostedInvocationSchema.parse(
      JSON.parse(headers["x-promisory-origin"]!),
    );
    expect(headers["x-promisory-signature"]).toBe(
      createHmac("sha256", "synthetic-forge-hmac-key-32-characters")
        .update(
          authenticatedRemotePayload(
            "POST",
            "/v1/connection/check",
            origin,
            JSON.parse(String(options.body)),
          ),
        )
        .digest("hex"),
    );
    expect(console.info).toHaveBeenCalledTimes(1);
    const proof = JSON.parse(vi.mocked(console.info).mock.calls[0]![0]);
    expect(proof).toMatchObject({
      event: "PROMISORY_REMOTE_CONNECTION_CHECK",
      context: exampleContext(),
      readOnly: true,
      enforcementVerificationHeld: true,
    });
    expect(JSON.stringify(proof)).not.toMatch(
      /synthetic-forge-hmac|signature|oauth|graph|effect/i,
    );
  });
  it.each([
    { requestId: "22222222-2222-4222-8222-222222222222" },
    { context: exampleContext("jon") },
    { checkedAt: "2026-01-01T00:00:00.000Z" },
    { token: "unexpected-field-must-not-be-logged" },
    { currentUserVerified: false },
    { readOnly: false },
    { appVersion: "9.9.9" },
    { moduleKey: "promisory-workspace", fitModuleKey: "promisory-workspace" },
    { fitModuleKey: null, moduleVerification: "FIT_AND_HOSTED_CONTEXT" },
  ])("refuses mismatched, stale or overbroad proof %#", async (override) => {
    response(override);
    expect(
      (await (await configuredExecutor()).checkConnection(exampleContext()))
        .state,
    ).toBe("UNAVAILABLE");
    expect(console.info).not.toHaveBeenCalled();
  });
  it("keeps unavailable or unshared execution local without a remote request", async () => {
    vi.stubEnv("PROMISORY_SHARE_JIRA_DATE_SNAPSHOT", "false");
    expect(
      (await (await configuredExecutor()).checkConnection(exampleContext()))
        .state,
    ).toBe("UNAVAILABLE");
    expect(remote).not.toHaveBeenCalled();
  });
  it("records an HTTP failure without its potentially sensitive response body", async () => {
    remote.mockResolvedValue(
      Response.json({ message: "private-response-content" }, { status: 400 }),
    );
    expect(
      (await (await configuredExecutor()).checkConnection(exampleContext()))
        .state,
    ).toBe("UNAVAILABLE");
    const diagnostic = connectionFailureSchema.parse(
      JSON.parse(vi.mocked(console.warn).mock.calls[0]![0]),
    );
    expect(diagnostic).toMatchObject({
      origin: "FORGE",
      stage: "REMOTE_RESPONSE",
      httpStatus: 400,
      code: "REMOTE_INVOCATION_FAILED",
    });
    expect(JSON.stringify(diagnostic)).not.toContain(
      "private-response-content",
    );
  });
  it("classifies transport errors without retaining arbitrary error messages or properties", async () => {
    remote.mockRejectedValue(
      Object.assign(new Error("private-transport-token"), {
        code: "private-transport-code",
        claim: "private-transport-claim",
      }),
    );
    expect(
      (await (await configuredExecutor()).checkConnection(exampleContext()))
        .state,
    ).toBe("UNAVAILABLE");
    const diagnostic = connectionFailureSchema.parse(
      JSON.parse(vi.mocked(console.warn).mock.calls[0]![0]),
    );
    expect(diagnostic).toMatchObject({
      origin: "FORGE",
      stage: "TRANSPORT",
      code: "REMOTE_TRANSPORT_FAILED",
    });
    expect(JSON.stringify(diagnostic)).not.toContain("private-transport");
    expect(diagnostic.jwtClaim).toBeUndefined();
  });
  it("preserves the distinction between FIT module data and signed hosted context", async () => {
    response({ fitModuleKey: null, moduleVerification: "HOSTED_CONTEXT" });
    expect(
      (await (await configuredExecutor()).checkConnection(exampleContext()))
        .state,
    ).toBe("UNVERIFIED");
    expect(JSON.parse(vi.mocked(console.info).mock.calls[0]![0])).toMatchObject(
      { fitModuleKey: null, moduleVerification: "HOSTED_CONTEXT" },
    );
  });
  it("does not let Rovo become an attested execution source", async () => {
    vi.mocked(getAppContext).mockReturnValue({
      ...getAppContext(),
      moduleKey: "rovo-propose",
    });
    expect(
      (await (await configuredExecutor()).checkConnection(exampleContext()))
        .state,
    ).toBe("UNAVAILABLE");
    expect(remote).not.toHaveBeenCalled();
  });
  it("refuses a body from another installation before signing or sending it", async () => {
    expect(
      (
        await (
          await configuredExecutor()
        ).checkConnection({
          ...exampleContext(),
          installationId: "different-installation",
        })
      ).state,
    ).toBe("UNAVAILABLE");
    expect(remote).not.toHaveBeenCalled();
  });
});
