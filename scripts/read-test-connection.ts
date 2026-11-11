import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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
const deployment = JSON.parse(
  readFileSync(resolve(evidence, "forge-deployment.json"), "utf8"),
) as { reportedDeploymentVersion: string };
const runtime = JSON.parse(
  readFileSync(resolve(evidence, "executor-runtime.json"), "utf8"),
) as {
  context: {
    appId: string;
    environmentId: string;
    installationId: string;
    cloudId: string;
  };
};
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
const expectedPrincipal = "712020:2921f941-93f4-4ccb-9c03-2555a8bfe3d9";
const results = new Map<
  string,
  ReturnType<typeof connectionCheckResultSchema.parse>
>();
const verifiedSources = new Map<string, Set<string>>();
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
    const { event: ignored, ...fields } = object;
    void ignored;
    const parsed = connectionCheckResultSchema.safeParse(fields);
    if (!parsed.success) {
      rejectedEventCount++;
      continue;
    }
    const result = parsed.data;
    const age = Date.now() - Date.parse(result.checkedAt);
    if (
      result.appVersion !== deployment.reportedDeploymentVersion ||
      !executorModuleKeySchema.safeParse(result.moduleKey).success ||
      result.context.principalAccountId !== expectedPrincipal ||
      Object.entries(runtime.context).some(
        ([key, value]) =>
          result.context[key as keyof typeof result.context] !== value,
      ) ||
      age < -5_000 ||
      age > 10 * 60_000
    ) {
      rejectedEventCount++;
      continue;
    }
    results.set(result.requestId, result);
    const sources = verifiedSources.get(result.requestId) ?? new Set<string>();
    sources.add(provider.origin);
    verifiedSources.set(result.requestId, sources);
  }
const report = {
  schemaVersion: "promisory.installed-connection-observation.v2",
  recordedAt: new Date().toISOString(),
  environment: "development",
  expectedAppVersion: deployment.reportedDeploymentVersion,
  source:
    "Forge CLI and the owned test executor logs; only strict connection-check events retained",
  failedChecks,
  failureEvents,
  rejectedEventCount,
  verifiedConnections: [...results.values()].sort((a, b) =>
    a.checkedAt.localeCompare(b.checkedAt),
  ),
  verifiedConnectionSources: [...verifiedSources.entries()].map(
    ([requestId, sources]) => ({ requestId, sources: [...sources] }),
  ),
  authenticatedForgeInvocationVerified: results.size > 0,
  executionFlagChanged: false,
  grantOrJiraWriteAttempted: false,
  status:
    results.size > 0
      ? "VERIFIED_CONNECTION"
      : failedChecks
        ? "CHECK_FAILED"
        : "AWAITING_INSTALLED_CHECK",
};
if (output)
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify(report, null, 2));
if (!results.size) process.exitCode = 2;
