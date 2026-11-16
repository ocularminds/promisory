# Release acceptance runbook (Codegeist candidate)

This runbook combines the live steps left open by phases 1–4 into the evidence layout from implementation plan §7. Run it on the dedicated test site, then for the judge profile. Check the folder with `npm run evidence:check -- docs/evidence/<release-id>`. The checker requires all 13 files and scans for credential-shaped text.

| Evidence file | Steps | Source |
|---|---|---|
| `capability-matrix.md` | Connections → Check connections as owner and as restricted user; record Jira, Confluence, Graph and executor states | F01 |
| `versions-and-build-hashes.json` | `forge deploy` output version, `npm run release:profiles` digests, executor image digest | WP01 |
| `installation-walkthrough.md` | Fresh install on a clean site; time to first evidence-linked finding (target < 10 min) | Spec §1 |
| `permission-test-results.md` | Restricted second account: commitments, counts, inbox, export, ledger and MCP omit restricted items | Invariants |
| `hierarchy-and-impact-results.md` | Story/task/bug peers, real subtask, Blocks link create/delete → **What changed** notice; record event-to-notice latency | Phase 2 |
| `lifecycle-requirement-and-gate-results.md` | Edit an unrelated PRD section (mapping stays CONFIRMED), edit the mapped section (drift), gate SUPERSEDED with history kept | Phase 3 |
| `graph-query-evidence.json` | `graph.relations` selections and coverage per curated field (sanitized IDs only) | Phase 2 |
| `rovo-evaluation-results.md` | Cases R01–R12 in `rovo-evaluation-cases.json`, observed versus expected | WP09 |
| `execution-and-reconciliation-results.md` | After the selector switch (Phase 1 runbook): one reviewed change SUCCEEDED with read-back; one HELD (slip outside budget or a non-bound installation); replay returns the same operation; lost-acknowledgement recovery under the new adapter | WP08, G12 |
| `accessibility-results.md` | `PROMISORY_BROWSER_CHANNEL=chrome npm run test:e2e` (11 cases with axe), plus manual keyboard, 200% zoom and screen-reader names on the installed app | §8 |
| `data-egress-review.md` | Remote envelope fields and lineage, MCP projection, export contents; confirm no graph-derived field leaves Atlassian | Invariants |
| `judge-marketplace-equivalence.md` | `release:check` output and the allowed manifest diff (identity, licensing, environment) | Plan §8 |
| `submission-links.md` | Judge install link, Marketplace listing or review ticket, public video, Devpost URL | Plan §12 |

Order on the test site: deploy and admin upgrade (new scopes and MCP) → selector switch → connections check → hierarchy/impact → lifecycle → Rovo cases → governed SUCCEEDED and HELD → recovery → ledger and export → accessibility → egress review. Keep the screenshots from the real app separate from the fixture images in `docs/evidence/2026-11-16-phase-5/`.
