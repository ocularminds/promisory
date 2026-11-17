# Promisory · UI/UX review

17 November 2026 · `master` at `a03cb33` · example mode in local Chrome at 1440×900 and 390×844. Every page, the commitment detail, both dialogs, the issue panel and the Confluence macro were captured. They were reviewed against `docs/product/02-brand-and-ux-system.md` and the outcome-led positioning in `docs/reviews/2026-11-16/codegeist-competitive-features.md`. The automated axe WCAG 2.2 AA checks already pass (11 browser cases); this review covers what automated checks cannot judge.

**P1** fix before the video, the Devpost gallery or Marketplace screenshots · **P2** fix before release · **P3** polish.

## What already works

- The identity is consistent: semantic tokens, Manrope headings, Inter UI text, azure used only for primary actions. Pages read as one product.
- Status chips always pair an icon with a label. Example data is labelled everywhere (banner, footer, embedded views), and empty states are honest ("No recovery proposals yet", "None stated").
- Headlines are short, sentence-style statements ("Follow the real delivery path.", "Evidence before certainty.").
- The core separations are visible in the UI: native parent versus planning link, health versus fulfillment, readiness versus authority.

## Findings

### A. The outcome story is buried

| # | Pri | Finding | Recommendation |
|---|---|---|---|
| A1 | **P1** | The overview opens with two rows of metrics: four tiles, then the four-column promise ledger. Several overlap (tile "Need attention 1" and ledger "1 at risk"; tile "Outcomes verified 1" and ledger "Kept 1 of 1"). The commitment list starts about 700 px down on desktop and about 1,150 px down on mobile. The spec's first priority, "Review the most consequential change", has no element. | Add a **"Needs a decision"** card at the top. Example: *"Launch merchant onboarding is at risk. MX-137 was reopened 2 h ago and blocks MX-121. Owner: Maya Chen."* with **Compare recovery options**. Merge the tiles into the ledger as one band, and keep What changed directly under the decision card. |
| A2 | **P1** | Empty ledger values are set in headline type ("None stated", "No renegotiations"), so they look like results. | Use muted body text for empty states and keep the large numerals for real values. |
| A3 | P2 | The ledger footnote is a four-sentence block of caveats. | Put the caveats in a "How this is calculated" disclosure next to the heading. Keep one line visible: "Only commitments you can access are counted." |
| A4 | P2 | The Manager, Team, Engineer and Account tabs only filter the list; the layout is the same for everyone. The spec asks for role-specific views. | Change what each view emphasises. Account: customer promises and value at stake first. Engineer: "Your work blocks these promises". Team: unowned and blocked work. |
| A5 | P2 | The Teamwork Graph relations (deployments and goals) are collapsed at the bottom of the detail panel, which hides a differentiator. | Show "1 linked deployment (candidate evidence)" inline in the Acceptance conditions section, next to the condition it supports. |

### B. Clarity and jargon

| # | Pri | Finding | Recommendation |
|---|---|---|---|
| B1 | **P1** | Internal terms appear in primary views: "native level 0 / -1", "Source revision 2026-11-18T08:00:00.000Z", a raw `ari:cloud:jira:…` ID on Evidence, "Applicability: current", "provenance: explicit admin", "Page 203 · document organization". The spec says technical identifiers belong behind "View evidence". | Use plain labels ("Epic", "Subtask of MX-121", "Updated 18 Nov 09:00", "Linked by an admin"). Put raw IDs and revisions in a "View evidence" disclosure. |
| B2 | **P1** | **Tone bug:** `COMPLETE` ("Current coverage") and `CURRENT` (requirement or gate applicability) are not in any tone list in `components.tsx` `Badge`, so they get the grey "unknown" ○ style. That is the same style as "Context incomplete", so good news looks like missing data. | Add `COMPLETE` and `CURRENT` to the success, or a neutral-positive, tone with a ✓ icon. |
| B3 | P2 | Two of four commitments show "Context incomplete" with "Coverage incomplete" repeated under it, and no reason. The spec asks for a source-specific explanation. | Show the reason in one line, for example "Jira link to MX-140 not visible to you" or "PRD not mapped", and drop the duplicate label. |
| B4 | P2 | On Evidence, every Jira item shows a grey "Not verified" chip. It reads as a warning but means "not an acceptance verification". | Rename it to "Source read 09:00". Keep "Verified" language for outcomes only. |
| B5 | P3 | Every commitment row repeats "Europe/Stockholm". | When every row shares one zone, show it once in the column header. |

