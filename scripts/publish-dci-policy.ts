/**
 * Publish one reviewed Promisory policy bundle to the bound DCI organization
 * and verify its exact read-back. Credentials come from the ignored .env file
 * and never appear in output or evidence. Without --apply, nothing is sent.
 */
import { loadEnvFile } from "node:process";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { readFile, writeFile, access } from "node:fs/promises";
import { z } from "zod";

const { values } = parseArgs({
  options: {
    policy: { type: "string" },
    output: { type: "string" },
    apply: { type: "boolean", default: false },
  },
});
const policyPath = z
  .string()
  .regex(/^docs\/authority\/promisory-dci-[a-z0-9.-]+\.json$/)
  .parse(values.policy);
const output = z
  .string()
  .regex(/^docs\/evidence\/[a-z0-9-]+\/[a-z0-9-]+\.json$/)
  .parse(values.output);
try {
  await access(output);
  throw new Error(`Refusing to overwrite existing evidence ${output}`);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const ORG = "124e5022-6eee-4717-ab65-a03899db6237";
const bundle = z
  .looseObject({
    protocol_version: z.literal("1.0"),
    bundle_id: z.uuid(),
    policy_id: z.string().regex(/^promisory-[a-z0-9-]+$/),
    org_id: z.literal(ORG),
    version: z.string().min(1),
    effective_from: z.iso.datetime(),
    effective_to: z.iso.datetime(),
    rules: z.array(z.unknown()).min(2),
    metadata: z.looseObject({ requires_approval: z.literal(true) }),
  })
  .parse(JSON.parse(await readFile(policyPath, "utf8")));

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [
              key,
              canonical((value as Record<string, unknown>)[key]),
            ]),
        )
      : value;
const digest = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
const requestSha256 = digest(bundle);

const evidence: Record<string, unknown> = {
  mode: values.apply ? "LIVE_POLICY_PUBLICATION" : "DRY_RUN",
  recordedAt: new Date().toISOString(),
  organizationId: ORG,
  policyFile: policyPath,
  policyId: bundle.policy_id,
  bundleId: bundle.bundle_id,
  version: bundle.version,
  effectiveFrom: bundle.effective_from,
  expiresAt: bundle.effective_to,
  requestSha256,
};

if (values.apply) {
  loadEnvFile(".env");
  const settings = z
    .object({
      DECIONIS_API_BASE: z.literal("https://api.decionis.com"),
      DECIONIS_ORG_ID: z.literal(ORG),
      DECIONIS_POLICY_API_KEY: z.string().min(1),
    })
    .parse(process.env);
  const headers = {
    authorization: `Bearer ${settings.DECIONIS_POLICY_API_KEY}`,
    "content-type": "application/json",
    "idempotency-key": `promisory-policy-${bundle.bundle_id}`,
  };
  const published = await fetch(
    `${settings.DECIONIS_API_BASE}/v1/protocol/policies/bundles`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(bundle),
      redirect: "error",
    },
  );
  const publishedBody = (await published.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  evidence.httpStatus = published.status;
  evidence.accepted = published.ok && publishedBody.accepted !== false;
  evidence.responseKeys = Object.keys(publishedBody).sort();
  evidence.artifactId =
    typeof publishedBody.artifact_id === "string"
      ? publishedBody.artifact_id
      : null;
  if (!published.ok) {
    evidence.error =
      typeof publishedBody.error === "string" ? publishedBody.error : null;
    evidence.message =
      typeof publishedBody.message === "string" ? publishedBody.message : null;
    // Validation issues describe the policy document, not credentials.
    evidence.validationErrors = Array.isArray(publishedBody.errors)
      ? publishedBody.errors
      : Array.isArray(publishedBody.issues)
        ? publishedBody.issues
        : null;
  } else {
    const list = await fetch(
      `${settings.DECIONIS_API_BASE}/v1/protocol/policies/bundles?org_id=${ORG}&limit=500`,
      { headers: { authorization: headers.authorization }, redirect: "error" },
    );
    evidence.readBackStatus = list.status;
    evidence.readBackAt = new Date().toISOString();
    const body = (await list.json().catch(() => null)) as unknown;
    // The list wraps artifacts differently across service versions; search for the exact bundle.
    const found: Record<string, unknown>[] = [];
    const visit = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === "object") {
        const record = node as Record<string, unknown>;
        if (record.bundle_id === bundle.bundle_id) found.push(record);
        Object.values(record).forEach(visit);
      }
    };
    visit(body);
    const exact = found.find(
      (candidate) => digest(candidate) === requestSha256,
    );
    evidence.readBackMatches = found.length;
    evidence.exactPayloadVerified = Boolean(exact);
    const states = new Set<string>();
    const findState = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(findState);
      else if (node && typeof node === "object") {
        const record = node as Record<string, unknown>;
        const payload = (record.payload ?? record.artifact) as
          Record<string, unknown> | undefined;
        if (
          (record.artifact_id === bundle.bundle_id ||
            payload?.bundle_id === bundle.bundle_id) &&
          typeof record.lifecycle_state === "string"
        )
          states.add(record.lifecycle_state);
        Object.values(record).forEach(findState);
      }
    };
    findState(body);
    evidence.lifecycleState = states.size ? [...states].join(",") : null;
  }
}

await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, {
  flag: "wx",
});
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
if (values.apply && evidence.exactPayloadVerified !== true)
  process.exitCode = 1;
