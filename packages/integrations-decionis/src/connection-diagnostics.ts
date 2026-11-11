import { z } from "zod";
import { instant } from "@promisory/contracts";
import { executorModuleKeys } from "./hosted-invocation";

const failureCode = z.enum([
  "INVALID_REQUEST",
  "METHOD_NOT_ALLOWED",
  "INVALID_INVOCATION",
  "INVALID_DESTINATION",
  "FRESH_USER_REQUIRED",
  "BODY_TOO_LARGE",
  "INVALID_SIGNATURE",
  "IDENTITY_MISMATCH",
  "STALE_CONNECTION_CHECK",
  "OAUTH_IDENTITY_MISMATCH",
  "INVALID_CONNECTION_CHECK",
  "INVALID_HOSTED_CONTEXT",
  "REMOTE_INVOCATION_FAILED",
  "REMOTE_TRANSPORT_FAILED",
  "CONTRACT_INVALID",
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWT_EXPIRED",
  "ERR_JWT_INVALID",
  "ERR_JWS_INVALID",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JOSE_ALG_NOT_ALLOWED",
  "ERR_JWKS_TIMEOUT",
  "ERR_JWKS_NO_MATCHING_KEY",
  "ERR_JWKS_MULTIPLE_MATCHING_KEYS",
  "ERR_JWKS_INVALID",
]);
const jwtClaim = z.enum(["aud", "iss", "exp", "iat", "nbf", "jti"]);
const invalidField = z.enum([
  "principal",
  "icLabel",
  "context",
  "context.cloudId",
  "context.principalAccountId",
  "app",
  "app.id",
  "app.appVersion",
  "app.installationId",
  "app.apiBaseUrl",
  "app.environment",
  "app.environment.id",
  "app.module",
  "app.module.key",
  "schemaVersion",
  "requestId",
  "expiresAt",
  "moduleKey",
  "appVersion",
  "invocationId",
  "accountId",
  "active",
  "OTHER",
]);

// Closed vocabulary: error messages, unknown field names and claim values can
// contain secrets or source data. None may enter this diagnostic contract.
export const connectionFailureSchema = z.strictObject({
  event: z.literal("PROMISORY_REMOTE_CONNECTION_CHECK_FAILED"),
  schemaVersion: z.literal("promisory.remote-connection-diagnostic.v1"),
  recordedAt: instant,
  origin: z.enum(["FORGE", "EXECUTOR"]),
  stage: z.enum([
    "PREPARE",
    "TRANSPORT",
    "REMOTE_RESPONSE",
    "RESPONSE_CONTRACT",
    "RESPONSE_BINDING",
    "REQUEST",
    "FIT_SIGNATURE",
    "FIT_CLAIMS",
    "FIT_BINDING",
    "FIT_DESTINATION",
    "USER_TOKEN",
    "ENVELOPE",
    "CONNECTION_CONTRACT",
    "JIRA_CURRENT_USER",
  ]),
  code: failureCode,
  httpStatus: z.number().int().min(100).max(599).optional(),
  jwtClaim: jwtClaim.optional(),
  invalidFields: z.array(invalidField).max(24).optional(),
  binding: z
    .strictObject({
      enabled: z.boolean(),
      appMatches: z.boolean(),
      environmentMatches: z.boolean(),
      installationMatches: z.boolean(),
      cloudMatches: z.boolean(),
      moduleMatches: z.boolean(),
      environmentForm: z.enum([
        "ARI_WITH_APP",
        "ARI_WITH_ENVIRONMENT",
        "UUID",
        "OTHER",
      ]),
      module: z.enum([
        ...executorModuleKeys,
        "promisory-executor",
        "EMPTY",
        "OTHER",
      ]),
    })
    .optional(),
});
export type ConnectionFailure = z.infer<typeof connectionFailureSchema>;

export function connectionFailureDetails(
  error: unknown,
  fallback: ConnectionFailure["code"] = "INVALID_REQUEST",
): Pick<ConnectionFailure, "code" | "jwtClaim" | "invalidFields"> {
  if (error instanceof z.ZodError)
    return {
      code: "CONTRACT_INVALID",
      invalidFields: [
        ...new Set(
          error.issues.map((issue) => {
            const field = invalidField.safeParse(issue.path.join("."));
            return field.success ? field.data : ("OTHER" as const);
          }),
        ),
      ].slice(0, 24),
    };
  const fields =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const code = failureCode.safeParse(fields.code);
  const claim = jwtClaim.safeParse(fields.claim);
  return {
    code: code.success ? code.data : fallback,
    ...(claim.success ? { jwtClaim: claim.data } : {}),
  };
}
