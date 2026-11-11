# Review required: completed Jira effect with an unbound recovery claim

The 18 → 19 November test changed Jira successfully, but **authority recovery did not pass**. The original grant lacks the effect commitment that Decionis requires to confirm reconciliation. This is an adapter defect in how the grant was requested; repeated browser checks cannot repair that immutable record.

## Exact approved case

| Field            | Value                                                                     |
| ---------------- | ------------------------------------------------------------------------- |
| Organization     | `124e5022-6eee-4717-ab65-a03899db6237`                                    |
| Operation        | `operation-4ba64b81-05bd-4438-86db-280c983f061d`                          |
| Proposal         | `proposal-ab834614-a28b-444b-b76e-be0bd9f929e8`                           |
| Grant            | `88158868-1127-80a6-9dcf-c362a01eb94d`                                    |
| Dossier          | `ce216c34-5e22-4274-800a-54ebcd40bafe`                                    |
| Decision         | `ca997e3a-1cf8-4a3a-86b0-f5c0d04155e7`                                    |
| Jira target      | KAN-2, stable issue `10001`, cloud `e207942a-9edf-4952-b945-2ed6ed3707a7` |
| Approved effect  | 18 → 19 November 2026; one deliberately suppressed acknowledgement        |
| Temporary policy | `436f37a4-311f-4dd5-aa07-5a197ed277ed`                                    |
| Policy expiry    | 12 November 2026, 00:00 UTC                                               |

The user approved this exact recovery test, policy, restart and scoped cleanup. Approval does not permit rewriting the original signed grant, manufacturing an earlier effect commitment, falsely reporting non-execution, sending another Jira edit, or weakening Protocol 1.1's evidence requirements.

## Verified evidence

- Jira returned 204 at 04:53:04 UTC; the one-use test probe deliberately withheld that acknowledgement. The ordinary executor retained an uncertain outcome and a sealed claim. [Initial observation](../evidence/2026-11-11-recovery-test/after-user-reported-review.json).
- The approved restart preserved the operation, grant, private disk and fault marker. [Restart](../evidence/2026-11-11-recovery-test/restart.json).
- Fresh current-user Jira access at 05:46:52 UTC found the exact operation tag, stable field ID and raw 18 → 19 dates. The native outcome is now SUCCEEDED / MATCHED_EFFECT. [History](../evidence/2026-11-11-recovery-test/history-after-fixed-check.json), [journal](../evidence/2026-11-11-recovery-test/after-fixed-result-check.json).
- At 06:07:54 UTC, the authority claim remained INDETERMINATE with zero reconciliations and no effect evidence. The original revalidation and uncertain commit records were both delivered. Its signed dossier is Protocol 1.1 and contains no expected-effect digest. [Exact claim inspection](../evidence/2026-11-11-recovery-test/authority-claim-state.json).
- Pure synthetic checks against the deployed authority validator reject an invented effect commitment with `EFFECT_EXPECTED_BINDING_UNAVAILABLE` and older evidence with `EFFECT_EVIDENCE_VERSION_DOWNGRADE`. They do not mutate authority state or Jira. The [read-only inspection script](read-dci-recovery-claim.mjs) reads neither claim tokens nor source content.

## Containment and next action

Keep the original claim, operation, private fault marker and native evidence. Do not run the prepared policy-retirement script or remove unresolved claim state. The test policy and probe do not authorize another date change. The original 12 → 18 policy remains separate and unchanged.

The prevention fix binds the expected effect before a new grant is issued, supplies required native observation evidence, and preserves recorded uncertain receipts through retries. Its tests do not retroactively complete this live run. [ADR 0014](../decisions/0014-effect-commitment-and-durable-reconciliation.md).

The Decionis authority owner must review a supported disposition for this exact completed request without an original effect commitment. The currently deployed reconciliation API cannot positively settle it, and the non-execution route is inapplicable because Jira's effect is verified. Any new authority capability or shared production change must be reviewed and authorized separately. No such change has been made.

A new complete lost-response acceptance test must use the corrected grant path and a separate exact policy/checker approval, with an isolated test target if the existing claim continues to hold this target's authority scope. Prepare that concrete target and policy before requesting approval. The product's lost-response and release-acceptance gates remain open.
