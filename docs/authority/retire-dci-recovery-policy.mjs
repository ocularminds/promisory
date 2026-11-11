/**
 * Retire only the temporary recovery policy after the approved test is settled.
 * Run inside the existing Decionis API runtime; credentials never leave it.
 * Uses the ACTIVE -> HISTORICAL transition documented by Decionis's
 * PolicyRevisionArchiveRepo and enforced by migration 0171. No artifact bytes
 * are rewritten, and no other policy or organization is selected.
 */
import pg from "pg";
import { createHash } from "node:crypto";

const scope = {
  orgId: "124e5022-6eee-4717-ab65-a03899db6237",
  revisionId: "436f37a4-311f-4dd5-aa07-5a197ed277ed",
  policyId: "promisory-test-jira-recovery",
  version: "promisory-recovery-test-v1",
  payloadSha256:
    "13bffd5abbb3ceae56be8f3b5013a5559d5e07646d14ef9fa77f60ee375e1ad3",
};
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 3000,
});
let client;
try {
  client = await pool.connect();
  await client.query("begin");
  const result = await client.query(
    `select a.payload, l.lifecycle_state
       from decionis_protocol.artifacts a
       join decionis_protocol.policy_revision_lifecycle l
         on l.policy_revision_id = a.artifact_id
      where a.artifact_type = 'policy_bundle'
        and a.org_id = $1::uuid and a.artifact_id = $2::uuid
        and l.org_id = $1::uuid
      for update of l`,
    [scope.orgId, scope.revisionId],
  );
  const row = result.rows[0];
  if (
    result.rowCount !== 1 ||
    row.payload.policy_id !== scope.policyId ||
    row.payload.version !== scope.version ||
    createHash("sha256")
      .update(JSON.stringify(canonical(row.payload)))
      .digest("hex") !== scope.payloadSha256
  )
    throw new Error("EXACT_REVISION_MISMATCH");

  const apply = process.argv.includes("--apply");
  let changed = false;
  if (apply && row.lifecycle_state === "ACTIVE") {
    const update = await client.query(
      `update decionis_protocol.policy_revision_lifecycle
          set lifecycle_state = 'HISTORICAL', changed_by = $3, change_reason = $4
        where org_id = $1::uuid and policy_revision_id = $2::uuid
          and lifecycle_state = 'ACTIVE'
        returning lifecycle_state`,
      [
        scope.orgId,
        scope.revisionId,
        "codex:promisory-policy-authoring",
        "Cleanup of the exact Promisory recovery test approved in call_6hHzX1BGUJM5Xol2KwWDPAJY:0. Retire only this temporary revision after all test operations are settled; preserve the policy artifact and execution evidence.",
      ],
    );
    if (update.rowCount !== 1) throw new Error("REVISION_STATE_CONFLICT");
    changed = true;
  } else if (!["ACTIVE", "HISTORICAL"].includes(row.lifecycle_state)) {
    throw new Error("UNEXPECTED_REVISION_STATE");
  }
  await client.query(apply ? "commit" : "rollback");
  console.log(
    JSON.stringify({
      mode: apply
        ? "SCOPED_TEST_POLICY_RETIREMENT"
        : "READ_ONLY_RETIREMENT_PREFLIGHT",
      observedAt: new Date().toISOString(),
      ...scope,
      previousState: row.lifecycle_state,
      lifecycleState: changed ? "HISTORICAL" : row.lifecycle_state,
      changed,
      policyBytesPreserved: true,
      otherPoliciesChanged: false,
    }),
  );
} catch (error) {
  if (client) await client.query("rollback").catch(() => {});
  const permitted = new Set([
    "EXACT_REVISION_MISMATCH",
    "REVISION_STATE_CONFLICT",
    "UNEXPECTED_REVISION_STATE",
  ]);
  console.error(
    JSON.stringify({
      error: permitted.has(error.message) ? error.message : "RETIREMENT_FAILED",
      databaseCode: typeof error.code === "string" ? error.code : null,
    }),
  );
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
