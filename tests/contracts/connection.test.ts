import { beforeAll, describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createHmac, randomUUID } from "node:crypto";
import { canonicalJson } from "@promisory/domain";
import {
  connectionCheckResultSchema,
  connectionFailureSchema,
  executorModuleKeys,
  type AuthorityBinding,
  type ClaimVault,
  type ExecutionJournal,
} from "@promisory/integrations-decionis";
import { exampleContext } from "@promisory/test-fixtures";
import { createRemoteHandler } from "../../apps/remote/src/index";
import type { InstallationBinding } from "../../apps/remote/src/auth";

const context = exampleContext();
const binding: InstallationBinding = {
  ...context,
  moduleKeys: [...executorModuleKeys],
  signingKey: () => "synthetic-connection-key-32-characters",
  enabled: true,
};
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let jwks: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  keys = await generateKeyPair("RS256", { extractable: true });
  jwks = createLocalJWKSet({
    keys: [
      {
        ...(await exportJWK(keys.publicKey)),
        kid: "test-connection",
        alg: "RS256",
      },
    ],
  });
});
async function fit(moduleKey = "promisory-resolver", omitNotBefore = false) {
  const token = new SignJWT({
    principal: context.principalAccountId,
    context: { cloudId: context.cloudId },
    app: {
      id: context.appId,
      appVersion: "3.1.0",
      environment: { id: context.environmentId },
      installationId: context.installationId,
      module: { key: moduleKey },
      apiBaseUrl: `https://api.atlassian.com/ex/jira/${context.cloudId}`,
    },
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-connection" })
    .setIssuer("forge/invocation-token")
    .setAudience(context.appId)
    .setIssuedAt()
    .setExpirationTime("1m")
    .setJti(randomUUID());
  if (!omitNotBefore) token.setNotBefore(Math.floor(Date.now() / 1000) - 1);
  return token.sign(keys.privateKey);
}
function query() {
  return {
    schemaVersion: "promisory.remote-connection.v1",
    context,
    requestId: randomUUID(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}
function setup(
  user: unknown = { accountId: context.principalAccountId, active: true },
  status = 200,
) {
  const journal: ExecutionJournal = {
    get: vi.fn(async () => undefined),
    start: vi.fn(async () => true),
    save: vi.fn(async () => {}),
  };
  const vault: ClaimVault = {
    get: vi.fn(async () => undefined),
    save: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
  const authority: AuthorityBinding = {
    organizationId: randomUUID(),
    policyId: "synthetic-connection-policy",
    authorityUrl: "https://authority.invalid",
    apiKey: () => "synthetic-authority-key",
    effectObserverId: "synthetic-promisory-observer",
    mode: "ENFORCEMENT",
    independentlyVerifiedEnforcement: false,
    dataPolicy: { independentDueDateIntent: true, jiraDueDateSnapshot: true },
  };
  const request = vi.fn<typeof fetch>(async () =>
    Response.json(user, { status }),
  );
  const connectionLog = vi.fn();
  const handler = createRemoteHandler(binding, authority, journal, vault, {
    jwks,
    request,
    connectionLog,
  });
  async function call(
    body: unknown = query(),
    options: {
      path?: string;
      oauth?: boolean;
      signature?: string;
      moduleKey?: string;
      omitNotBefore?: boolean;
      origin?: Record<string, unknown>;
      originHeader?: boolean;
      signPath?: string;
    } = {},
  ) {
    const path = options.path ?? "/v1/connection/check";
    const origin = options.origin ?? {
      schemaVersion: "promisory.hosted-invocation.v1",
      moduleKey: "promisory-resolver",
      appVersion: "3.1.0",
      invocationId: randomUUID(),
    };
    return handler(
      new Request(`https://executor.invalid${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${await fit(options.moduleKey, options.omitNotBefore)}`,
          ...(options.oauth === false
            ? {}
            : { "x-forge-oauth-user": "synthetic-current-user-token" }),
          ...(options.originHeader === false
            ? {}
            : { "x-promisory-origin": JSON.stringify(origin) }),
          "x-promisory-signature":
            options.signature ??
            createHmac("sha256", binding.signingKey())
              .update(
                canonicalJson({
                  schemaVersion: "promisory.authenticated-request.v2",
                  method: "POST",
                  path: options.signPath ?? path,
                  origin,
                  body,
                }),
              )
              .digest("hex"),
        },
        body: JSON.stringify(body),
      }),
    );
  }
  return { call, request, journal, vault, authority, connectionLog };
}

describe("read-only remote connection verification — synthetic FIT and Jira", () => {
  it("verifies the exact signed invocation and matching OAuth user while preserving the execution hold", async () => {
    const f = setup({
      accountId: context.principalAccountId,
      active: true,
      emailAddress: "never-retain@example.invalid",
      displayName: "Never retain",
    });
    const input = query();
    const response = await f.call(input);
    expect(response.status).toBe(200);
    const result = connectionCheckResultSchema.parse(await response.json());
    expect(result).toMatchObject({
      context,
      requestId: input.requestId,
      appVersion: "3.1.0",
      moduleKey: "promisory-resolver",
      fitModuleKey: "promisory-resolver",
      moduleVerification: "FIT_AND_HOSTED_CONTEXT",
      currentUserVerified: true,
      readOnly: true,
      mode: "ENFORCEMENT",
      enforcementVerificationHeld: true,
    });
    expect(f.request).toHaveBeenCalledExactlyOnceWith(
      `https://api.atlassian.com/ex/jira/${context.cloudId}/rest/api/3/myself`,
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer synthetic-current-user-token",
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /never-retain|Never retain|synthetic-current-user-token|synthetic-authority-key|claim_token/,
    );
    expect(f.connectionLog).toHaveBeenCalledExactlyOnceWith({
      event: "PROMISORY_REMOTE_CONNECTION_CHECK",
      ...result,
    });
    expect(f.authority.independentlyVerifiedEnforcement).toBe(false);
    const action = await f.call(
      {
        schemaVersion: "promisory.remote.v1",
        context,
        operationId: randomUUID(),
        proposalId: "synthetic-proposal",
        proposalHash: `sha256:${"a".repeat(64)}`,
        idempotencyKey: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        effect: {
          kind: "SET_JIRA_DUE_DATE",
          cloudId: context.cloudId,
          issueId: "121",
          expectedUpdatedAt: "2026-11-10T09:00:00.000Z",
          expectedDueDate: "2026-11-20",
          desiredDueDate: "2026-11-23",
        },
      },
      { path: "/v1/actions/apply" },
    );
    expect(await action.json()).toMatchObject({
      stage: "HELD",
      mode: "UNKNOWN",
    });
    expect(f.request).toHaveBeenCalledTimes(1);
    expect(f.journal.start).not.toHaveBeenCalled();
    expect(f.journal.save).not.toHaveBeenCalled();
    expect(f.vault.save).not.toHaveBeenCalled();
    expect(f.connectionLog).toHaveBeenCalledTimes(1);
  });
  it.each(["graph", "effect", "url", "principalAccountId"])(
    "rejects caller-supplied %s metadata before touching Jira",
    async (field) => {
      const f = setup();
      expect(
        (await f.call({ ...query(), [field]: "not-permitted" })).status,
      ).toBe(400);
      expect(f.request).not.toHaveBeenCalled();
    },
  );
  it.each([-1_000, 120_000])(
    "rejects expired or excessively future checks (%s ms)",
    async (offset) => {
      const f = setup();
      expect(
        await (
          await f.call({
            ...query(),
            expiresAt: new Date(Date.now() + offset).toISOString(),
          })
        ).json(),
      ).toMatchObject({ error: "STALE_CONNECTION_CHECK" });
      expect(f.request).not.toHaveBeenCalled();
    },
  );
  it("refuses a changed identity, missing OAuth, changed HMAC, and unconfigured module without network calls", async () => {
    const f = setup();
    expect(
      (
        await f.call({
          ...query(),
          context: { ...context, principalAccountId: "jon" },
        })
      ).status,
    ).toBe(400);
    expect((await f.call(query(), { oauth: false })).status).toBe(400);
    expect((await f.call(query(), { signature: "0".repeat(64) })).status).toBe(
      400,
    );
    expect(
      (await f.call(query(), { moduleKey: "unconfigured-module" })).status,
    ).toBe(400);
    expect(f.request).not.toHaveBeenCalled();
  });
  it.each([
    { accountId: "jon", active: true },
    { accountId: context.principalAccountId, active: false },
  ])(
    "refuses a mismatching or inactive OAuth account: $accountId, $active",
    async (user) => {
      const f = setup(user);
      expect(await (await f.call()).json()).toMatchObject({
        error: "OAUTH_IDENTITY_MISMATCH",
      });
      expect(f.request).toHaveBeenCalledTimes(1);
      expect(f.journal.start).not.toHaveBeenCalled();
    },
  );
  it.each([401, 302])(
    "does not accept unauthorized or redirected Jira responses (%s)",
    async (status) => {
      const f = setup({}, status);
      expect((await f.call()).status).toBe(400);
      expect(f.request).toHaveBeenCalledTimes(1);
      expect(f.journal.start).not.toHaveBeenCalled();
      expect(
        connectionFailureSchema.parse(f.connectionLog.mock.calls[0]![0]),
      ).toMatchObject({
        origin: "EXECUTOR",
        stage: "JIRA_CURRENT_USER",
        code: "FRESH_USER_REQUIRED",
        httpStatus: status,
      });
    },
  );
  it("identifies a missing required JWT claim without recording the token or treating it as verified", async () => {
    const f = setup();
    expect((await f.call(query(), { omitNotBefore: true })).status).toBe(400);
    const diagnostic = connectionFailureSchema.parse(
      f.connectionLog.mock.calls[0]![0],
    );
    expect(diagnostic).toMatchObject({
      origin: "EXECUTOR",
      stage: "FIT_SIGNATURE",
      code: "ERR_JWT_CLAIM_VALIDATION_FAILED",
      jwtClaim: "nbf",
    });
    expect(diagnostic.binding).toBeUndefined();
    expect(f.request).not.toHaveBeenCalled();
    expect(JSON.stringify(diagnostic)).not.toMatch(
      /synthetic-|Bearer|eyJ|principalAccountId/,
    );
  });
  it("diagnoses binding failure using fixed categories, discarding arbitrary signed claim content", async () => {
    const f = setup();
    expect(
      (await f.call(query(), { moduleKey: "private-source-content-never-log" }))
        .status,
    ).toBe(400);
    const diagnostic = connectionFailureSchema.parse(
      f.connectionLog.mock.calls[0]![0],
    );
    expect(diagnostic).toMatchObject({
      stage: "FIT_BINDING",
      code: "INVALID_INVOCATION",
      binding: {
        appMatches: true,
        installationMatches: true,
        moduleMatches: false,
        module: "OTHER",
      },
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(
      /private-source-content|synthetic-|Bearer|eyJ/,
    );
    expect(f.request).not.toHaveBeenCalled();
  });
  it("does not log unknown request keys or their restricted content on a contract failure", async () => {
    const f = setup();
    expect(
      (
        await f.call({
          ...query(),
          "private-graph-derived-key": "private-graph-derived-content",
        })
      ).status,
    ).toBe(400);
    const diagnostic = connectionFailureSchema.parse(
      f.connectionLog.mock.calls[0]![0],
    );
    expect(diagnostic).toMatchObject({
      stage: "CONNECTION_CONTRACT",
      code: "CONTRACT_INVALID",
      invalidFields: ["OTHER"],
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(
      /private-graph|synthetic-|Bearer|eyJ/,
    );
    expect(f.request).not.toHaveBeenCalled();
  });
  it("accepts a blank hosted-compute FIT module only with matching server attestation and explicitly reports its evidence source", async () => {
    const f = setup();
    const response = await f.call(query(), { moduleKey: "" });
    expect(response.status).toBe(200);
    const proof = connectionCheckResultSchema.parse(await response.json());
    expect(proof).toMatchObject({
      moduleKey: "promisory-resolver",
      fitModuleKey: null,
      moduleVerification: "HOSTED_CONTEXT",
      enforcementVerificationHeld: true,
    });
    expect(f.request).toHaveBeenCalledTimes(1);
    expect(f.journal.start).not.toHaveBeenCalled();
    expect(f.vault.save).not.toHaveBeenCalled();
  });
  it.each(["", "promisory-resolver"])(
    "requires the authenticated hosted context even when the FIT module is %j",
    async (moduleKey) => {
      const f = setup();
      expect(
        (await f.call(query(), { moduleKey, originHeader: false })).status,
      ).toBe(400);
      expect(f.request).not.toHaveBeenCalled();
    },
  );
  it("rejects a nonempty FIT that disagrees with another allowed hosted module", async () => {
    const f = setup();
    const result = await f.call(query(), { moduleKey: "promisory-workspace" });
    expect(await result.json()).toMatchObject({
      error: "INVALID_HOSTED_CONTEXT",
    });
    expect(f.request).not.toHaveBeenCalled();
  });
  it.each([
    { moduleKey: "rovo-propose", appVersion: "3.1.0" },
    { moduleKey: "promisory-resolver", appVersion: "9.9.9" },
    {
      moduleKey: "promisory-resolver",
      appVersion: "3.1.0",
      "private-source-key": "private-source-content",
    },
  ])(
    "refuses a fully signed forbidden or conflicting hosted context %#",
    async (origin) => {
      const f = setup();
      const result = await f.call(query(), {
        moduleKey: "",
        origin: {
          schemaVersion: "promisory.hosted-invocation.v1",
          invocationId: randomUUID(),
          ...origin,
        },
      });
      expect(result.status).toBe(400);
      expect(f.request).not.toHaveBeenCalled();
      expect(JSON.stringify(f.connectionLog.mock.calls)).not.toContain(
        "private-source",
      );
    },
  );
  it("refuses cross-route replay of a valid signed connection request", async () => {
    const f = setup();
    expect(
      await (await f.call(query(), { signPath: "/v1/actions/apply" })).json(),
    ).toMatchObject({ error: "INVALID_SIGNATURE" });
    expect(f.request).not.toHaveBeenCalled();
  });
});
