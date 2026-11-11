import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

// Read-only projection of the owned test executor's operation journal. Claim
// vault contents, credentials, provider messages and unrelated files are never
// read or printed. This command cannot invoke/retry/reconcile an action.
const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--output" || !args[1]))
  throw new Error("Use optional --output <new-evidence-file>.");
const expected = JSON.parse(
  readFileSync(
    resolve(
      root,
      "docs/evidence/2026-11-11-hosted-invocation/executor-runtime.json",
    ),
    "utf8",
  ),
) as {
  context: Omit<z.infer<typeof trustedContextSchema>, "principalAccountId">;
};
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
const probe = `
const fs = require('node:fs'), path = require('node:path');
const directory = path.join(process.env.PROMISORY_STATE_DIRECTORY, 'operations');
const files = fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true })
  .filter(file => file.isFile() && /^[a-f0-9]{64}\\.json$/.test(file.name)) : [];
if (files.length > 100) throw new Error('Operation read bound exceeded');
const pick = (value, names) => Object.fromEntries(names.filter(name => value[name] !== undefined).map(name => [name, value[name]]));
const operations = files.map(file => {
  const bytes = fs.readFileSync(path.join(directory, file.name));
  if (bytes.length > 32768) throw new Error('Operation size bound exceeded');
  const record = JSON.parse(bytes.toString('utf8')), envelope = record.envelope;
  return {
    ...pick(envelope, ['context', 'operationId', 'proposalId', 'proposalHash', 'idempotencyKey']),
    effect: pick(envelope.effect, ['kind', 'cloudId', 'issueId', 'expectedUpdatedAt', 'expectedDueDate', 'desiredDueDate']),
    state: record.state, acknowledged: record.acknowledged,
    ...(record.authorization ? { authorization: pick(record.authorization, ['decisionId', 'dossierId', 'grantId', 'intentHash', 'expiresAt']) } : {}),
    ...(record.result ? { result: pick(record.result, ['stage', 'mode', 'evaluationReference', 'grantReference', 'externalReceiptReference', 'observed', 'finalization']) } : {})
  };
});
console.log(JSON.stringify({ mode: process.env.PROMISORY_MODE, verified: process.env.PROMISORY_ENFORCEMENT_VERIFIED,
  policyId: process.env.PROMISORY_AUTHORITY_POLICY_ID, operations }));
`;
let input: unknown;
try {
  input = JSON.parse(
    execFileSync(
      "kubectl",
      [
        "--context=decionis-aks",
        "-n",
        "decionis",
        "exec",
        "deployment/promisory-test-executor",
        "-c",
        "executor",
        "--",
        "node",
        "-e",
        probe,
      ],
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
    "The operation projection could not be read. No provider output was retained.",
  );
}
const parsed = z
  .strictObject({
    mode: z.literal("ENFORCEMENT"),
    verified: z.literal("true"),
    policyId: z.literal("457e04a4-0a1d-4f18-8bca-7a9a5df2adc8"),
    operations: z.array(z.unknown()).max(100),
  })
  .safeParse(input);
if (!parsed.success)
  throw new Error("The expected active test runtime was not observed.");
let rejectedRecordCount = 0;
const operations: z.infer<typeof operationSchema>[] = [];
for (const entry of parsed.data.operations) {
  const candidate = operationSchema.safeParse(entry);
  if (!candidate.success) {
    rejectedRecordCount++;
    continue;
  }
  const value = candidate.data;
  if (
    value.context.principalAccountId !==
      "712020:2921f941-93f4-4ccb-9c03-2555a8bfe3d9" ||
    Object.entries(expected.context).some(
      ([key, target]) =>
        value.context[key as keyof typeof value.context] !== target,
    ) ||
    value.effect.cloudId !== expected.context.cloudId ||
    value.effect.issueId !== "10001" ||
    value.effect.expectedDueDate !== "2026-11-12" ||
    value.effect.desiredDueDate !== "2026-11-18"
  ) {
    rejectedRecordCount++;
    continue;
  }
  operations.push(value);
}
const successful = operations.filter(
  (value) =>
    value.state === "SETTLED" &&
    value.acknowledged &&
    value.authorization &&
    value.result?.stage === "SUCCEEDED" &&
    value.result.mode === "ENFORCEMENT" &&
    value.result.observed === "MATCHED_EFFECT" &&
    value.result.finalization === "RECORDED",
);
const report = {
  schemaVersion: "promisory.test-operation-observation.v1",
  recordedAt: new Date().toISOString(),
  source:
    "Owned test executor journal; allowlisted metadata and approved date effect only",
  mode: parsed.data.mode,
  enforcementVerified: true,
  policyId: parsed.data.policyId,
  operationRecordCount: parsed.data.operations.length,
  rejectedRecordCount,
  operations,
  successfulFinalizedOperationIds: successful.map((value) => value.operationId),
  acknowledgedJiraWriteAndReadbackVerified: successful.length > 0,
  lostResponseRecoveryVerified: false,
  actionInvokedByCollector: false,
  status: successful.length
    ? "GOVERNED_ACTION_VERIFIED"
    : operations.some(
          (value) =>
            value.state !== "SETTLED" ||
            value.result?.stage === "RECONCILING" ||
            value.result?.finalization === "PENDING",
        )
      ? "RECONCILIATION_REQUIRED"
      : operations.length
        ? "ACTION_NOT_SUCCEEDED"
        : "AWAITING_REVIEWED_APPLY",
};
if (args[1])
  writeFileSync(
    resolve(root, args[1]),
    `${JSON.stringify(report, null, 2)}\n`,
    { flag: "wx" },
  );
console.log(JSON.stringify(report, null, 2));
if (!successful.length) process.exitCode = 2;
