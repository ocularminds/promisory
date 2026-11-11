# Installed acceptance procedure

Status: **in progress** on `decionis-promisory.atlassian.net`, development version 3.4.0. Earlier installation, current-user source reads, native hierarchy, accepted owner transfer, independent gate/action review, a held governed action, PRD drift/remapping, designated outcome acceptance/revocation, late fulfillment after deadline revision, source-ACL denial through UI/Rovo and second-account access restoration are recorded in [live evidence](../evidence/2026-11-10-live-test-site/README.md). The [current executor and hosted invocation binding](../evidence/2026-11-11-hosted-invocation/README.md) are deployed; the authenticated connection is verified and the test enforcement hold is released; the [governed KAN-2 write](../evidence/2026-11-11-governed-write/README.md) is now verified through grant/claim, acknowledged write, native read-back and recorded finalization. Unrecorded cases below remain unaccepted. Run only on the owner's selected test site and explicitly designated test work. Keep fixture, SDK-loopback and live results in separate files. Record actual app/version/environment, timestamp, user role, source revision, expected behavior, observed behavior and a sanitized evidence reference for each case.

## Prepare the pilot

Use one existing pilot project, a second project for exclusion tests, two users with distinct Jira/page permissions, selected Confluence lifecycle pages, an existing PRD with a unique stable section and an existing release version. Map a goal and initiative explicitly if Jira has no configured higher levels. If higher levels exist, import their actual metadata. Never create hierarchy or document trees just to satisfy this procedure.

1. Install the fresh app and verify SQL migration, scope consent, Connections and current-user reads. Confirm no source data is created or changed by onboarding. Disable/re-enable the app scope and test disconnected sources.
2. Import the actual epic, story, task, bug and subtask, plus above-epic levels when available. Verify native parents, a separately typed bug→task Blocks edge and stable identity after an issue-key rename. Move/delete a test issue and confirm missing/changed sources stay explicit.
3. Map existing pages for the ten phases and a stable PRD requirement. Confirm a complete agreement through the nominated owner. A second user cannot accept ownership on their behalf. Request and accept an owner transfer; retain both agreement versions and the original date.
4. Restrict a previously visible issue/page. The restricted user must lose its cards, titles, counts, paths, historic agreement bodies, notifications, direct lookups and Rovo evidence. Confirm a stakeholder label or admin UI cannot bypass a source ACL. Test another cloud with the same numeric issue ID.

## Rovo and Teamwork Graph

Capture the real curated query, scope names, bounded pagination and sanitized returned entity references. Check empty, partial, missing-scope and denied results. Verify no graph data or derivative appears in remote serialization or remote logs. Assigned graph context outside the selected visible project must be omitted.

Ask the installed agent to explain the bug's commitment impact and cite the returned source references. Ask it to extract a candidate from the selected issue; missing owner/date/conditions must remain unresolved. Ask for a recovery proposal; it must remain an internal Atlassian-only proposal. Test hostile source text, invented account/organization/URL fields and a request to approve itself. No approval, execution or weaker policy tool should be available. Compare the same selection through the UI and Rovo for rule/revision/permission consistency. Record correctness and abstention counts without inventing a model-accuracy claim from unit tests.

## Governed Jira action

The exact DCI v3 test policy is checker-approved, published, read back and pinned to revision `457e04a4-0a1d-4f18-8bca-7a9a5df2adc8`. It permits only the approved primary test account, existing installation and KAN-2 change from 12 to 18 November 2026, and expires 12 November at 00:00 UTC. The separate DCI gateway remains SHADOW/PASSTHROUGH; Promisory's approved narrow executor runs in ENFORCEMENT with verification true after the installed identity/OAuth check. HTTPS, the shared observer, image/runtime and synthetic authority denials are verified. Existing policy, deployment, cost and test-enforcement authorizations remain valid; do not request them again for the same scope. See [the current setup](../authority/README.md).

Run **Connections → Check connections** in the installed app as the primary account. Verify the fresh, strict connection record and its expected app version, module, installation, cloud and current-user OAuth identity before releasing the hold. A badge, configured label, local synthetic case or uncorroborated report is insufficient. The record does not approve or execute an action. When browser automation is unavailable, the user can run this read-only check in external Chrome while the operator inspects its sanitized evidence.

Use an explicitly approved test due-date change. Keep the original customer promise unchanged. Instrument the test Jira destination and authority so each case can count actual dispatches and correlate the operation, grant and receipt without saving tokens.

| Case                                                                           | Required observation                                                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Unconfigured or shadow boundary                                                | Held/assessment-only; no write                                                                 |
| Rejected review, self-review or missing role                                   | No dispatch; no policy bypass                                                                  |
| BLOCK / escalation from authority                                              | No Jira PUT; correct decision state                                                            |
| Action-gate Boolean or dossier without grant                                   | No claim or dispatch                                                                           |
| Wrong installation/principal/cloud, modified envelope or arbitrary destination | Rejected before downstream access                                                              |
| Expired proposal/grant/lease or changed reviewed Jira/PRD/gate version         | No write; claim finalized as failed if claimed                                                 |
| Correct independent review and ALLOW grant                                     | One claim, one narrow due-date PUT, current-user read-back, final receipt acknowledgement      |
| Duplicate apply or concurrent apply                                            | One local operation and at most one dispatch for that operation                                |
| Lost response after PUT                                                        | Explicit reconciling state; no retry; verify operation-tagged changelog before resolution      |
| Remote restart after claim/dispatch                                            | Encrypted claim restoration and read-only reconciliation; no extra PUT                         |
| Lost receipt acknowledgement or replay rejection                               | Finalization stays pending until positive provider evidence; success is not inferred from 409  |
| Native edit races the write                                                    | Conflict/read-back handled explicitly; record the endpoint's residual lack of global atomicity |

Verify current Decionis trusted-effect-observer registration before reconciling an indeterminate grant. A matching due-date value alone is not proof that this operation made the change. Never use a broader app token if the original user's token expires.

## Readiness, fulfillment and operating behavior

Accept a gate against exact PRD/work/release versions, then change the PRD and show superseded applicability with the old review preserved. Reconfirm the mapping and create the next gate version. A ready or accepted gate must not grant execution authority.

Complete a Jira item while leaving a different agreed human condition unaccepted; the outcome must remain pending. Have the designated verifier accept evidence, then revoke it and show the regression. Verify late fulfillment against the original deadline after a revision. Distinguish release evidence from actual adoption.

Verify inbox deduplication, scoped read marks, quiet hours in the user's timezone and changed permissions. The implemented digest is in-app; no email/push delivery is claimed. Measure import latency, requests per refresh, event-to-visible-change delay, graph/query duration and remote failures at the actual pilot scale. Report sample size and p50/p95 before making performance claims.

## Release acceptance

Run desktop, 390 px, actual browser 200% zoom, keyboard and screen-reader journeys inside Atlassian chrome. Local automated checks emulate 200% reflow; native browser zoom and screen-reader testing remain part of this installed procedure.

Verify new installation, upgrade, disconnected Confluence, license expiry and reinstall isolation. Implement/verify export and deletion/retention jobs before claiming those enterprise lifecycle guarantees; they are absent from this candidate. Verify uninstall handling on Forge and separately on the remote volume/provider. Do not delete the customer's Jira/Confluence content.

Generate equivalent judge/Marketplace profiles from the frozen source. Install the judge profile on a fresh tenant and verify its actual sharing URL. Record Marketplace listing/review-ticket status, required vendor/privacy/support URLs and authorized submission/video links. No phase is closed by this checklist alone; attach observed live results.
