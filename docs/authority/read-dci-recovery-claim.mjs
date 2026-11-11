/** Read-only diagnostic of the single approved recovery claim. Run in the API runtime. */
import pg from "pg";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateFinalizationEffectEvidence } from "@decionis/shared";

const scope = {
  organizationId: "124e5022-6eee-4717-ab65-a03899db6237",
  grantId: "88158868-1127-80a6-9dcf-c362a01eb94d",
  dossierId: "ce216c34-5e22-4274-800a-54ebcd40bafe",
  decisionId: "ca997e3a-1cf8-4a3a-86b0-f5c0d04155e7",
};
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 3000,
});
let client;
try {
  const runtimeSha256 = createHash("sha256")
    .update(readFileSync("/app/dist/index.js"))
    .digest("hex");
  if (
    runtimeSha256 !==
    "53658b28976c38e0cea2fd645c214ca5cfbb9a14680fcb64417bf48a0d45f4b4"
  )
    throw new Error("RUNTIME_CHANGED");
  client = await pool.connect();
  await client.query("begin read only");
  await client.query("set local statement_timeout = '3s'");
  const selected = await client.query(
    `select c.status, c.claimed_at, c.eligibility_validated_at, c.lease_expires_at,
            c.indeterminate_at, c.finalized_at,
            c.effect_evidence is not null as effect_evidence_present,
            d.dossier_payload #>> '{portable_artifact,machine_readable,protocol_version}' as protocol_version,
            d.dossier_payload #>> '{execution_binding,expected_effect_digest}' as expected_effect_digest,
            d.dossier_payload #>> '{execution_binding,payload,digest}' as request_digest,
            (select count(*)::int from execution_indeterminate_reconciliations r
              where r.org_id = c.org_id and r.nonce = c.nonce) as reconciliation_count
       from execution_nonce_claims c
       join decionis_protocol.decision_dossiers d on d.dossier_id = c.dossier_id and d.org_id = c.org_id
      where c.org_id = $1::uuid and c.jti = $2::uuid
        and c.dossier_id = $3::uuid and c.evaluation_id = $4::uuid`,
    [scope.organizationId, scope.grantId, scope.dossierId, scope.decisionId],
  );
  const row = selected.rows[0];
  if (
    selected.rowCount !== 1 ||
    !["CLAIMED", "INDETERMINATE", "FINALIZED", "FAILED"].includes(row.status) ||
    row.protocol_version !== "1.1" ||
    row.expected_effect_digest !== null ||
    row.request_digest !==
      "sha256:48c5880a1e075f650b110c15b258010d6de58db21b08e3c1cc392fa61b85cc5f"
  )
    throw new Error("EXACT_CLAIM_MISMATCH");
  const queued = await client.query(
    `select evidence_kind, status, count(*)::int as count
       from execution_authority_evidence_outbox
      where org_id = $1::uuid and evidence ->> 'dossier_id' = $2
        and evidence ->> 'evaluation_id' = $3
      group by evidence_kind, status limit 10`,
    [scope.organizationId, scope.dossierId, scope.decisionId],
  );
  if (
    queued.rows.some(
      (value) =>
        !["REVALIDATION", "COMMIT", "BREACH"].includes(value.evidence_kind) ||
        !["PENDING", "DELIVERED"].includes(value.status) ||
        !Number.isInteger(value.count) ||
        value.count > 100,
    )
  )
    throw new Error("EVIDENCE_PROJECTION_REFUSED");
  await client.query("rollback");

  // Synthetic, pure validation with the actual deployed contract. No grant,
  // receipt, policy, dossier, database row, or native work item is changed.
  const digest = `sha256:${"a".repeat(64)}`;
  const common = {
    commit_outcome: "COMMITTED",
    commit_correlation_id: "synthetic",
    expected_request_digest: digest,
    expected_effect_digest: null,
    trusted_observer_ids: ["synthetic-observer"],
    authority_protocol_version: "1.1",
  };
  const missingBindingResult = validateFinalizationEffectEvidence({
    ...common,
    effect_evidence: {
      version: "1.0",
      status: "CONFIRMED",
      observation_method: "STATE_RECONCILIATION",
      observer: { id: "synthetic-observer", version: "synthetic" },
      expected_effect_digest: digest,
      observed_effect_digest: digest,
      observed_at: new Date().toISOString(),
      evidence_digest: digest,
      evidence_reference: null,
      execution_correlation_id: "synthetic",
    },
  });
  const downgradeResult = validateFinalizationEffectEvidence({
    ...common,
    effect_evidence: {
      effect_schema_version: "1.0",
      status: "CONFIRMED",
      request_digest: digest,
      response_digest: digest,
      digest_algorithm: "SHA-256",
      canonicalization_profile: "RFC8785/JCS",
      external_reference: "synthetic",
      observation_mode: "RUNTIME_REPORTED",
      observer: { id: "synthetic-observer", version: "synthetic" },
      observed_at: new Date().toISOString(),
      metadata_digest: null,
    },
  });
  if (
    missingBindingResult !== "EFFECT_EXPECTED_BINDING_UNAVAILABLE" ||
    downgradeResult !== "EFFECT_EVIDENCE_VERSION_DOWNGRADE"
  )
    throw new Error("CONTRACT_CHANGED");
  console.log(
    JSON.stringify({
      schemaVersion: "promisory.recovery-authority-claim-observation.v1",
      recordedAt: new Date().toISOString(),
      readOnly: true,
      ...scope,
      runtimeSha256,
      claim: row,
      evidenceDelivery: queued.rows,
      syntheticRuntimeValidation: { missingBindingResult, downgradeResult },
      runtimeCredentialUsedInPlace: true,
      claimTokenRead: false,
      credentialOrClaimTokenExported: false,
      sourceContentRetained: false,
      nativeWritePerformed: false,
      authorityMutationPerformed: false,
    }),
  );
} catch (error) {
  await client?.query("rollback").catch(() => {});
  const permitted = new Set([
    "RUNTIME_CHANGED",
    "EXACT_CLAIM_MISMATCH",
    "EVIDENCE_PROJECTION_REFUSED",
    "CONTRACT_CHANGED",
  ]);
  console.error(
    JSON.stringify({
      error: permitted.has(error.message)
        ? error.message
        : "SCOPED_CLAIM_READ_FAILED",
    }),
  );
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
