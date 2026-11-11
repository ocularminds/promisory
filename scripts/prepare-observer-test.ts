import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";

// Preparation only: every patch invocation includes --dry-run=server.
const context = "decionis-aks";
const namespace = "decionis";
const deploymentName = "decionis-api";
const containerName = "api";
const variable = "DECIONIS_TRUSTED_EFFECT_OBSERVER_API_KEY_IDS";
const observerId = "c97a5168-1325-487c-94e8-e3d4b06adffd";
const directory = "release/azure-test-review";
const deploymentSchema = z.object({
  metadata: z.object({
    name: z.literal(deploymentName),
    namespace: z.literal(namespace),
    uid: z.uuid(),
    resourceVersion: z.string().regex(/^\d+$/),
  }),
  spec: z.object({
    template: z.object({
      spec: z.object({
        containers: z.array(
          z.object({
            name: z.string(),
            env: z
              .array(
                z.object({
                  name: z.string(),
                  value: z.string().optional(),
                  valueFrom: z.unknown().optional(),
                }),
              )
              .optional(),
          }),
        ),
      }),
    }),
  }),
});
function kubectl(args: string[]): unknown {
  try {
    return JSON.parse(
      execFileSync(
        "kubectl",
        ["--context", context, "-n", namespace, ...args],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 30_000,
        },
      ),
    );
  } catch {
    // API responses can contain other container environment values.
    throw new Error(
      "Scoped Kubernetes read/dry run failed; raw output withheld.",
    );
  }
}
const before = deploymentSchema.parse(
  kubectl(["get", "deployment", deploymentName, "-o", "json"]),
);
const containerIndex = before.spec.template.spec.containers.findIndex(
  (container) => container.name === containerName,
);
const container = before.spec.template.spec.containers[containerIndex];
if (!container) throw new Error("Expected API container was not found.");
const matches = (container.env ?? []).filter((item) => item.name === variable);
if (matches.length > 1 || matches[0]?.valueFrom !== undefined)
  throw new Error(
    "Observer configuration needs owner review; no patch prepared.",
  );
const previousIds = (matches[0]?.value ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (previousIds.some((value) => !z.uuid().safeParse(value).success))
  throw new Error(
    "Observer list contains an unexpected value; no patch prepared.",
  );
const proposedIds = previousIds.includes(observerId)
  ? previousIds
  : [...previousIds, observerId];
const changeNeeded = !previousIds.includes(observerId);
const base = `/spec/template/spec/containers/${containerIndex}`;
const patch: Array<{ op: string; path: string; value: unknown }> = [
  { op: "test", path: "/metadata/uid", value: before.metadata.uid },
  {
    op: "test",
    path: "/metadata/resourceVersion",
    value: before.metadata.resourceVersion,
  },
  { op: "test", path: `${base}/name`, value: containerName },
];
if (changeNeeded) {
  const entry = { name: variable, value: proposedIds.join(",") };
  if (!container.env)
    patch.push({ op: "add", path: `${base}/env`, value: [entry] });
  else if (matches.length) {
    const index = container.env.findIndex((item) => item.name === variable);
    patch.push({ op: "replace", path: `${base}/env/${index}`, value: entry });
  } else patch.push({ op: "add", path: `${base}/env/-`, value: entry });
}
await mkdir(directory, { recursive: true });
const patchPath = `${directory}/observer-append.patch.json`;
await writeFile(patchPath, `${JSON.stringify(patch, null, 2)}\n`, {
  mode: 0o600,
});
const predicted = deploymentSchema.parse(
  kubectl([
    "patch",
    "deployment",
    deploymentName,
    "--type=json",
    "--patch-file",
    patchPath,
    "--dry-run=server",
    "-o",
    "json",
  ]),
);
const predictedIds =
  predicted.spec.template.spec.containers
    .find((item) => item.name === containerName)
    ?.env?.find((item) => item.name === variable)
    ?.value?.split(",") ?? [];
if (JSON.stringify(predictedIds) !== JSON.stringify(proposedIds))
  throw new Error("Observer dry run did not preserve the expected IDs.");
const after = deploymentSchema.parse(
  kubectl(["get", "deployment", deploymentName, "-o", "json"]),
);
if (
  after.metadata.uid !== before.metadata.uid ||
  after.metadata.resourceVersion !== before.metadata.resourceVersion
)
  throw new Error(
    "API deployment changed during preparation; regenerate the patch.",
  );
const report = {
  schemaVersion: "promisory.observer-preflight.v1",
  recordedAt: new Date().toISOString(),
  context,
  namespace,
  deployment: deploymentName,
  container: containerName,
  environmentVariable: variable,
  appendApiKeyId: observerId,
  previousIds,
  proposedIds,
  changeNeeded,
  concurrencyGuards: ["deployment-uid", "resource-version", "container-name"],
  serverDryRunAccepted: true,
  realDeploymentUnchanged: true,
  applied: false,
  sharedApiRollout: false,
  requiresOwnerAuthorization: true,
};
await writeFile(
  `${directory}/observer-review.json`,
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report));
