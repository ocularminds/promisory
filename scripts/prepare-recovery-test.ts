/** Prepare and server-dry-run the isolated recovery probe; never apply it. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { recoveryScope } from "./live/recovery-probe";

const root = resolve(import.meta.dirname, "..");
const { values } = parseArgs({ options: { output: { type: "string" } } });
if (!values.output)
  throw new Error("Use --output <new-directory-under-release>.");
const output = resolve(root, values.output);
if (!output.startsWith(`${resolve(root, "release")}${sep}`))
  throw new Error("Keep the prepared files in a new release directory.");
const context = ["--context=decionis-aks", "-n", "decionis"];
function kubectl(args: string[]) {
  try {
    return execFileSync("kubectl", [...context, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch {
    throw new Error(
      "The scoped Kubernetes read/dry-run failed. No raw provider output retained.",
    );
  }
}
const deployment = JSON.parse(
  kubectl(["get", "deployment", "promisory-test-executor", "-o", "json"]),
);
const config = JSON.parse(
  kubectl(["get", "configmap", "promisory-test-executor", "-o", "json"]),
);
const expectedImage =
  "decionisacr.azurecr.io/promisory/executor@sha256:a387bebb193e4ad99e8fe0d10808a73bae875e6198202b95d77a4da48169bc4a";
const expectedRuntime: Record<string, string> = {
  PROMISORY_APP_ID: recoveryScope.appId,
  PROMISORY_ENVIRONMENT_ID: recoveryScope.environmentId,
  PROMISORY_INSTALLATION_ID: recoveryScope.installationId,
  PROMISORY_CLOUD_ID: recoveryScope.cloudId,
  PROMISORY_ORGANIZATION_ID: recoveryScope.organizationId,
  PROMISORY_AUTHORITY_POLICY_ID: recoveryScope.originalPolicyId,
  PROMISORY_AUTHORITY_URL: "https://api.decionis.com",
  PROMISORY_STATE_DIRECTORY: recoveryScope.stateDirectory,
  PROMISORY_MODE: "ENFORCEMENT",
  PROMISORY_ENFORCEMENT_VERIFIED: "true",
  PROMISORY_SHARE_DUE_DATE_INTENT: "true",
  PROMISORY_SHARE_JIRA_DATE_SNAPSHOT: "true",
};
const pod = deployment.spec?.template?.spec;
const container = pod?.containers?.[0];
if (
  deployment.metadata?.uid !== "d2900804-2853-4318-8aa7-488c4d9a5fb0" ||
  config.metadata?.uid !== "e45ab236-9b35-4dda-84a6-18224679fb5f" ||
  deployment.spec?.replicas !== 1 ||
  deployment.status?.readyReplicas !== 1 ||
  pod?.containers?.length !== 1 ||
  container?.name !== "executor" ||
  container.image !== expectedImage ||
  container.command !== undefined ||
  container.args !== undefined ||
  !Array.isArray(container.volumeMounts) ||
  !Array.isArray(pod.volumes) ||
  Object.entries(expectedRuntime).some(
    ([key, value]) => config.data?.[key] !== value,
  ) ||
  Date.now() >= Date.parse(recoveryScope.expiresAt)
)
  throw new Error(
    "The current verified, single-instance test deployment does not match this plan.",
  );
if (
  container.env?.some(
    (entry: { name: string }) => entry.name === "PROMISORY_RECOVERY_PROBE",
  )
)
  throw new Error(
    "A recovery probe is already configured. Inspect it rather than appending another.",
  );

const probe = `const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const directory=path.join(process.env.PROMISORY_STATE_DIRECTORY,'operations');
const files=fs.readdirSync(directory,{withFileTypes:true}).filter(f=>f.isFile()&&/^[a-f0-9]{64}\\.json$/.test(f.name));
if(files.length>100)throw new Error('Operation bound exceeded');
let pending=0;
for(const file of files){const bytes=fs.readFileSync(path.join(directory,file.name));if(bytes.length>32768)throw new Error('Record bound exceeded');const r=JSON.parse(bytes.toString('utf8'));if(r.state!=='SETTLED'||!['SUCCEEDED','HELD','BLOCKED','FAILED'].includes(r.result?.stage)||!['RECORDED','NOT_REQUIRED'].includes(r.result?.finalization))pending++;}
const claims=fs.readdirSync(path.join(process.env.PROMISORY_STATE_DIRECTORY,'claims'),{withFileTypes:true}).filter(f=>f.isFile()).length;
const expected=${JSON.stringify(expectedRuntime)};
console.log(JSON.stringify({operationCount:files.length,pendingOperationCount:pending,claimFileCount:claims,runtimeMatches:Object.entries(expected).every(([key,value])=>process.env[key]===value),serverSha256:crypto.createHash('sha256').update(fs.readFileSync('/app/server.js')).digest('hex'),node:process.version,uid:process.getuid(),platform:process.platform,architecture:process.arch}));`;
const state = JSON.parse(
  kubectl([
    "exec",
    "deployment/promisory-test-executor",
    "-c",
    "executor",
    "--",
    "node",
    "-e",
    probe,
  ]),
);
if (
  state.pendingOperationCount !== 0 ||
  state.claimFileCount !== 0 ||
  state.runtimeMatches !== true ||
  state.serverSha256 !==
    "9443e31f8b66a0fd6eba38aa599b3072dc3c4edb51d7f7a37abb4ddd9fbe513b" ||
  state.node !== "v22.23.4" ||
  state.uid !== 1000 ||
  state.platform !== "linux" ||
  state.architecture !== "x64"
)
  throw new Error(
    "Finish existing reconciliation before preparing a process restart.",
  );

const policyPath = "docs/authority/promisory-dci-recovery-policy.draft.json";
const policyBytes = readFileSync(resolve(root, policyPath));
const policy = JSON.parse(policyBytes.toString("utf8"));
const approved = JSON.parse(
  readFileSync(
    resolve(root, "docs/authority/promisory-dci-policy.v3.approved.json"),
    "utf8",
  ),
);
const expectedConditions = structuredClone(approved.rules[0].when.all);
for (const condition of expectedConditions) {
  if (condition.field === "agent_safe.action.parameters.expectedDueDate")
    condition.value = "^2026-11-18$";
  if (condition.field === "agent_safe.action.parameters.desiredDueDate")
    condition.value = "^2026-11-19$";
}
if (
  policy.bundle_id !== recoveryScope.policyId ||
  policy.org_id !== recoveryScope.organizationId ||
  policy.policy_id !== "promisory-test-jira-recovery" ||
  policy.version !== "promisory-recovery-test-v1" ||
  policy.effective_to !== recoveryScope.expiresAt ||
  policy.metadata?.requires_approval !== true ||
  policy.metadata?.approved_by !== undefined ||
  policy.rules?.length !== 2 ||
  JSON.stringify(policy.required_signals) !==
    JSON.stringify(approved.required_signals) ||
  JSON.stringify(policy.rules[0].when) !==
    JSON.stringify({ all: expectedConditions }) ||
  policy.rules[0].priority !== approved.rules[0].priority ||
  policy.rules[0].enabled !== true ||
  policy.rules[0].decision_domain !== approved.rules[0].decision_domain ||
  JSON.stringify(policy.rules[0].then) !==
    JSON.stringify(approved.rules[0].then) ||
  JSON.stringify(policy.rules[1]) !== JSON.stringify(approved.rules[1])
)
  throw new Error(
    "The unapproved recovery policy differs from the narrow reviewed scope.",
  );

const sourcePath = "scripts/live/recovery-probe.ts";
const source = readFileSync(resolve(root, sourcePath), "utf8");
const compiled = transpileModule(source, {
  compilerOptions: {
    module: ModuleKind.ES2022,
    target: ScriptTarget.ES2022,
    sourceMap: false,
  },
  reportDiagnostics: true,
});
if (compiled.diagnostics?.length)
  throw new Error("The recovery probe did not transpile cleanly.");
const digest = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const compiledDigest = digest(compiled.outputText);
const name = `promisory-recovery-${compiledDigest.slice(0, 12)}`;
if (pod.volumes.some((volume: { name: string }) => volume.name === name))
  throw new Error("This probe volume already exists. Inspect its prior run.");
const resource = {
  apiVersion: "v1",
  kind: "ConfigMap",
  metadata: {
    name,
    namespace: "decionis",
    labels: { "app.kubernetes.io/part-of": "promisory" },
  },
  immutable: true,
  data: { "recovery-probe.mjs": compiled.outputText },
};
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
    value: recoveryScope.originalPolicyId,
  },
  {
    op: "replace",
    path: "/data/PROMISORY_AUTHORITY_POLICY_ID",
    value: recoveryScope.policyId,
  },
];
const env = { name: "PROMISORY_RECOVERY_PROBE", value: "true" };
const annotation = "promisory.decionis.com/recovery-probe";
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
    value: expectedImage,
  },
  {
    op: "add",
    path: "/spec/template/spec/containers/0/command",
    value: ["node"],
  },
  {
    op: "add",
    path: "/spec/template/spec/containers/0/args",
    value: ["--import", "/app/recovery-probe.mjs", "/app/server.js"],
  },
  {
    op: "add",
    path:
      container.env === undefined
        ? "/spec/template/spec/containers/0/env"
        : "/spec/template/spec/containers/0/env/-",
    value: container.env === undefined ? [env] : env,
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
      mountPath: "/app/recovery-probe.mjs",
      subPath: "recovery-probe.mjs",
      readOnly: true,
    },
  },
  {
    op: "add",
    path:
      deployment.spec.template.metadata.annotations === undefined
        ? "/spec/template/metadata/annotations"
        : `/spec/template/metadata/annotations/${annotation.replaceAll("/", "~1")}`,
    value:
      deployment.spec.template.metadata.annotations === undefined
        ? { [annotation]: compiledDigest }
        : compiledDigest,
  },
];
mkdirSync(output, { recursive: false });
const save = (name: string, value: unknown) =>
  writeFileSync(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
  });
save("recovery-probe.configmap.json", resource);
save("executor.config.patch.json", configPatch);
save("executor.deployment.patch.json", deploymentPatch);
writeFileSync(resolve(output, "recovery-probe.mjs"), compiled.outputText, {
  flag: "wx",
});
kubectl([
  "apply",
  "--dry-run=server",
  "-f",
  resolve(output, "recovery-probe.configmap.json"),
  "-o",
  "name",
]);
kubectl([
  "patch",
  "configmap",
  "promisory-test-executor",
  "--type=json",
  "--patch-file",
  resolve(output, "executor.config.patch.json"),
  "--dry-run=server",
  "-o",
  "name",
]);
kubectl([
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
  schemaVersion: "promisory.recovery-test-preparation.v1",
  recordedAt: new Date().toISOString(),
  status: "PREPARED_NOT_APPLIED",
  output,
  policyPath,
  policyId: recoveryScope.policyId,
  policySha256: digest(policyBytes),
  sourcePath,
  sourceSha256: digest(source),
  compiledSha256: compiledDigest,
  image: expectedImage,
  configMapName: name,
  deploymentGeneration: deployment.metadata.generation,
  observedState: state,
  serverDryRunsPassed: 3,
  policiesPublishedByThisPreparation: false,
  approvalAndPolicyLifecycleCheckedByThisPreparation: false,
  resourcesApplied: false,
  grantsRequested: false,
  jiraRequestsMade: false,
  newPaidResources: false,
  cleanup:
    "Restore the original policy binding, remove only this probe's command/args/env/mount/volume/annotation using fresh concurrency guards, then remove the unused immutable probe ConfigMap. Preserve operation, claim and probe evidence; never erase the one-use marker to retry.",
};
save("review.json", report);
console.log(JSON.stringify(report, null, 2));
