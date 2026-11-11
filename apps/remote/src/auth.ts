import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  trustedContextSchema,
  type TrustedContext,
} from "@promisory/contracts";
import { canonicalJson, ensure } from "@promisory/domain";
import {
  authenticatedRemotePayload,
  executorModuleKeySchema,
  hostedInvocationSchema,
  type ConnectionFailure,
} from "@promisory/integrations-decionis";

const keys = createRemoteJWKSet(
  new URL("https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json"),
);
export interface InstallationBinding {
  appId: string;
  environmentId: string;
  installationId: string;
  cloudId: string;
  moduleKeys: string[];
  signingKey: () => string;
  enabled: boolean;
}
/** FIT identity verification is preliminary. Every route must also call
 * authenticateEnvelope before Jira access, including when hosted compute
 * omits its FIT module (Atlassian FRGE-1933). Isolated clouds remain refused. */
export async function verifyForgeInvocation(
  token: string,
  binding: InstallationBinding,
  jwks: JWTVerifyGetKey = keys,
  observe?: (value: Pick<ConnectionFailure, "stage" | "binding">) => void,
) {
  observe?.({ stage: "FIT_SIGNATURE" });
  const { payload } = await jwtVerify(token, jwks, {
    audience: binding.appId,
    issuer: "forge/invocation-token",
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "nbf", "jti"],
    clockTolerance: 3,
  });
  observe?.({ stage: "FIT_CLAIMS" });
  const claims = z
    .object({
      principal: z.string(),
      icLabel: z.never().optional(),
      context: z.object({ cloudId: z.uuid() }),
      app: z.object({
        id: z.string(),
        appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
        installationId: z.string(),
        apiBaseUrl: z.url(),
        environment: z.object({ id: z.string() }),
        module: z.object({ key: z.string().max(200) }),
      }),
    })
    .parse(payload);
  // Only comparisons and fixed categories from a verified FIT are observable.
  // Neither the token nor arbitrary claim values are passed to the logger.
  const environment = claims.app.environment.id;
  observe?.({
    stage: "FIT_BINDING",
    binding: {
      enabled: binding.enabled,
      appMatches: claims.app.id === binding.appId,
      environmentMatches: environment === binding.environmentId,
      installationMatches: claims.app.installationId === binding.installationId,
      cloudMatches: claims.context.cloudId === binding.cloudId,
      moduleMatches: binding.moduleKeys.includes(claims.app.module.key),
      environmentForm: /^ari:cloud:ecosystem::environment\/[^/]+\/[^/]+$/.test(
        environment,
      )
        ? "ARI_WITH_APP"
        : /^ari:cloud:ecosystem::environment\/[^/]+$/.test(environment)
          ? "ARI_WITH_ENVIRONMENT"
          : z.uuid().safeParse(environment).success
            ? "UUID"
            : "OTHER",
      module:
        claims.app.module.key === ""
          ? "EMPTY"
          : executorModuleKeySchema.safeParse(claims.app.module.key).success
            ? executorModuleKeySchema.parse(claims.app.module.key)
            : claims.app.module.key === "promisory-executor"
              ? "promisory-executor"
              : "OTHER",
    },
  });
  ensure(
    binding.enabled &&
      claims.app.id === binding.appId &&
      claims.app.environment.id === binding.environmentId &&
      claims.app.installationId === binding.installationId &&
      claims.context.cloudId === binding.cloudId &&
      (claims.app.module.key === "" ||
        binding.moduleKeys.includes(claims.app.module.key)),
    "INVALID_INVOCATION",
    "The invocation does not match this enabled installation binding.",
  );
  observe?.({ stage: "FIT_DESTINATION" });
  const destination = new URL(claims.app.apiBaseUrl);
  ensure(
    destination.origin === "https://api.atlassian.com" &&
      destination.pathname === `/ex/jira/${binding.cloudId}` &&
      !destination.username &&
      !destination.password &&
      !destination.search &&
      !destination.hash,
    "INVALID_DESTINATION",
    "The trusted invocation must name this installation’s Jira API.",
  );
  const context = trustedContextSchema.parse({
    appId: binding.appId,
    environmentId: binding.environmentId,
    installationId: binding.installationId,
    cloudId: binding.cloudId,
    principalAccountId: claims.principal,
  });
  return {
    context,
    apiBaseUrl: destination.href,
    moduleKey: claims.app.module.key,
    appVersion: claims.app.appVersion,
  };
}
export function authenticateEnvelope(
  body: unknown,
  signature: string,
  context: TrustedContext,
  binding: InstallationBinding,
  invocation: {
    originHeader: string;
    method: string;
    path: string;
    fitModuleKey: string;
    appVersion: string;
  },
) {
  const origin = hostedInvocationSchema.parse(
    JSON.parse(z.string().min(1).max(2048).parse(invocation.originHeader)),
  );
  const expected = createHmac("sha256", binding.signingKey())
    .update(
      authenticatedRemotePayload(
        invocation.method,
        invocation.path,
        origin,
        body,
      ),
    )
    .digest();
  ensure(
    /^[0-9a-f]{64}$/.test(signature),
    "INVALID_SIGNATURE",
    "The invocation envelope is not authenticated.",
  );
  ensure(
    timingSafeEqual(expected, Buffer.from(signature, "hex")),
    "INVALID_SIGNATURE",
    "The invocation envelope changed after the server prepared it.",
  );
  const input = z.object({ context: trustedContextSchema }).parse(body);
  ensure(
    canonicalJson(input.context) === canonicalJson(context),
    "IDENTITY_MISMATCH",
    "The invocation principal and installation must match the prepared effect.",
  );
  ensure(
    binding.moduleKeys.includes(origin.moduleKey) &&
      origin.appVersion === invocation.appVersion &&
      (invocation.fitModuleKey === "" ||
        invocation.fitModuleKey === origin.moduleKey),
    "INVALID_HOSTED_CONTEXT",
    "The server-attested source must match this installation and its FIT when supplied.",
  );
  return origin;
}
