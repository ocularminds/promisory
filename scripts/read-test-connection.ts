import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  connectionCheckResultSchema,
  connectionFailureSchema,
  executorModuleKeySchema,
  type ConnectionFailure,
} from "@promisory/integrations-decionis";

// Read only the installed test app's diagnostic logs. Never invoke an action,
// change the verification flag, or print/store unfiltered provider log output.
const root = resolve(import.meta.dirname, "..");
const arguments_ = process.argv.slice(2);
let since = "10m";
let output: string | undefined;
let evidence = resolve(root, "docs/evidence/2026-11-11-review-guidance");
for (let i = 0; i < arguments_.length; i += 2) {
  const name = arguments_[i],
    value = arguments_[i + 1];
  if (!value) throw new Error("Provide a value for each option.");
  if (
    name === "--since" &&
    /^(?:\d+[mhd]|\d{4}-\d{2}-\d{2}(?:T[0-9:.]+Z)?)$/.test(value)
  )
    since = value;
  else if (name === "--output") output = resolve(root, value);
  else if (name === "--deployment-evidence") evidence = resolve(root, value);
  else
    throw new Error(
      "Use --since <time>, --deployment-evidence <folder>, and optional --output <new-file>.",
    );
}
const deploymentsFile = resolve(evidence, "forge-deployments.json");
const expectedAppVersion = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/)
  .parse(
    existsSync(deploymentsFile)
      ? z
          .object({
            profiles: z.array(
              z.object({
                profile: z.string(),
                result: z.string(),
                version: z.string().optional(),
              }),
            ),
          })
          .parse(JSON.parse(readFileSync(deploymentsFile, "utf8")))
          .profiles.find(
            (profile) =>
              profile.profile === "development" && profile.result === "SUCCESS",
          )?.version
      : JSON.parse(
          readFileSync(resolve(evidence, "forge-deployment.json"), "utf8"),
        ).reportedDeploymentVersion,
  );
// The authenticated response still carries context. Logs deliberately do not.
// Reuse the response field contracts and reject legacy/extra identity fields.
const fields = connectionCheckResultSchema.shape;
const observationSchema = z
  .strictObject({
    event: z.literal("PROMISORY_REMOTE_CONNECTION_CHECK"),
    schemaVersion: z.literal("promisory.remote-connection-observation.v1"),
    requestId: fields.requestId,
    checkedAt: fields.checkedAt,
    moduleKey: fields.moduleKey,
    fitModuleKey: fields.fitModuleKey,
    moduleVerification: fields.moduleVerification,
    appVersion: fields.appVersion,
    currentUserVerified: fields.currentUserVerified,
    readOnly: fields.readOnly,
    mode: fields.mode,
    enforcementVerificationHeld: fields.enforcementVerificationHeld,
    dataSharingEnabled: fields.dataSharingEnabled,
  })
  .refine((value) =>
    value.moduleVerification === "FIT_AND_HOSTED_CONTEXT"
      ? value.fitModuleKey === value.moduleKey
      : value.fitModuleKey === null,
  );
const providerLogs: { origin: "FORGE" | "EXECUTOR"; text: string }[] = [];
const executorSince = /^\d+[mhd]$/.test(since)
  ? [
      `--since=${since.replace(/^(\d+)d$/, (_, days: string) => `${Number(days) * 24}h`)}`,
    ]
  : [`--since-time=${new Date(since).toISOString()}`];
