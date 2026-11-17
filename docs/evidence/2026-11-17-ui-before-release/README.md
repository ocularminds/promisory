# Before-release UI fixes · 17 November 2026

The P2 and P3 items from `docs/reviews/2026-11-17/ui-ux-review.md`, stacked on the pre-video fixes. Screenshots show **example mode**.

| Finding | Change | Check |
|---|---|---|
| A4 | The decision card follows the selected perspective, with role wording ("Your work affects a promise", "Customer promise · Northstar Retail", "Your team's promise…") | e2e "perspectives change…" |
| A5 | Teamwork Graph deployments appear as **candidate evidence** under the acceptance conditions; the verifier still decides | e2e checks the candidate-evidence text |
| B3 | "Context incomplete" rows give a specific reason ("No supporting work linked", "Evidence needs a refresh", …) | e2e |
| B4 | Jira freshness rows show "Read by Promisory {time}" and a "Source read" chip instead of an alarming "Not verified"; the hard-coded Stockholm time is removed | e2e |
| B5 | When all rows share one time zone, it appears once in the deadline column header | e2e |
| C5/C6 | The inbox groups findings into one card per commitment with one "Mark N read". Notification settings move into a disclosure with hour selects and a time-zone list | e2e · [inbox](inbox-grouped.png) |
| C7 | The work map is an indented native hierarchy with whole-row selection and an "Affects" count, opening on the at-risk blocker. The five identical "Trace impact" buttons are removed | e2e · [work map](work-map-tree.png) |
| C8/C9 | "Cancel or supersede" moves into "More actions" (quiet destructive style); the Connections buttons get a proper gap | e2e (updated closure case) |
| C10 | Pluralized "confirmed path(s)" and "event(s)" | — |
| D1–D3 | The commitment form is grouped into sections (Outcome; Owner, beneficiary and deadline; How delivery is proven; Business context; Links). Required fields are marked; currency is a select; value basis is empty until chosen and required once a value is entered | e2e · [form](commitment-form-sections.png) |
| E1 | Narrow screens use a "Menu · {page}" toggle instead of a clipped tab strip | e2e · [menu](mobile-menu.png) |

The form keeps one page with an error summary, rather than a multi-step wizard. This preserves the existing draft-recovery and 200%-zoom behaviour; the grouping provides the scanability the review asked for.

`npm run check`: 182 tests in 30 files. `PROMISORY_BROWSER_CHANNEL=chrome npx playwright test`: **20 passed** (5 new), with axe WCAG 2.2 AA where applicable.
