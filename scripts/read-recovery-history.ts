/** Read only the closed projection made by the temporary native history observer. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { historyObservationSchema } from "./live/recovery-history-observer";
import { recoveryRuntime } from "./live/recovery-runtime";

const root = resolve(import.meta.dirname, "..");
const { values } = parseArgs({
  options: { output: { type: "string" }, runtime: { type: "string" } },
});
const runtime = recoveryRuntime(root, values.runtime);
const output = z
  .string()
  .regex(/^docs\/evidence\/2026-11-11-recovery-test\/[a-z0-9-]+\.json$/)
  .parse(values.output);
const prepared = JSON.parse(
  readFileSync(
    resolve(root, "release/recovery-history-observer/review.json"),
    "utf8",
  ),
);
function kube(args: string[]) {
  try {
    return execFileSync(
      "kubectl",
      ["--context=decionis-aks", "-n", "decionis", ...args],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
        maxBuffer: 128 * 1024,
      },
    );
  } catch {
    throw new Error(
      "The scoped history read failed. No raw provider or state output retained.",
    );
  }
}
const deployment = JSON.parse(
  kube(["get", "deployment", "promisory-test-executor", "-o", "json"]),
);
if (
  deployment.metadata?.uid !== "d2900804-2853-4318-8aa7-488c4d9a5fb0" ||
  deployment.spec?.replicas !== 1 ||
  deployment.status?.readyReplicas !== 1 ||
  deployment.spec?.template?.spec?.containers?.length !== 1 ||
  deployment.spec.template.spec.containers[0].image !== runtime.image ||
  deployment.spec.template.metadata.annotations?.[
    "promisory.decionis.com/recovery-history-observer"
  ] !== prepared.compiledSha256
)
  throw new Error("The owned observer deployment changed.");
const selector = Object.entries(deployment.spec.selector.matchLabels)
  .map(([key, value]) => `${key}=${value}`)
  .join(",");
const pods = JSON.parse(
  kube(["get", "pods", "-l", selector, "-o", "json"]),
).items;
const ready = pods.filter(
  (pod: {
    metadata: { deletionTimestamp?: string };
    status?: { conditions?: { type: string; status: string }[] };
  }) =>
    !pod.metadata.deletionTimestamp &&
    pod.status?.conditions?.some(
      (condition) => condition.type === "Ready" && condition.status === "True",
    ),
);
if (
  ready.length !== 1 ||
  ready[0].spec.containers?.[0]?.image !== runtime.image
)
  throw new Error(
    "Exactly one ready observer pod with the reviewed image is required.",
  );
const pod = ready[0];
const probe = `
(async()=>{const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(process.env.PROMISORY_RECOVERY_HISTORY_OBSERVER!=='true'||sha('/app/recovery-history-observer.mjs')!==${JSON.stringify(prepared.compiledSha256)}||sha('/app/recovery-probe.mjs')!==${JSON.stringify(prepared.originalProbeSha256)})throw Error('Observer mismatch');
console.info=()=>{};
const {historyObservationSchema,historyObservationName}=await import('/app/recovery-history-observer.mjs');
const rows=[];
for(const startAt of [0,100,200,300,400]){const name=startAt===0?historyObservationName:historyObservationName.replace('.json','-'+startAt+'.json');const file=path.join('/var/lib/promisory/recovery-tests',name);if(!fs.existsSync(file))continue;const stat=fs.lstatSync(file);if(!stat.isFile()||(stat.mode&511)!==384||stat.size>16384)throw Error('Observation bound exceeded');const row=historyObservationSchema.parse(JSON.parse(fs.readFileSync(file,'utf8')));if(row.startAt!==startAt)throw Error('Observation page mismatch');rows.push(row);}
console.log(JSON.stringify({observations:rows,observerSha256:sha('/app/recovery-history-observer.mjs'),originalProbeSha256:sha('/app/recovery-probe.mjs')}));
})().catch(()=>process.exit(1));
`;
const parsed = z
  .strictObject({
    observations: z.array(historyObservationSchema).max(5),
    observerSha256: z.literal(prepared.compiledSha256 as string),
    originalProbeSha256: z.literal(prepared.originalProbeSha256 as string),
  })
  .parse(
    JSON.parse(
      kube([
        "exec",
        `pod/${pod.metadata.name}`,
        "-c",
        "executor",
        "--",
        "node",
        "-e",
        probe,
      ]),
    ),
  );
const report = {
  schemaVersion: "promisory.recovery-history-read.v1",
  recordedAt: new Date().toISOString(),
  runtimeProfile: runtime.profile,
  pod: {
    uid: pod.metadata.uid,
    createdAt: pod.metadata.creationTimestamp,
    generation: deployment.metadata.generation,
    image: runtime.image,
  },
  ...parsed,
  actionInvokedByCollector: false,
  claimContentsRead: false,
  status: parsed.observations.length
    ? "NATIVE_HISTORY_OBSERVED"
    : "AWAITING_NATIVE_RECONCILIATION_READ",
};
writeFileSync(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, {
  flag: "wx",
});
console.log(JSON.stringify(report, null, 2));
