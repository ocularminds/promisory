# Phase 3 local evidence · 16 November 2026

Mode: **local contract and fixture tests only**.

| Area | Evidence |
|---|---|
| PRD sections and candidates | `tests/domain/sections.test.ts`: bounded plain-text sections, stripped markup, unique and ambiguous anchors, section-only drift (an unrelated edit keeps the mapping CONFIRMED; editing the mapped section makes it STALE), unconfirmed candidate with citation and matched requirement, refusal of stale revisions, ambiguous anchors and restricted pages |
| Promise ledger | `tests/domain/metrics.test.ts`: counts, small-sample suppression, no names, original-deadline reliability, a late cancellation counted as missed, notice lead time, per-currency exposure, restricted commitments neither shown nor counted |
| Slip budgets | `tests/domain/slip.test.ts`: envelope rules, time-zone-correct promise date, slip hashed into the intent with review still applicable. `tests/contracts/authority.test.ts`: executor-computed `delayDays`, `withinSlipBudget` signal, dispatch inside the envelope and HELD outside it under a simulated slip policy, `TRUSTED_CONTEXT`-only lineage |
| Suite | `npm run check`: **172 tests in 28 files**, builds, manifest, Forge bundle, release equivalence. `forge lint`: no errors; one expected `MAJOR_VERSION_RULE` approval |

## Live acceptance still required
1. Deploy, then ask Rovo "Turn this PRD into candidate commitments" on the test PRD. Record the cited candidates and that no owner or deadline was guessed.
2. Edit an unrelated PRD section and confirm the requirement stays CONFIRMED. Edit the mapped section and confirm drift.
3. Rebuild the executor image, publish the slip-budget policy after owner approval, switch the selector, and record one change inside the budget (SUCCEEDED) and one outside it (HELD, escalated).
