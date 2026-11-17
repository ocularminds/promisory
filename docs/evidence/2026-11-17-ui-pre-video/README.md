# Pre-video UI fixes · 17 November 2026

The P1 items from `docs/reviews/2026-11-17/ui-ux-review.md`. The screenshots show **example mode** (fictional data) in local Chrome.

| Finding | Change | Check |
|---|---|---|
| A1 | The overview opens with a **Needs a decision** card: the most consequential open commitment (missed before at risk, then stated value, then soonest deadline), the blocking work, owner and due date, with **Compare recovery options** and **Open commitment**. The four tiles are merged into the promise ledger as one band | e2e "overview leads with the decision…" · [overview](overview-decision-and-ledger.png) |
| A2 | Empty ledger values use muted body text ("No value stated", "No renegotiations"); the caveats move into "How this is calculated" | e2e ledger case |
| B1 | Plain labels replace internal terms: no "native level", "Jira parent" / "Top level", Jira update times instead of raw revisions, Graph IDs behind "View evidence", readable gate applicability and binding provenance | e2e "coverage … good news" (no "native level") |
| B2 | `COMPLETE` ("Coverage complete") and `CURRENT` use the success tone | e2e checks the badge class |
| C1 | Below 768 px the commitment detail opens full-screen; focus moves to its heading; Escape and × return focus to the row | e2e narrow-screen case · [mobile](mobile-detail-fullscreen.png) |
| C2 | Recovery options are a real radio group (the duplicate select is removed) | e2e checks the radio state |
| C3 | Live slip preview before preparing: delay, slip budget, promise date, and an explicit "preview only" note, computed with the same `assessSlip` as the server | e2e asserts the preview text · [dialog](recovery-slip-preview.png) |
| C4 | The issue panel and macro toolbar use a compact, right-aligned **Refresh evidence** with a label gap | e2e width check · [issue panel](issue-panel-toolbar.png) |

`npm run check`: 182 tests in 30 files. `PROMISORY_BROWSER_CHANNEL=chrome npx playwright test`: **15 passed** (11 existing, 1 updated, 4 new), each with axe WCAG 2.2 AA where applicable.
