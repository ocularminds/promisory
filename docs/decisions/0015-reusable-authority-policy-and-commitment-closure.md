# ADR 0015: Reusable due-date authority policy and explicit commitment closure

Status: accepted. The policy is published and its live SHADOW cases pass. The test executor selector switch is prepared but is an operator step.

## Context

Both approved DCI revisions expired on 12 November 2026 at 00:00 UTC, and each matched exactly one date change on KAN-2 (`457e04a4…`: 12 → 18 Nov; `436f37a4…`: 18 → 19 Nov). Every governed apply was therefore correctly HELD or BLOCKED. The successful governed path required by the release definition (spec §13) could not be demonstrated to judges, and each new date needed a hand-authored policy. On 16 November the owner approved "a new reusable authority policy provisioning".

Separately, the commitment contract had `CANCELLED` and `SUPERSEDED` lifecycle values, but no command set them. Spec §1 requires cancelled and superseded commitments to be reported separately from fulfilled and late ones.

## Decision

### Reusable policy

Publish `promisory-test-reusable-due-date` / `promisory-reusable-v1` (bundle `33c97bbd-7ab7-424a-b7d6-a069277d1101`). It is effective from 16 Nov 2026 20:10 UTC to **31 Jan 2027 23:59:59 UTC**, which covers judging.

It admits `jira.issue.set_due_date` only when **all** of the following hold:
- the target is a numeric issue on test cloud `e207942a…`
- the issue has an existing date, and the requested date is a well-formed date in 2026–2027
- the actor is an Atlassian account ID (`NNNNNN:uuid` or legacy 24-hex) of type `atlassian_user`, using runtime `promisory-forge`
- the downstream system and operation are `jira` / `set_due_date`
- the environment and installation are the exact bound development ARIs

Everything else is rejected. Missing source version, operation ID or proposal hash escalates through `required_signals`. All comparisons use anchored `MATCHES`, because Decionis `EQ` coerces numeric prefixes (see ADR 0010).

The policy deliberately does **not** encode commitment ownership or review. Promisory still enforces current source access, owner or administrator authority, an exact independent review, proposal expiry, user-authored effect origin and native edit permission before preparing the intent. AgentSafe still requires a supported bound grant and claim. The effect digest from ADR 0014 is bound before dispatch. Bounding the size of a slip is deferred to the slip-budget policy (Phase 3), which adds a trusted numeric `delayDays` signal compared with `LTE`.

The expired revisions are not retired. `436f37a4…` and its INDETERMINATE claim stay retained for authority operator review. Reconciliation does not read the policy selector, so switching the selector does not affect that record.

### Commitment closure

Add `commitment.cancel` and `commitment.supersede`. Only the accountable owner or a scoped administrator may run them, and only on an accepted (non-draft) commitment that has no pending owner transfer and no governed operation in `PREPARED`, `EVALUATED`, `AUTHORIZED`, `EXECUTING` or `RECONCILING`. A successor must be a different, open, accepted commitment that shares a project.

Closure is a record-level `closure` object (kind, reason, actor, time, closed version, optional successor), not a new agreement version. Agreement versions, original deadlines, earlier breaches, reviews, operations and outcomes are kept. The history entry notes when the original deadline had already passed. Closed commitments get no delivery-health assessment. Every mutating command except `action.reconcile` refuses them, so an in-flight result can still be checked. `commitmentLifecycle()` derives `DRAFT | ACTIVE | FULFILLED | CANCELLED | SUPERSEDED` and keeps it separate from health.

## Consequences

- Any reviewed due-date change on the test site can complete through the governed path until 31 Jan 2027, after the executor selects the new revision.
- The policy is broader than the previous single-effect revisions. The narrowing now rests on Promisory's review and ownership checks plus the grant/claim boundary, and the release dossier must say so.
- Live evidence: [publication](../evidence/2026-11-16-reusable-authority/policy-publication.json), [22 SHADOW cases](../evidence/2026-11-16-reusable-authority/policy-shadow-cases.json), and two retained rejected attempts (unrecorded validation issue, then a `change_ticket` over 200 characters).