for (const provider of [
  {
    origin: "FORGE" as const,
    executable: process.execPath,
    arguments: [
      realpathSync(resolve(root, "node_modules/.bin/forge")),
      "logs",
      "--environment",
      "development",
      "--functionKey",
      "promisory-resolver",
      "--since",
      since,
      "--limit",
      "200",
    ],
  },
  {
    origin: "EXECUTOR" as const,
    executable: "kubectl",
    arguments: [
      "--context=decionis-aks",
      "--namespace=decionis",
      "logs",
      "deployment/promisory-test-executor",
      "--container=executor",
      ...executorSince,
      "--tail=500",
      "--limit-bytes=2097152",
    ],
  },
]) {
  try {
    providerLogs.push({
      origin: provider.origin,
      text: execFileSync(provider.executable, provider.arguments, {
        cwd: resolve(root, "apps/forge"),
        encoding: "utf8",
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      }),
    });
  } catch {
    throw new Error(
      `${provider.origin} logs could not be read. No provider log output was retained.`,
    );
  }
}
const results = new Map<string, z.infer<typeof observationSchema>>();
const verifiedSources = new Map<string, Set<string>>();
const conflictingRequestIds = new Set<string>();
const failureEvents: ConnectionFailure[] = [];
let failedChecks = 0,
  rejectedEventCount = 0;
for (const provider of providerLogs)
  for (const line of provider.text.split(/\r?\n/)) {
    const start = line.indexOf('{"event":');
    if (start < 0) continue;
    let object: Record<string, unknown>;
    try {
      object = JSON.parse(line.slice(start));
    } catch {
      continue;
    }
    if (object.event === "PROMISORY_REMOTE_CONNECTION_CHECK_FAILED") {
      if (provider.origin === "FORGE" && Object.keys(object).length === 1) {
        failedChecks++;
        continue;
      }
      const failure = connectionFailureSchema.safeParse(object);
      if (!failure.success || failure.data.origin !== provider.origin) {
        rejectedEventCount++;
        continue;
      }
      const age = Date.now() - Date.parse(failure.data.recordedAt);
      if (age < -5_000 || age > 10 * 60_000) {
        rejectedEventCount++;
        continue;
      }
      failedChecks++;
      failureEvents.push(failure.data);
      continue;
    }
    if (object.event !== "PROMISORY_REMOTE_CONNECTION_CHECK") continue;
    const parsed = observationSchema.safeParse(object);
    if (!parsed.success) {
      rejectedEventCount++;
      continue;
    }
    const result = parsed.data;
    const age = Date.now() - Date.parse(result.checkedAt);
    if (
      result.appVersion !== expectedAppVersion ||
      !executorModuleKeySchema.safeParse(result.moduleKey).success ||
      age < -5_000 ||
      age > 10 * 60_000
    ) {
      rejectedEventCount++;
      continue;
    }
    const previous = results.get(result.requestId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(result)) {
      conflictingRequestIds.add(result.requestId);
      rejectedEventCount++;
      continue;
    }
    results.set(result.requestId, result);
    const sources = verifiedSources.get(result.requestId) ?? new Set<string>();
    sources.add(provider.origin);
    verifiedSources.set(result.requestId, sources);
  }
// A one-sided log does not prove that the hosted caller accepted the result.
const paired = [...results.values()].filter(
  (result) =>
    verifiedSources.get(result.requestId)?.size === 2 &&
    !conflictingRequestIds.has(result.requestId),
);
const report = {
  schemaVersion: "promisory.installed-connection-observation.v3",
  recordedAt: new Date().toISOString(),
  environment: "development",
  expectedAppVersion,
  source:
    "Matching Forge CLI and owned test executor observations; no account or tenant identifiers retained",
  identityValidation:
    "Performed by FIT/OAuth verification and authenticated response comparison in the deployed services, not reconstructed from logs",
  failedChecks,
  failureEvents,
  rejectedEventCount,
  unpairedOrConflictingObservations: results.size - paired.length,
  verifiedConnections: paired.sort((a, b) =>
    a.checkedAt.localeCompare(b.checkedAt),
  ),
  verifiedConnectionSources: paired.map(({ requestId }) => ({
    requestId,
    sources: [...verifiedSources.get(requestId)!],
  })),
  authenticatedForgeInvocationVerified: paired.length > 0,
  executionFlagChanged: false,
  grantOrJiraWriteAttempted: false,
  status:
    paired.length > 0
      ? "VERIFIED_CONNECTION"
      : failedChecks
        ? "CHECK_FAILED"
        : "AWAITING_INSTALLED_CHECK",
};
if (output)
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify(report, null, 2));
if (!paired.length) process.exitCode = 2;
