import { z } from "zod";
import { id } from "@promisory/contracts";
import { canonicalJson } from "@promisory/domain";

// Source-owned Jira UI entry points and their single resolver. Rovo, triggers,
// arbitrary modules and model/UI overrides are not execution entry points.
export const executorModuleKeys = [
  "promisory-resolver",
  "promisory-workspace",
  "promisory-project",
  "promisory-impact-panel",
  "promisory-settings",
] as const;
export const executorModuleKeySchema = z.enum(executorModuleKeys);
export const hostedInvocationSchema = z.strictObject({
  schemaVersion: z.literal("promisory.hosted-invocation.v1"),
  moduleKey: executorModuleKeySchema,
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  invocationId: id,
});
export type HostedInvocation = z.infer<typeof hostedInvocationSchema>;
export const executorPathSchema = z.enum([
  "/v1/connection/check",
  "/v1/actions/apply",
  "/v1/actions/reconcile",
]);

/** HMAC domain separation binds the exact route, hosted context and body. */
export function authenticatedRemotePayload(
  method: string,
  path: string,
  origin: HostedInvocation,
  body: unknown,
) {
  return canonicalJson({
    schemaVersion: "promisory.authenticated-request.v2",
    method: z.literal("POST").parse(method),
    path: executorPathSchema.parse(path),
    origin: hostedInvocationSchema.parse(origin),
    body,
  });
}
