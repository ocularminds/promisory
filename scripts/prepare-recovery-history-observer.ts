/** Prepare only: observe existing history reads for the saved recovery operation. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { recoveryScope } from "./live/recovery-probe";
import { observedOperationId } from "./live/recovery-history-observer";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "release/recovery-history-observer");
const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
function kube(args: string[]) {
  try {
    return execFileSync(
      "kubectl",
      ["--context=decionis-aks", "-n", "decionis", ...args],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
  } catch {
    throw new Error(
      "The scoped observer preparation failed; raw provider output was not retained.",
    );
  }
}
const before = JSON.parse(
  readFileSync(
    resolve(
      root,
      "docs/evidence/2026-11-11-recovery-test/before-history-observer.json",
    ),
    "utf8",
  ),
);
if (
  before.marker?.operationId !== observedOperationId ||
  before.marker?.phase !== "ACKNOWLEDGEMENT_SUPPRESSED" ||
  before.marker?.httpStatus !== 204 ||
  before.claimFileCount !== 1 ||
  before.pendingOperationCount !== 1 ||
  before.operationRecordCount !== 2 ||
  before.operations?.length !== 1 ||
  before.operations[0].result?.stage !== "RECONCILING" ||
  before.operations[0].result?.observed !== "MATCHED_EFFECT" ||
  before.storage?.claimUid !== "65f5f167-e9fe-41b4-85c6-b953adccea5b" ||
  Date.now() - Date.parse(before.recordedAt) > 20 * 60_000 ||
  Date.now() >= Date.parse(recoveryScope.expiresAt)
)
  throw new Error(
    "Inspect the exact saved operation before preparing its read-only observer.",
  );
const deployment = JSON.parse(
  kube(["get", "deployment", "promisory-test-executor", "-o", "json"]),
);
const config = JSON.parse(
  kube(["get", "configmap", "promisory-test-executor", "-o", "json"]),
);
const original = JSON.parse(
  kube(["get", "configmap", "promisory-recovery-7bc064bc5e9a", "-o", "json"]),
);
const expectedImage =
  "decionisacr.azurecr.io/promisory/executor@sha256:a387bebb193e4ad99e8fe0d10808a73bae875e6198202b95d77a4da48169bc4a";
const originalArgs = ["--import", "/app/recovery-probe.mjs", "/app/server.js"];
const expectedRuntime: Record<string, string> = {
  PROMISORY_APP_ID: recoveryScope.appId,
  PROMISORY_ENVIRONMENT_ID: recoveryScope.environmentId,
  PROMISORY_INSTALLATION_ID: recoveryScope.installationId,
  PROMISORY_CLOUD_ID: recoveryScope.cloudId,
  PROMISORY_ORGANIZATION_ID: recoveryScope.organizationId,
  PROMISORY_AUTHORITY_POLICY_ID: recoveryScope.policyId,
  PROMISORY_AUTHORITY_URL: "https://api.decionis.com",
  PROMISORY_STATE_DIRECTORY: recoveryScope.stateDirectory,
  PROMISORY_MODE: "ENFORCEMENT",
  PROMISORY_ENFORCEMENT_VERIFIED: "true",
  PROMISORY_SHARE_DUE_DATE_INTENT: "true",
  PROMISORY_SHARE_JIRA_DATE_SNAPSHOT: "true",
};
const pod = deployment.spec?.template?.spec,
  container = pod?.containers?.[0];
if (
  deployment.metadata?.uid !== "d2900804-2853-4318-8aa7-488c4d9a5fb0" ||
  config.metadata?.uid !== "e45ab236-9b35-4dda-84a6-18224679fb5f" ||
  deployment.metadata?.generation !== before.pod.generation ||
  deployment.spec?.replicas !== 1 ||
  deployment.status?.readyReplicas !== 1 ||
  pod?.containers?.length !== 1 ||
  container?.image !== expectedImage ||
  JSON.stringify(container.command) !== JSON.stringify(["node"]) ||
  JSON.stringify(container.args) !== JSON.stringify(originalArgs) ||
  !Array.isArray(container.env) ||
  !Array.isArray(container.volumeMounts) ||
  !Array.isArray(pod.volumes) ||
  container.env.filter(
    (entry: { name: string; value?: string }) =>
      entry.name === "PROMISORY_RECOVERY_PROBE" && entry.value === "true",
  ).length !== 1 ||
  container.env.some(
    (entry: { name: string }) =>
      entry.name === "PROMISORY_RECOVERY_HISTORY_OBSERVER",
  ) ||
  Object.entries(expectedRuntime).some(
    ([key, value]) => config.data?.[key] !== value,
  ) ||
  original.immutable !== true ||
  typeof original.data?.["recovery-probe.mjs"] !== "string" ||
  sha(original.data["recovery-probe.mjs"]) !== before.probeSha256
)
  throw new Error("The existing approved deployment or probe changed.");

const sourcePath = "scripts/live/recovery-history-observer.ts";
const source = readFileSync(resolve(root, sourcePath), "utf8");
const compiled = transpileModule(source, {
  compilerOptions: {
    module: ModuleKind.ES2022,
    target: ScriptTarget.ES2022,
    sourceMap: false,
  },
  reportDiagnostics: true,
});
const importText = 'from "./recovery-probe";';
if (
  compiled.diagnostics?.length ||
  compiled.outputText.split(importText).length !== 2
)
  throw new Error(
    "The observer did not compile with exactly one reviewed local import.",
  );
const moduleText = compiled.outputText.replace(
  importText,
  'from "./recovery-probe.mjs";',
);
const compiledSha256 = sha(moduleText),
  name = `promisory-history-${compiledSha256.slice(0, 12)}`;
if (pod.volumes.some((volume: { name: string }) => volume.name === name))
  throw new Error("This observer volume is already present.");
const resource = {
  apiVersion: "v1",
  kind: "ConfigMap",
  metadata: {
    name,
    namespace: "decionis",
    labels: { "app.kubernetes.io/part-of": "promisory" },
  },
  immutable: true,
  data: { "recovery-history-observer.mjs": moduleText },
};
const annotation = "promisory.decionis.com/recovery-history-observer";
const annotations = deployment.spec.template.metadata.annotations;
if (annotations?.[annotation] !== undefined)
  throw new Error("Inspect the prior observer before preparing another.");
const patch = [
  { op: "test", path: "/metadata/uid", value: deployment.metadata.uid },
  {
    op: "test",
    path: "/metadata/resourceVersion",
    value: deployment.metadata.resourceVersion,
  },
  {
    op: "test",
    path: "/spec/template/spec/containers/0/image",
    value: expectedImage,
  },
  {
    op: "test",
    path: "/spec/template/spec/containers/0/command",
    value: ["node"],
  },
  {
    op: "test",
    path: "/spec/template/spec/containers/0/args",
    value: originalArgs,
  },
  {
    op: "replace",
    path: "/spec/template/spec/containers/0/args",
    value: [
      "--import",
      "/app/recovery-probe.mjs",
      "--import",
      "/app/recovery-history-observer.mjs",
      "/app/server.js",
    ],
  },
  {
    op: "add",
    path: "/spec/template/spec/containers/0/env/-",
    value: { name: "PROMISORY_RECOVERY_HISTORY_OBSERVER", value: "true" },
  },
  {
    op: "add",
    path: "/spec/template/spec/volumes/-",
    value: { name, configMap: { name } },
  },
  {
    op: "add",
    path: "/spec/template/spec/containers/0/volumeMounts/-",
    value: {
      name,
      mountPath: "/app/recovery-history-observer.mjs",
      subPath: "recovery-history-observer.mjs",
      readOnly: true,
    },
  },
  {
    op: "add",
    path:
      annotations === undefined
        ? "/spec/template/metadata/annotations"
        : `/spec/template/metadata/annotations/${annotation.replaceAll("/", "~1")}`,
    value:
      annotations === undefined
        ? { [annotation]: compiledSha256 }
        : compiledSha256,
  },
];
mkdirSync(output, { recursive: false });
const save = (name: string, value: unknown) =>
  writeFileSync(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
  });
save("observer.configmap.json", resource);
save("executor.deployment.patch.json", patch);
writeFileSync(resolve(output, "recovery-history-observer.mjs"), moduleText, {
  flag: "wx",
});
kube([
  "apply",
  "--dry-run=server",
  "-f",
  resolve(output, "observer.configmap.json"),
  "-o",
  "name",
]);
kube([
  "patch",
  "deployment",
  "promisory-test-executor",
  "--type=json",
  "--patch-file",
  resolve(output, "executor.deployment.patch.json"),
  "--dry-run=server",
  "-o",
  "name",
]);
const report = {
  schemaVersion: "promisory.recovery-history-preparation.v1",
  recordedAt: new Date().toISOString(),
  status: "PREPARED_NOT_APPLIED",
  operationId: observedOperationId,
  sourcePath,
  sourceSha256: sha(source),
  compiledSha256,
  configMapName: name,
  originalProbeSha256: before.probeSha256,
  previousGeneration: deployment.metadata.generation,
  image: expectedImage,
  beforeEvidence: "before-history-observer.json",
  serverDryRunsPassed: 2,
  addsNativeRequests: false,
  altersNativeResponses: false,
  policyChanged: false,
  claimContentsRead: false,
  resourcesApplied: false,
};
save("review.json", report);
console.log(JSON.stringify(report, null, 2));
