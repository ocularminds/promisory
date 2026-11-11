# ADR 0011 · Verify the current-user execution connection without a write

11 November 2026.

The deployed connection card previously reported configuration only. Browser automation is unavailable in this session, and exercising the action route is an unsuitable prerequisite for verifying the authenticated remote connection. Add an explicit **Check connections** control to the existing Connections page and route it through the existing `connections.check` service command.

The Forge resolver supplies trusted context, a fresh request ID and a short expiry under its existing HMAC signature. The new `/v1/connection/check` route accepts only the strict versioned `promisory.remote-connection.v1` contract. It accepts no issue, action, arbitrary URL, policy, user override, source content or Graph derivative. The route verifies the same signed FIT, installation, environment, cloud, module and API destination as the action routes. FIT `app.appVersion` is validated and included in the result so installed version evidence is explicit.

Using the opaque current-invocation user token, the remote calls only Jira's `GET /rest/api/3/myself`. The active account must exactly match the FIT principal. Other profile fields are discarded. Missing OAuth, mismatched identity, stale correlation metadata, unknown request fields and redirects fail closed. No authority decision, grant, claim, execution journal write or Jira mutation is part of this check.

Forge accepts only a runtime-validated result matching the request ID, trusted context and current time. The result reports connection verification separately from the configured execution hold. Successful verification never changes deployment flags or approves an action. The normal independent review, source freshness, policy, grant, claim and finalization requirements remain in force. Connections displays a fresh result until the workspace next refreshes.

The successful diagnostic log contains only the strict verification result: trusted identifiers, installed version/module, correlation/time, current-user verification and mode/hold flags. No FIT, OAuth token, HMAC, user profile content, Graph data or grant is logged. The temporary test dependencies are supplied only by source-level tests; the production server retains the fixed Atlassian key source and configured destination binding.

Official contracts rechecked on 11 November 2026: [function-to-remote calls](https://developer.atlassian.com/platform/forge/runtime-reference/invoke-remote-api/), [FIT and current-user headers](https://developer.atlassian.com/platform/forge/remote/essentials/), and [Jira current user](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-myself/#api-rest-api-3-myself-get). The existing manifest already declares `read:jira-user`, current-user-token support and the approved remote origin; no new scope or destination is required.

All 97 local tests passed, including 21 new cases covering the read-only boundary and correlation/identity failures. Builds, actual Forge packaging and offline release equivalence passed. These use synthetic FITs and Jira responses; the installed invocation still needs a live check. [Evidence](../evidence/2026-11-11-connection-check/README.md).

## Connection failure diagnostics

The first installed check produced a failure event without a verified connection. Add `promisory.remote-connection-diagnostic.v1` with a closed vocabulary for authentication stage, error category, standard JWT claim name, known contract-field names and HTTP status. After FIT signature/claim validation, only installation-binding comparison booleans and fixed module/environment-form categories are observable. Unknown values and error messages are discarded; no token, signature, source field, Graph derivative or arbitrary claim value enters the diagnostic.

The owned executor now logs its strict successful connection proof as well as safe failure events. Forge logs transport/response failures through the same diagnostic contract. The operator collector reads only the pinned development function and owned test deployment, validates each event, and retains fresh records. Failures are diagnostic events, not permission or proof of a valid invocation. All original authentication, context, sharing, review and write-hold checks are unchanged. Five additional tests prove missing-claim refusal, signed-claim/request-content non-disclosure and transport/HTTP failure privacy. [Diagnostic update evidence](../evidence/2026-11-11-connection-diagnostics/README.md).

The installed module mismatch led to [ADR 0012](0012-bind-hosted-forge-invocations.md): every request now requires a signed hosted-runtime attestation, and the v2 result distinguishes native FIT module data from hosted-context evidence. Refer to that decision for the current module-authentication contract.
