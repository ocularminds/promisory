# Remote authorization and Marketplace resubmission

20 November 2026 · deployed security fix; Marketplace review awaiting public privacy declarations

The live Marketplace review and its saved Forge questionnaire were inspected. Question 2.1 selected Connect-on-Forge, question 2.2 selected No, and question 6 selected No egress. The manifests and deployed executor contradict those answers. The rejection explicitly cites the remote user-permission answer; it does not report a latency failure.

[executor-before.json](executor-before.json) is a read-only observation of the running executor bundle. It confirms the user-token header and Jira current-user/permission API paths in the deployed server. Its image was `decionisacr.azurecr.io/promisory/executor@sha256:ea9104cf1e4133638b6cfc1e009083fe235b2845b5cf0de814378626469d3649`. This observation did not read any execution journal or recovery claim.

The deployed change adds current-user identity verification to every action route, requires Browse/Edit/Schedule permissions for due-date changes in both adapters, rejects system-token headers, and removes account/tenant context from connection logs. [Decision 0023](../../decisions/0023-remote-user-permission-verification.md) explains these controls. The [questionnaire correction](../../submission/marketplace-security-resubmission.md) supplies the corresponding answers and the input/URL validation explanation.

## Checks and deployment

- [Local checks](local-checks.json): 229 tests across 31 files passed, along with TypeScript, UI/remote builds, manifest checks, actual Forge bundling and formatting. Synthetic cases cover cross-account/inactive/expired identities, missing/system tokens, denied/missing/malformed permissions, revocation, and a real local AgentSafe grant whose write is refused before dispatch. The full native permission denial matrix was not repeated against live users.
- [Dependency audit](dependency-audit.json): no production findings after the Zod/glob fixes. The complete audit still reports 33 findings in the latest Forge CLI's development dependency tree. The CLI is absent from the executor image. No separate SAST/DAST scanner report or penetration test is claimed.
- [Build source](build-source.json), [ACR build](remote-build.json), and [image checks](image-smoke.json): build `cj4r` produced the pinned image ending `8a6baca1c33783d6a944e83d1793e129a4224f020a8067f1ac0caa5549e6909b`. All 14 isolated checks passed, including non-root/read-only-root operation, patched runtime packages, and refusal of unauthenticated routes and oversized bodies. Synthetic credentials, a separate temporary volume and denied network egress were used; the temporary resources were removed. The earlier `cj4q` build is retained as [superseded evidence](build-superseded.json) and was not deployed.
- [Executor read-back](executor-deployed.json): rollout succeeded with one ready replica, exact server bytes matched, and the deployment changed only the container image. Configuration, policy selector, secret references and state volume references remained unchanged. The public hostname returned HTTPS health successfully.
- [Forge deployments](forge-deployments.json): development 4.4.0, judge production 3.3.0 and Marketplace production 4.3.0 succeeded without expanding scopes. [Installation read-back](installations.json) shows the development and judge test-site installations up to date; there are no Marketplace customer installations.
- [Release equivalence](release-equivalence.json): prepared profiles have equivalent capabilities and identical source bytes. The only change after deployment is the read-only operator connection-log reader; deployed application sources and dependencies remain identical. Both the deployed and prepared source digests are recorded.

## Installed acceptance and limits

The installed development UI loaded live Jira and lifecycle records. Rovo invoked Promisory's context/lifecycle tools and returned a cited answer. The Teamwork Graph path was checked inside Atlassian; its content and derived values are not included in this evidence. Existing successful governed changes and verified outcomes were re-read. No new live governed write or reconciliation was attempted for this security change; the prior successful action is not presented as a fresh write under the new version.

The fresh [connection check](installed-connection.json) produced matching Forge and executor observations for request `07226cab-373a-40a1-84d2-ba68899e46eb`, version 4.4.0. FIT, hosted envelope and current-user OAuth verification passed. The updated operator reader requires both matching records and retains no account/tenant identifiers. This was a read-only check, not an execution grant.

The [installed acceptance record](installed-acceptance.json) distinguishes those checks from synthetic tests. In the installed judge 3.3.0 app, native Jira and Confluence reads succeeded; [governed execution remained unavailable](judge-connection.json) because its hosted configuration lacks an enforcement-capable, authenticated executor binding. No remote connection success or fresh held-action grant is inferred from that configuration hold.

The public hostname still routes to an executor bound to the dedicated development installation. Other installations must remain held. Customer provisioning and operational verification of the 90-day offboarding path remain public-launch prerequisites; unresolved claims must survive until reconciled. Publication remains a manual release decision.

## Marketplace result

The [corrected Forge questionnaire](questionnaire-submission.json) was successfully submitted with all 31 answers. The listing was resubmitted with version 4.3.0/build 4000010 and now links to [ECOHELP-188076](https://ecosystem.atlassian.net/servicedesk/customer/portal/34/ECOHELP-188076). Its status is pending approval; the new ticket is Waiting for Customer and requests completion of the public Privacy & Security tab. Technical answers are prepared; the owner has been asked for the remaining company-role and certification declarations. This evidence does not claim approval or publication.

No old policy, installation binding, or pending recovery claim is part of this change. Previous release profiles were preserved before regeneration.
