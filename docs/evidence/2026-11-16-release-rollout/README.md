# Release rollout and submission evidence

Updated 17 November 2026. This folder records the authorized reusable-policy rollout, registered release identities, live acceptance checks and submission state. Historical failures are retained alongside later results.

## Current release

- Phase 1–5 branches, and the phase 6 successor, were merged into `master`; the merge baseline is `a03cb33`.
- The executor uses reusable policy `33c97bbd-7ab7-424a-b7d6-a069277d1101`, valid through 31 January 2027. The original 22-case policy evidence and two rejected publish attempts remain in `../2026-11-16-reusable-authority/`.
- The enhanced UI was subsequently synced from remote `master` at **092c2f7**, followed by the Rovo citation correction at **3deabe1**. Development is now **4.3.0**, judge production **3.2.0**, and Marketplace production **4.2.0**. All three profiles share the code capability contract, including the four Graph scopes, read-only MCP tools and daily privacy reporting job. The original capability deployment records are retained; see [the new checks and live captures](../2026-11-17-live-retake/README.md) for the current builds and 187 passing unit/contract tests.
- Development and judge installations were verified on Jira and Confluence. The judge app's own installation correctly has no executor binding. See `judge-installation.json`.
- Marketplace declares **https://promise.decionis.com**. DNS, TLS and health were verified; the backend remains the existing executor bound to the test installation. Customer provisioning is pending. See `production-origin.json`.

## Verified live behavior

| Check | Evidence | Result |
|---|---|---|
| KAN-6 reviewed date change | `successful-kan6-apply.json` | Grant claimed, expected effect matched, Jira write acknowledged and read back, finalization recorded |
| KAN-2 request with unresolved earlier claim | `third-live-apply.json` | Claim refused before dispatch; no additional write |
| Designated outcome verification | `outcome-verification.json` | Acceptance recorded separately from Jira state and execution completion |
| Reopened test bug | `reopened-bug-notice.json` | Affected-commitment notice created in 12.602 seconds; owner inbox checked later |
| Rovo PRD candidates | `rovo-r03-read.txt`, `rovo-r03-complete.txt` | Five section/revision-cited candidates; one draft created only after explicit confirmation |
| External read-only MCP | `external-mcp-verification.json` | Three tools discovered; commitments read returned five permitted records with Jira/Confluence references and `MCP_GRAPH_EXCLUDED` |
| Local validation | `profile-capability-tests.json`, bundle/check files | 186 tests plus type, manifest, bundle and release-profile checks passed |
| Fixture browser validation | `browser-fixtures/README.md` | 11 browser checks; fixtures remain clearly distinct from live integration evidence |

The external MCP client used only the user-approved Read and Search permissions. Tokens remained in memory; the client and local callback server exited after the check. The earlier OAuth `invalid_request` incident is recorded without credentials.

## Submission state

Marketplace app **261938314**, “Promisory for Jira”, was submitted as version **4.0.0** under Decionis Inc. Atlassian displays **pending approval** and the review ticket [ECOHELP-186301](https://ecosystem.atlassian.net/browse/ECOHELP-186301). The version table labels the submitted build `PUBLIC`; that label does not establish app approval or public availability. Release behavior was explicitly set to manual publication. See `marketplace-submitted.png` and `submission-links.md`.

The saved price schedule is $10/month for 1–10 users, $4.90/user for 11–100, $3.20 for 101–250, $2.00 for 251–1,000 and $1.10 above 1,000, with Marketplace's annual pricing at ten times monthly. See `marketplace-pricing-revised.png` and `../../submission/marketplace-pricing-and-editions.md`. The older pricing screenshot records the superseded schedule.

The enhanced UI retake is complete: nine installed-app screenshots and the 139-second [live screen recording](https://www.youtube.com/watch?v=4-14LxhZySo) are recorded in [the current media evidence](../2026-11-17-live-retake/README.md). [Devpost](https://devpost.com/software/promisory) was submitted with seven of those screenshots and the live video after the user approved the terms and confirmed the eligibility declarations. The new media was [posted to the existing Marketplace review](../2026-11-17-live-retake/marketplace-media-transfer.json); the listing remains locked, so the replacement listing images have not yet been applied. Earlier captures and the historical pause in `video-pause.json` are retained as dated evidence.

The Marketplace review ticket is **Waiting for customer** and requests partner verification (ECOHELP-186302), the Privacy & Security tab, and its Marketplace security questionnaire before functional review. These are not completed by the listing submission or new Forge deployment.

## Explicitly incomplete

- The original unresolved KAN-2 recovery claim remains untouched. A normal successful KAN-6 action is not a recovery acceptance test for that older claim.
- The separate slip-budget policy remains a draft; its enforcement is not advertised as a completed live check.
- The support judge account was invited with project/space guest access; recipient activation and a judge sign-in remain pending.
- Curated Graph relation-query acceptance and live scheduled privacy/deletion behavior are not established by the MCP or connection checks in this folder.
- The owner selected a 90-day external journal deletion period after uninstall, retaining unresolved claims until reconciled. Automated uninstall detection/purge is not implemented. See `../../runbooks/executor-offboarding.md`.
- Marketplace approval, its required review forms and customer executor provisioning remain launch work.

No expired authority policy was edited. No old claim was deleted, retried or silently treated as reconciled.

## Publication preparation

The JSON observations contain bounded diagnostic fields and references, with credentials and sealed claim material excluded. Browser fixture captures are synthetic UI checks, and live captures show the dedicated test tenant. Before committing this folder, the connection screenshot's browser chrome and account identity were removed, the Marketplace version table's operator names were masked, and JPEG-encoded captures with `.png` filenames were losslessly re-encoded from their decoded pixels as PNG. The [preparation manifest](publication-preparation.json) records these edits and the image hashes. Status text, authority verdicts and product data were not rewritten.
