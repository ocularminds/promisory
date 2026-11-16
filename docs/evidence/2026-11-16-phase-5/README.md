# Phase 5 local evidence · 16 November 2026

Mode: **fixture browser checks and local tooling**. The images show explicitly labelled example data, not the live tenant.

| Area | Evidence |
|---|---|
| Browser suite | `PROMISORY_BROWSER_CHANNEL=chrome npx playwright test`: **11 passed** in local Google Chrome (the 8 existing cases plus 3 new ones), with axe WCAG 2.2 AA scans on the overview, the new ledger and Graph panel, the closure dialog and the commitment form fields. This also covers the Phase 1–4 UI that earlier PRs left to CI |
| Screenshots | [ledger-and-graph-relations.png](ledger-and-graph-relations.png), [commitment-cancelled.png](commitment-cancelled.png). Visual review found and fixed: misleading "Context incomplete" health and "No active rule" text on closed commitments, a stray punctuation break, and singular/plural in the Graph summary |
| Evidence checker | `scripts/check-release-evidence.ts` (`npm run evidence:check`) with tests. The credential scan of all 17 existing evidence folders found **no** credential-shaped text |
| Live evaluation | `docs/runbooks/rovo-evaluation-cases.json` (12 cases, including injection, identity override, restricted access, fulfilment versus Jira status, graph evidence, individual-ranking refusal and MCP egress) and `docs/runbooks/release-acceptance.md` |
