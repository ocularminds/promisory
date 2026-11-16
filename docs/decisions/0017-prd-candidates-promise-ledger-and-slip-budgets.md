# ADR 0017: PRD-sourced candidates, section fingerprints, promise ledger and slip budgets

Status: accepted for implementation. The slip-budget **policy** is a draft. Publishing it requires a rebuilt executor image and a separate owner approval.

## PRD → candidate commitments (gap G9)

`page.sections` reads a permitted Confluence page as the current user. It returns bounded, plain-text heading sections (at most 60 sections of 2,000 characters each; tags stripped), stable anchors (`id="…"` or exact heading markup), a section fingerprint and any confirmed requirement mapped to that section. Page text is labelled untrusted evidence. `commitment.proposeFromSection` re-reads the page, requires the exact revision and a unique anchor, and saves an **unconfirmed draft**. The draft carries the title, an optional outcome candidate and any matching confirmed requirement IDs, plus a `candidateSource` citation (page, revision, anchor, heading, section fingerprint, proposer). It never sets an owner, deadline, beneficiary or acceptance condition. Owner acceptance is still the only activation path. The Rovo actions `promisory-page-sections` (GET) and `promisory-propose-from-page` (CREATE, explicit intent) call these services. MCP does not expose them.

## Section-level requirement fingerprints

New requirement mappings also store `sectionFingerprint` over only their section's normalized text. When the page revision changes, the mapping stays `CONFIRMED` if its anchor is still unique and its section text is unchanged; otherwise it becomes `STALE` as before. Older mappings without the field keep whole-page behaviour. Gate applicability is deliberately unchanged: a gate still records the artifact revision, so any document change still requires readiness reassessment, as spec §6 requires.

## Promise ledger (gap G8)

`metrics.read` returns a **project-level** ledger computed only from commitments the reader may access:
- counts: draft, active, at-risk, open breach, on-time and late fulfilment, cancelled, superseded, renegotiated
- owned-and-available rate
- reliability against the **original** deadline, where a cancellation after the original deadline counts as a miss
- evidence-backed fulfilment
- median notice lead time: days between accepting a later deadline and the original deadline
- stated value exposed by at-risk or missed commitments, per currency

Rates are `null` below five commitments. People are never named or ranked. Value at stake is an optional, owner-accepted agreement field. Absent values are counted as "not stated" and never estimated, so exposure is a lower bound.

## Slip budgets (feature I-3)

Agreements may include `slipBudgetDays` (0–30). `proposal.prepare` computes, on the server, `slip = {delayDays, budgetDays?, withinBudget, exceedsCommitmentDeadline}`. The promise date is compared in the agreement's IANA time zone. The result is hashed into the proposal intent, so review applicability covers it. `withinBudget` requires a budget, an existing Jira date, a delay within budget and a date that does not pass the promise. The remote envelope adds an optional `slip` field with `TRUSTED_CONTEXT` lineage, and the egress allowlist accepts it only with that lineage. The executor computes `delayDays` itself from the bound dates and sends `delayDays` and `withinSlipBudget` as intent parameters. The independent review requirement is unchanged. The budget changes only the institutional decision.

`docs/authority/promisory-dci-policy.slip-budget-v1.draft.json` approves changes inside the envelope and a 14-day institutional cap (`LTE`), escalates other in-scope changes to Decionis approval (`ESCALATE`), and rejects everything else. Until it is published and selected, the active reusable policy simply ignores the extra parameters.
