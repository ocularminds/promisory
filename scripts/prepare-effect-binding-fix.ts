/** Review/dry-run only: preserve the unresolved test claim while updating its adapter. */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { canonicalJson } from "@promisory/domain";
import { recoveryEffectRuntimeSchema } from "./live/recovery-runtime";

const evidence = "docs/evidence/2026-11-11-recovery-test";
const candidate = recoveryEffectRuntimeSchema.parse(
  JSON.parse(
    readFileSync(`${evidence}/effect-binding-runtime-candidate.json`, "utf8"),
  ),
);
const before = JSON.parse(
  readFileSync(`${evidence}/before-effect-binding-fix.json`, "utf8"),
);
if (
  before.pod.image !== candidate.previousImage ||
  before.claimFileCount !== 1 ||
  before.pendingOperationCount !== 1 ||
  before.operationRecordCount !== 2 ||
  before.operations.length !== 1 ||
  before.operations[0].operationId !== candidate.operationId ||
  before.operations[0].result.stage !== "SUCCEEDED" ||
  before.operations[0].result.finalization !== "PENDING" ||
  Date.now() - Date.parse(before.recordedAt) > 600_000
)
  throw new Error("A fresh matching unresolved-claim observation is required.");
function kube(args: string[]) {
  try {
    return JSON.parse(
      execFileSync(
        "kubectl",
        ["--context=decionis-aks", "-n", "decionis", ...args],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 30_000,
          maxBuffer: 2 * 1024 * 1024,
        },
      ),
    );
  } catch {
    throw new Error(
      "Scoped Kubernetes read/dry-run failed; no raw provider output retained.",
    );
  }
}
const name = "promisory-test-executor";
const deployment = kube(["get", "deployment", name, "-o", "json"]);
const config = kube(["get", "configmap", name, "-o", "json"]);
const container = deployment.spec.template.spec.containers?.[0];
if (
  deployment.metadata.uid !== "d2900804-2853-4318-8aa7-488c4d9a5fb0" ||
  config.metadata.uid !== "e45ab236-9b35-4dda-84a6-18224679fb5f" ||
  deployment.spec.replicas !== 1 ||
  deployment.status.readyReplicas !== 1 ||
  deployment.spec.template.spec.containers.length !== 1 ||
  container.image !== candidate.previousImage ||
  container.name !== "executor" ||
  canonicalJson(container.command) !== canonicalJson(["node"]) ||
  canonicalJson(container.args) !==
    canonicalJson([
      "--import",
      "/app/recovery-probe.mjs",
      "--import",
      "/app/recovery-history-observer.mjs",
      "/app/server.js",
    ]) ||
  config.data.PROMISORY_AUTHORITY_POLICY_ID !== candidate.policyId ||
  config.data.PROMISORY_MODE !== "ENFORCEMENT" ||
  config.data.PROMISORY_ENFORCEMENT_VERIFIED !== "true" ||
  config.data.PROMISORY_SHARE_DUE_DATE_INTENT !== "true" ||
  config.data.PROMISORY_SHARE_JIRA_DATE_SNAPSHOT !== "true" ||
  Object.hasOwn(config.data, "PROMISORY_EFFECT_OBSERVER_ID")
)
  throw new Error(
    "The exact owned deployment or its recovery controls changed.",
  );
const directory = "release/effect-binding-fix";
mkdirSync(directory, { recursive: true });
const deploymentPatch = [
  { op: "test", path: "/metadata/uid", value: deployment.metadata.uid },
  {
    op: "test",
    path: "/metadata/resourceVersion",
    value: deployment.metadata.resourceVersion,
  },
  {
    op: "test",
    path: "/spec/template/spec/containers/0/image",
    value: candidate.previousImage,
  },
  {
    op: "replace",
    path: "/spec/template/spec/containers/0/image",
    value: candidate.image,
  },
];
const configPatch = [
  { op: "test", path: "/metadata/uid", value: config.metadata.uid },
  {
    op: "test",
    path: "/metadata/resourceVersion",
    value: config.metadata.resourceVersion,
  },
  {
    op: "test",
    path: "/data/PROMISORY_AUTHORITY_POLICY_ID",
    value: candidate.policyId,
  },
  {
    op: "add",
    path: "/data/PROMISORY_EFFECT_OBSERVER_ID",
    value: candidate.effectObserverId,
  },
];
function save(file: string, data: unknown) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, { flag: "wx" });
}
save(`${directory}/executor.deployment.patch.json`, deploymentPatch);
save(`${directory}/executor.configmap.patch.json`, configPatch);
const expectedTemplate = structuredClone(deployment.spec.template);
expectedTemplate.spec.containers[0].image = candidate.image;
const expectedData = {
  ...config.data,
  PROMISORY_EFFECT_OBSERVER_ID: candidate.effectObserverId,
};
const dryConfig = kube([
  "patch",
  "configmap",
  name,
  "--type=json",
  "--patch-file",
  `${directory}/executor.configmap.patch.json`,
  "--dry-run=server",
  "-o",
  "json",
]);
const dryDeployment = kube([
  "patch",
  "deployment",
  name,
  "--type=json",
  "--patch-file",
  `${directory}/executor.deployment.patch.json`,
  "--dry-run=server",
  "-o",
  "json",
]);
if (
  canonicalJson(dryConfig.data) !== canonicalJson(expectedData) ||
  canonicalJson(dryDeployment.spec.template) !== canonicalJson(expectedTemplate)
)
  throw new Error(
    "Server dry-run changed more than the reviewed image and observer identifier.",
  );
const sha = (value: unknown) =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");
const report = {
  schemaVersion: "promisory.effect-binding-fix-preparation.v1",
  recordedAt: new Date().toISOString(),
  operationId: candidate.operationId,
  previousGeneration: deployment.metadata.generation,
  previousImage: candidate.previousImage,
  image: candidate.image,
  effectObserverId: candidate.effectObserverId,
  deploymentPatch: `${directory}/executor.deployment.patch.json`,
  configPatch: `${directory}/executor.configmap.patch.json`,
  expectedTemplateSha256: sha(expectedTemplate),
  expectedConfigDataSha256: sha(expectedData),
  serverDryRunsPassed: true,
  policyAndProbesPreserved: true,
  claimFileCount: before.claimFileCount,
  resourcesApplied: false,
};
save(`${evidence}/effect-binding-deployment-preparation.json`, report);
save(`${evidence}/effect-binding-deployment.patch.json`, deploymentPatch);
save(`${evidence}/effect-binding-configmap.patch.json`, configPatch);
console.log(JSON.stringify(report));
