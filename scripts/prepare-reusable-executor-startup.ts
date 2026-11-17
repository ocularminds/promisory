/** Park expired test-only preloads without changing their retained evidence. */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const name = "promisory-test-executor";
const uid = "d2900804-2853-4318-8aa7-488c4d9a5fb0";
const image =
  "decionisacr.azurecr.io/promisory/executor@sha256:f30b1ab4606a5170bc3b1dc42d4b38599d50f5cf3053003dd6b84a3f49aaea7b";
const policy = "33c97bbd-7ab7-424a-b7d6-a069277d1101";
const oldArgs = [
  "--import",
  "/app/recovery-probe.mjs",
  "--import",
  "/app/recovery-history-observer.mjs",
  "/app/server.js",
];
const newArgs = ["/app/server.js"];
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
    throw new Error("Scoped Kubernetes read/dry-run failed; no raw output retained.");
  }
}
const deployment = kube(["get", "deployment", name, "-o", "json"]);
const config = kube(["get", "configmap", name, "-o", "json"]);
const container = deployment.spec.template.spec.containers[0];
if (
  deployment.metadata.uid !== uid ||
  deployment.spec.replicas !== 1 ||
  deployment.spec.strategy.type !== "Recreate" ||
  container.name !== "executor" ||
  container.image !== image ||
  JSON.stringify(container.command) !== JSON.stringify(["node"]) ||
  config.data.PROMISORY_AUTHORITY_POLICY_ID !== policy ||
  config.data.PROMISORY_MODE !== "ENFORCEMENT" ||
  config.data.PROMISORY_ENFORCEMENT_VERIFIED !== "true"
)
  throw new Error("The reviewed test executor binding changed.");
if (JSON.stringify(container.args) === JSON.stringify(newArgs)) {
  process.stdout.write("Expired test preloads are already parked.\n");
  process.exit(0);
}
if (JSON.stringify(container.args) !== JSON.stringify(oldArgs))
  throw new Error("Unrecognized executor startup; no patch prepared.");
const patch = [
  { op: "test", path: "/metadata/uid", value: uid },
  {
    op: "test",
    path: "/metadata/resourceVersion",
    value: deployment.metadata.resourceVersion,
  },
  { op: "test", path: "/spec/template/spec/containers/0/name", value: "executor" },
  { op: "test", path: "/spec/template/spec/containers/0/image", value: image },
  { op: "test", path: "/spec/template/spec/containers/0/command", value: ["node"] },
  { op: "test", path: "/spec/template/spec/containers/0/args", value: oldArgs },
  { op: "replace", path: "/spec/template/spec/containers/0/args", value: newArgs },
];
const directory = "release/reusable-executor-startup";
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/deployment.patch.json`, JSON.stringify(patch, null, 2) + "\n");
kube([
  "patch", "deployment", name, "--type=json",
  `--patch-file=${directory}/deployment.patch.json`, "--dry-run=server", "-o", "json",
]);
const review = {
  schemaVersion: "promisory.reusable-executor-startup-review.v1",
  preparedAt: new Date().toISOString(),
  deployment: { uid, resourceVersion: deployment.metadata.resourceVersion, image },
  policy,
  previousArguments: oldArgs,
  arguments: newArgs,
  reason: "The test-only preloads expired on 12 November 2026 and refuse process startup under the new selector.",
  retained: "The probe and history ConfigMaps, mounts, environment flags, private volume, original operation, sealed claim and one-use marker are not mutated. The production server retains normal grant, claim, execution and reconciliation checks.",
  serverDryRun: "PASSED",
};
writeFileSync(`${directory}/review.json`, JSON.stringify(review, null, 2) + "\n");
process.stdout.write(JSON.stringify(review, null, 2) + "\n");
