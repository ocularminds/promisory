import { beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createHmac } from "node:crypto";
import {
  authenticateEnvelope,
  verifyForgeInvocation,
  type InstallationBinding,
} from "../../apps/remote/src/auth";
import { canonicalJson } from "@promisory/domain";
import { exampleContext } from "@promisory/test-fixtures";
import { authenticatedRemotePayload } from "@promisory/integrations-decionis";

let keys: Awaited<ReturnType<typeof generateKeyPair>>,
  jwks: ReturnType<typeof createLocalJWKSet>;
const binding: InstallationBinding = {
  appId: exampleContext().appId,
  environmentId: exampleContext().environmentId,
  installationId: exampleContext().installationId,
  cloudId: exampleContext().cloudId,
  moduleKeys: ["promisory-resolver"],
  signingKey: () => "test-only-envelope-key-32-characters",
  enabled: true,
};
beforeAll(async () => {
  keys = await generateKeyPair("RS256", { extractable: true });
  jwks = createLocalJWKSet({
    keys: [
      { ...(await exportJWK(keys.publicKey)), kid: "test-fit", alg: "RS256" },
    ],
  });
});
async function token(
  override: Record<string, unknown> = {},
  audience = binding.appId,
  expiry = 60,
) {
  return new SignJWT({
    principal: "maya",
    context: { cloudId: binding.cloudId },
    app: {
      id: binding.appId,
      appVersion: "3.1.0",
      installationId: binding.installationId,
      environment: { id: binding.environmentId },
      module: { key: "promisory-resolver" },
      apiBaseUrl: `https://api.atlassian.com/ex/jira/${binding.cloudId}`,
    },
    ...override,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-fit" })
    .setIssuer("forge/invocation-token")
    .setAudience(audience)
    .setIssuedAt()
    .setNotBefore(Math.floor(Date.now() / 1000) - 2)
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiry)
    .setJti(crypto.randomUUID())
    .sign(keys.privateKey);
}
describe("signed invocation and server-bound envelope contract", () => {
  it("derives the native user and tenant only from a validated FIT and exact server binding", async () => {
    expect(
      (await verifyForgeInvocation(await token(), binding, jwks)).context,
    ).toEqual(exampleContext());
  });
  it("rejects wrong audience, expired signature context, unavailable principal, and disabled installation", async () => {
    await expect(
      verifyForgeInvocation(await token({}, "different-app"), binding, jwks),
    ).rejects.toThrow();
    await expect(
      verifyForgeInvocation(await token({}, binding.appId, -60), binding, jwks),
    ).rejects.toThrow();
    await expect(
      verifyForgeInvocation(await token({ principal: null }), binding, jwks),
    ).rejects.toThrow();
    await expect(
      verifyForgeInvocation(
        await token(),
        { ...binding, enabled: false },
        jwks,
      ),
    ).rejects.toThrow();
  });
  it.each(["environmentId", "installationId", "cloudId"] as const)(
    "does not cross the configured %s boundary",
    async (field) => {
      await expect(
        verifyForgeInvocation(
          await token(),
          {
            ...binding,
            [field]:
              field === "cloudId" ? crypto.randomUUID() : "different-scope",
          },
          jwks,
        ),
      ).rejects.toThrow("installation binding");
    },
  );
  it("rejects unconfigured module, destination redirects, and isolated-cloud labels", async () => {
    await expect(
      verifyForgeInvocation(
        await token(),
        { ...binding, moduleKeys: ["another-module"] },
        jwks,
      ),
    ).rejects.toThrow();
    await expect(
      verifyForgeInvocation(
        await token({ icLabel: "unconfigured-cloud" }),
        binding,
        jwks,
      ),
    ).rejects.toThrow();
    const altered = {
      id: binding.appId,
      appVersion: "3.1.0",
      installationId: binding.installationId,
      environment: { id: binding.environmentId },
      module: { key: "promisory-resolver" },
      apiBaseUrl: "https://untrusted.invalid/ex/jira/value",
    };
    await expect(
      verifyForgeInvocation(await token({ app: altered }), binding, jwks),
    ).rejects.toThrow("Jira API");
  });
  it("binds the exact effect and identity to the Forge server signature", () => {
    const context = exampleContext(),
      body = { context, operationId: "operation-test" };
    const origin = {
      schemaVersion: "promisory.hosted-invocation.v1" as const,
      moduleKey: "promisory-resolver" as const,
      appVersion: "3.1.0",
      invocationId: crypto.randomUUID(),
    };
    const invocation = {
      originHeader: JSON.stringify(origin),
      method: "POST",
      path: "/v1/actions/apply",
      fitModuleKey: "promisory-resolver",
      appVersion: "3.1.0",
    };
    const signature = createHmac("sha256", binding.signingKey())
      .update(
        authenticatedRemotePayload(
          invocation.method,
          invocation.path,
          origin,
          body,
        ),
      )
      .digest("hex");
    expect(() =>
      authenticateEnvelope(body, signature, context, binding, invocation),
    ).not.toThrow();
    expect(() =>
      authenticateEnvelope(
        { ...body, operationId: "different-effect" },
        signature,
        context,
        binding,
        invocation,
      ),
    ).toThrow();
    expect(() =>
      authenticateEnvelope(
        body,
        signature,
        { ...context, principalAccountId: "jon" },
        binding,
        invocation,
      ),
    ).toThrow("principal");
    expect(() =>
      authenticateEnvelope(body, "bad", context, binding, invocation),
    ).toThrow();
    expect(() =>
      authenticateEnvelope(body, signature, context, binding, {
        ...invocation,
        path: "/v1/actions/reconcile",
      }),
    ).toThrow();
    expect(() =>
      authenticateEnvelope(body, signature, context, binding, {
        ...invocation,
        originHeader: JSON.stringify({
          ...origin,
          invocationId: crypto.randomUUID(),
        }),
      }),
    ).toThrow();
    const legacy = createHmac("sha256", binding.signingKey())
      .update(canonicalJson(body))
      .digest("hex");
    expect(() =>
      authenticateEnvelope(body, legacy, context, binding, invocation),
    ).toThrow();
  });
});