### C. Interaction bugs and affordances

| # | Pri | Finding | Recommendation |
|---|---|---|---|
| C1 | **P1** | **Mobile:** tapping a commitment adds its detail to the bottom of a long page, about 2,000 px down, so nothing visible changes. The skip link also became visible after the tap, which means focus was not moved to the detail. The spec asks for a full-screen dialog on narrow screens. | Below 768 px, open the detail as a full-screen dialog, move focus to its heading, and return focus to the row when it closes. |
| C2 | **P1** | In the recovery dialog, the three option cards (Repair, Reduce scope, Renegotiate) look selectable but do nothing; the real control is the select below them. The spec says there must be no fake affordances. | Make the cards a radio group and remove the duplicate select. |
| C3 | **P1** | The recovery dialog is the strongest business moment, yet it gives no feedback before you prepare a proposal. | After a date is picked, show a live check: "+4 days · outside the 3-day slip budget · past the 20 Nov promise · needs escalation". This is the "promise radar pre-flight" feature (I-2) and is a strong video beat. |
| C4 | **P1** | In the issue panel and the Confluence macro, **Refresh evidence** stretches to the full row width, and the "Project" label crowds its select. | Use the natural button width, align it right, and give the label a gap. |
| C5 | P2 | In the inbox, the three findings for one commitment appear as three cards with the same title and three "Mark read" buttons. The spec says related notices should be grouped. | Show one card per commitment with the reasons as bullets and one "Mark read". |
| C6 | P2 | In the inbox, the quiet-hours settings sit above the notices, and the time zone is a free-text field with hours entered as 0–23 numbers. | Move the settings into a "Notification settings" disclosure below the notices. Use time inputs and a time-zone combobox. |
| C7 | P2 | The work map is a flat table with five identical "Trace impact" buttons and an empty panel beside it. The spec asks for an expandable tree with labelled edges and a flat path table. | Indent rows by hierarchy (epic, then story/task/bug, then subtask), make the whole row selectable, and show the selected path in the side panel by default, starting with the at-risk bug. |
| C8 | P2 | "Cancel or supersede" has the same visual weight as Propose revision and Transfer owner. | Move it into a "More actions" menu or style it as a subtle destructive action. |
| C9 | P2 | Connections: "Save project scope" and "Export project records (JSON)" touch; there is no gap. | Use the button-row gap (12 px). |
| C10 | P3 | The issue panel says "1 confirmed paths"; the Graph summary pluralization was already fixed. | Pluralize. |

### D. Forms

| # | Pri | Finding | Recommendation |
|---|---|---|---|
| D1 | P2 | The new-commitment dialog is one long column of 14 or more fields, and "Lifecycle phase" is asked first. | Split it into steps: Outcome and beneficiary, then Owner and deadline, then Acceptance evidence, then Optional (value at stake, slip budget, links). Default the phase from context. |
| D2 | P2 | "Value basis" defaults to "Contract penalty" even when no value is entered. Currency is free text. | Leave the basis empty until an amount is entered, and use a currency select (EUR, USD, GBP, …). |
| D3 | P3 | Required fields are not marked. Some validation exists, but the visual cue is missing. | Mark required fields with "(required)" in the label. |

### E. Mobile navigation

| # | Pri | Finding | Recommendation |
|---|---|---|---|
| E1 | P2 | At 390 px, the eight sections become a horizontal tab strip cut off mid-word ("Work ma"), so it is not obvious that more items exist. | Use a "Menu" button that opens a sheet, or a four-item bottom bar (Overview, My work, Reviews, Inbox) with a "More" item. |

## Suggested order

1. **Before recording or capturing screenshots (P1):** A1, A2, B1, B2, C1, C2, C3, C4. Most changes are local to `workspace.tsx`, `components.tsx`, `embedded.tsx` and `styles.css`. C3 reuses `assessSlip` on the client and needs no new backend.
2. **Before release (P2):** inbox grouping, work-map tree, forms, mobile navigation, role-specific emphasis.
3. Re-run `PROMISORY_BROWSER_CHANNEL=chrome npm run test:e2e`, and add cases for C1 focus handling, the C2 radio group and the C3 live slip check.
