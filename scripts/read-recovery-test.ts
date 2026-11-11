/** Read-only, bounded metadata collection for the approved live recovery test. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  digest,
  effectSchema,
  id,
  trustedContextSchema,
} from "@promisory/contracts";
import {
  executionResultSchema,
  journalRecordSchema,
} from "@promisory/integrations-decionis";
import {
  recoveryMarkerName,
  recoveryMarkerSchema,
  recoveryScope,
} from "./live/recovery-probe";
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
const installed = JSON.parse(
  readFileSync(
    resolve(root, "docs/evidence/2026-11-11-recovery-test/deployment.json"),
    "utf8",
  ),
);
if (!installed.passed || installed.policyId !== recoveryScope.policyId)
  throw new Error("The approved recovery deployment has not been verified.");
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
      "The owned recovery observation failed. No raw provider output retained.",
    );
  }
}
const deployment = JSON.parse(
  kube(["get", "deployment", "promisory-test-executor", "-o", "json"]),
);
if (
  deployment.metadata?.uid !== "d2900804-2853-4318-8aa7-488c4d9a5fb0" ||
  deployment.spec?.replicas !== 1 ||
  deployment.spec?.template?.spec?.containers?.length !== 1 ||
  deployment.spec.template.spec.containers[0].image !== runtime.image
)
  throw new Error("The owned single-instance deployment changed.");
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
if (ready.length !== 1)
  throw new Error(
    "Exactly one ready test pod is required for this observation.",
  );
const pod = ready[0];
if (
  pod.spec.containers.length !== 1 ||
  pod.spec.containers[0].image !== runtime.image ||
  !pod.spec.volumes.some(
    (volume: { persistentVolumeClaim?: { claimName: string } }) =>
      volume.persistentVolumeClaim?.claimName === "promisory-test-state",
  )
)
  throw new Error(
    "The expected image and retained state volume were not observed.",
  );
const pvc = JSON.parse(
  kube(["get", "pvc", "promisory-test-state", "-o", "json"]),
);
if (pvc.status?.phase !== "Bound")
  throw new Error("The test state volume is not bound.");
const expectedRuntime = {
  ...runtime.requiredEnvironment,
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
  PROMISORY_RECOVERY_PROBE: "true",
};
const probe = `
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const expected=${JSON.stringify(expectedRuntime)};
if(Object.entries(expected).some(([key,value])=>process.env[key]!==value))throw new Error('Runtime mismatch');
const pick=(value,names)=>Object.fromEntries(names.filter(name=>value[name]!==undefined).map(name=>[name,value[name]]));
const directory=path.join(process.env.PROMISORY_STATE_DIRECTORY,'operations');
const files=fs.readdirSync(directory,{withFileTypes:true}).filter(file=>file.isFile()&&/^[a-f0-9]{64}\\.json$/.test(file.name));
if(files.length>100)throw new Error('Operation bound exceeded');
let pending=0;
const operations=files.map(file=>{const bytes=fs.readFileSync(path.join(directory,file.name));if(bytes.length>32768)throw new Error('Record bound exceeded');const r=JSON.parse(bytes),e=r.envelope;if(r.state!=='SETTLED'||!['SUCCEEDED','HELD','BLOCKED','FAILED'].includes(r.result?.stage)||!['RECORDED','NOT_REQUIRED'].includes(r.result?.finalization))pending++;return {...pick(e,['context','operationId','proposalId','proposalHash','idempotencyKey']),effect:pick(e.effect,['kind','cloudId','issueId','expectedUpdatedAt','expectedDueDate','desiredDueDate']),state:r.state,acknowledged:r.acknowledged,...(r.authorization?{authorization:pick(r.authorization,['decisionId','dossierId','grantId','intentHash','expiresAt'])}:{}),...(r.result?{result:pick(r.result,['stage','mode','evaluationReference','grantReference','externalReceiptReference','observed','finalization'])}:{})};});
const markerPath=path.join(process.env.PROMISORY_STATE_DIRECTORY,'recovery-tests',${JSON.stringify(recoveryMarkerName)});
let marker=null,markerMode=null;
if(fs.existsSync(markerPath)){const bytes=fs.readFileSync(markerPath);if(bytes.length>4096)throw new Error('Marker bound exceeded');marker=pick(JSON.parse(bytes),['schemaVersion','policyId','operationId','phase','reservedAt','updatedAt','httpStatus']);markerMode=fs.statSync(markerPath).mode&511;}
const claimCount=fs.readdirSync(path.join(process.env.PROMISORY_STATE_DIRECTORY,'claims'),{withFileTypes:true}).filter(file=>file.isFile()).length;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
console.log(JSON.stringify({operations,pendingOperationCount:pending,claimFileCount:claimCount,marker,markerMode,probeSha256:sha('/app/recovery-probe.mjs'),serverSha256:sha('/app/server.js')}));
`;
const input = JSON.parse(
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
);
const envelope = z
  .strictObject({
    operations: z.array(z.unknown()).max(100),
    pendingOperationCount: z.number().int().min(0).max(100),
    claimFileCount: z.number().int().min(0).max(100),
    marker: recoveryMarkerSchema.nullable(),
    markerMode: z.number().int().nullable(),
    probeSha256: z.literal(installed.probeSha256 as string),
    serverSha256: z.literal(runtime.serverSha256),
  })
  .safeParse(input);
if (
  !envelope.success ||
  (envelope.data.marker && envelope.data.markerMode !== 0o600)
)
  throw new Error("The strict recovery metadata projection was refused.");
const operationSchema = z.strictObject({
  context: trustedContextSchema,
  operationId: id,
  proposalId: id,
  proposalHash: digest,
  idempotencyKey: id,
  effect: effectSchema,
  state: journalRecordSchema.shape.state,
  acknowledged: z.boolean(),
  authorization: journalRecordSchema.shape.authorization,
  result: executionResultSchema.omit({ message: true }).optional(),
});
const expectedContext = {
  appId: recoveryScope.appId,
  environmentId: recoveryScope.environmentId,
  installationId: recoveryScope.installationId,
  cloudId: recoveryScope.cloudId,
  principalAccountId: recoveryScope.principalAccountId,
};
const operations: z.infer<typeof operationSchema>[] = [];
let historicalOperationCount = 0;
for (const candidate of envelope.data.operations) {
  const parsed = operationSchema.safeParse(candidate);
  if (
    !parsed.success ||
    Object.entries(expectedContext).some(
      ([key, value]) =>
        parsed.data.context[key as keyof typeof expectedContext] !== value,
    )
  )
    throw new Error(
      "An operation does not match the owned installation/principal.",
    );
  const operation = parsed.data;
  if (
    operation.effect.cloudId !== recoveryScope.cloudId ||
    operation.effect.issueId !== recoveryScope.issueId
  )
    throw new Error("An operation has an unexpected target.");
  if (
    operation.effect.expectedDueDate === "2026-11-12" &&
    operation.effect.desiredDueDate === "2026-11-18"
  ) {
    historicalOperationCount++;
    continue;
  }
  if (
    operation.effect.expectedDueDate !== recoveryScope.expectedDueDate ||
    operation.effect.desiredDueDate !== recoveryScope.desiredDueDate
  )
    throw new Error("An operation has an unexpected effect.");
  operations.push(operation);
}
const marker = envelope.data.marker;
const attempted = marker
  ? operations.find((operation) => operation.operationId === marker.operationId)
  : undefined;
const acknowledgementSuppressed =
  marker?.phase === "ACKNOWLEDGEMENT_SUPPRESSED" &&
  (marker.httpStatus ?? 0) >= 200 &&
  (marker.httpStatus ?? 0) < 300;
const reconciledEffectRecorded = Boolean(
  acknowledgementSuppressed &&
  attempted &&
  !attempted.acknowledged &&
  attempted.authorization &&
  attempted.result?.stage === "SUCCEEDED" &&
  attempted.result.observed === "MATCHED_EFFECT" &&
  attempted.result.finalization === "RECORDED",
);
const report = {
  schemaVersion: "promisory.recovery-operation-observation.v1",
  recordedAt: new Date().toISOString(),
  source:
    "Owned test executor: strict operation/probe metadata and storage identity only",
  policyId: recoveryScope.policyId,
  mode: "ENFORCEMENT",
  runtimeProfile: runtime.profile,
  pod: {
    uid: z.uuid().parse(pod.metadata.uid),
    createdAt: z.iso.datetime().parse(pod.metadata.creationTimestamp),
    generation: deployment.metadata.generation,
    image: runtime.image,
  },
  storage: {
    claimUid: z.uuid().parse(pvc.metadata.uid),
    volumeName: z.string().max(200).parse(pvc.spec.volumeName),
    capacity: pvc.status.capacity.storage,
  },
  probeSha256: envelope.data.probeSha256,
  serverSha256: envelope.data.serverSha256,
  operationRecordCount: envelope.data.operations.length,
  historicalOperationCount,
  pendingOperationCount: envelope.data.pendingOperationCount,
  claimFileCount: envelope.data.claimFileCount,
  marker,
  operations,
  acknowledgementSuppressed,
  reconciledEffectRecorded,
  lostResponseRecoveryVerified: false,
  actionInvokedByCollector: false,
  claimContentsRead: false,
  status: reconciledEffectRecorded
    ? "RECONCILED_EFFECT_RECORDED"
    : !marker
      ? "AWAITING_REVIEWED_APPLY"
      : acknowledgementSuppressed && attempted?.result?.stage === "RECONCILING"
        ? "RECONCILIATION_REQUIRED"
        : "INSPECTION_REQUIRED",
};
writeFileSync(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, {
  flag: "wx",
});
console.log(JSON.stringify(report, null, 2));
