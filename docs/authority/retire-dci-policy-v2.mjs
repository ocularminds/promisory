/**
 * One-revision rollback of this task's over-permissive test policy.
 * Run inside the existing Decionis API runtime; credentials never leave it.
 * Uses the ACTIVE -> HISTORICAL transition documented by Decionis's
 * PolicyRevisionArchiveRepo and enforced by migration 0171. No artifact bytes
 * are rewritten, and no other policy or organization is selected.
 */
import pg from "pg";
import { createHash } from "node:crypto";

const scope = {
  orgId: "124e5022-6eee-4717-ab65-a03899db6237",
  revisionId: "98d2c263-3673-405b-aa6c-67325e41ee78",
  policyId: "promisory-test-jira-due-date",
  version: "promisory-test-v2",
  payloadSha256:
    "e25cd87ebe46dcc7028f1d8545c0004fbf1939e564f04662c306cd792aa48398",
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
        "Rollback of this task's test policy: EQ numeric-prefix coercion allowed an unapproved date; shadow dossier b4dc5a1d-d544-4330-a468-4a8d53897419. No grant or Jira write occurred.",
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
