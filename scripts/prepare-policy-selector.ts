/**
 * Review/dry-run only: generate the guarded ConfigMap patch that points the
 * owned test executor at the published reusable policy revision.
 *
 * It reads only the Promisory-owned ConfigMap and Deployment, writes the
 * concurrency-guarded JSON patch and a review file, and runs a server dry run.
 * Applying the patch and restarting the single replica are separate, explicit
 * operator commands printed at the end. No secret value is read or written.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const NAME = "promisory-test-executor";
const CONFIG_UID = "e45ab236-9b35-4dda-84a6-18224679fb5f";
const DEPLOYMENT_UID = "d2900804-2853-4318-8aa7-488c4d9a5fb0";
const RETAINED_RECOVERY_POLICY = "436f37a4-311f-4dd5-aa07-5a197ed277ed";
const REUSABLE_POLICY = "33c97bbd-7ab7-424a-b7d6-a069277d1101";

function kube(args: string[], json = true) {
  try {
    const out = execFileSync(
      "kubectl",
      ["--context=decionis-aks", "-n", "decionis", ...args],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    return json ? JSON.parse(out) : out;
  } catch {
    throw new Error(
      "Scoped Kubernetes read/dry-run failed; no raw provider output retained.",
    );
  }
}

const config = kube(["get", "configmap", NAME, "-o", "json"]);
const deployment = kube(["get", "deployment", NAME, "-o", "json"]);
if (
  config.metadata.uid !== CONFIG_UID ||
  deployment.metadata.uid !== DEPLOYMENT_UID ||
  deployment.spec.replicas !== 1 ||
  deployment.spec.strategy?.type !== "Recreate" ||
  config.data.PROMISORY_MODE !== "ENFORCEMENT" ||
  config.data.PROMISORY_ENFORCEMENT_VERIFIED !== "true" ||
  ![RETAINED_RECOVERY_POLICY, REUSABLE_POLICY].includes(
    config.data.PROMISORY_AUTHORITY_POLICY_ID,
  )
)
  throw new Error(
    "The owned executor or its enforcement settings differ from the reviewed state.",
  );
if (config.data.PROMISORY_AUTHORITY_POLICY_ID === REUSABLE_POLICY) {
  process.stdout.write("The executor already selects the reusable policy.\n");
  process.exit(0);
}

const patch = [
  { op: "test", path: "/metadata/uid", value: CONFIG_UID },
  {
    op: "test",
    path: "/metadata/resourceVersion",
    value: config.metadata.resourceVersion,
  },
  {
    op: "test",
    path: "/data/PROMISORY_AUTHORITY_POLICY_ID",
    value: RETAINED_RECOVERY_POLICY,
  },
  {
    op: "replace",
    path: "/data/PROMISORY_AUTHORITY_POLICY_ID",
    value: REUSABLE_POLICY,
  },
];
const directory = "release/policy-selector";
mkdirSync(directory, { recursive: true });
writeFileSync(
  `${directory}/configmap.patch.json`,
  `${JSON.stringify(patch, null, 2)}\n`,
);
kube(
  [
    "patch",
    "configmap",
    NAME,
    "--type=json",
    `--patch-file=${directory}/configmap.patch.json`,
    "--dry-run=server",
    "-o",
    "json",
  ],
  true,
);
const review = {
  schemaVersion: "promisory.policy-selector-review.v1",
  preparedAt: new Date().toISOString(),
  configMap: {
    uid: CONFIG_UID,
    resourceVersion: config.metadata.resourceVersion,
  },
  deployment: {
    uid: DEPLOYMENT_UID,
    image: deployment.spec.template.spec.containers[0].image,
  },
  from: RETAINED_RECOVERY_POLICY,
  to: REUSABLE_POLICY,
  retained:
    "The expired recovery revision and its INDETERMINATE claim stay in Decionis and on the private disk. Reconciliation does not depend on the selector.",
  serverDryRun: "PASSED",
};
writeFileSync(
  `${directory}/review.json`,
  `${JSON.stringify(review, null, 2)}\n`,
);
process.stdout.write(
  `${JSON.stringify(review, null, 2)}\n\nApply after review:\n` +
    `  kubectl --context=decionis-aks -n decionis patch configmap ${NAME} --type=json --patch-file=${directory}/configmap.patch.json\n` +
    `  kubectl --context=decionis-aks -n decionis rollout restart deployment/${NAME}\n` +
    `  kubectl --context=decionis-aks -n decionis rollout status deployment/${NAME} --timeout=180s\n`,
);
