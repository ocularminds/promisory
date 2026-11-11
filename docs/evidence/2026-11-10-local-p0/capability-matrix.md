# Phase 0 capability matrix

Checked 10 November 2026. See [machine-readable inventory](phase0.json) for versions and prerequisite presence. An available CLI command, package type or manifest module is not proof of a tenant capability.

| Capability | Current evidence | Live status / dependency |
|---|---|---|
| Developer CLI | Forge CLI 15.1.0 authentication succeeded | Two owner spaces need selection; no Promisory registration completed |
| Jira access | Current-user REST adapter contracts, native levels and directed dependency tests | Needs selected test-site URL, installation and two-user permissions |
| Confluence | Versioned existing-page mapping, macro and ACL omission tests | Needs same-site connection and live page ACL verification |
| Teamwork Graph | Documented assigned-work query, current-user variables, pagination/null/error/filter contracts | Needs installed graph scopes and real returned entity links |
| Rovo actions | Shared service, eight reads/two internal proposals, no review/execute tools | Needs site Rovo capability and actual function context/agent evaluation |
| Current-user remote | RS256 FIT/HMAC/installation/destination tests, no OAuth persistence | Needs owned HTTPS endpoint and actual installed invocation binding |
| Decionis evaluation | SDK 0.5.0 resource paths and loopback ALLOW/BLOCK/ESCALATE contracts | Needs server-bound test organization, credentials and policy |
| Grant execution | One handler/claim/dispatch/finalize path with replay, stale and uncertain-result cases | Needs independently verified enforcement and real Jira receipt |
| Restart reconciliation | Sealed claim recovery and bounded no-write observation tests | Needs registered trusted effect-observer provenance on authority |
| Distribution | One generator; only identity/licensing/origin vary; offline guard tests | Distinct real development/judge/Marketplace IDs and live eligible sharing/listing flow |

The reviewed AgentSafe deployment guide describes the managed gateway as shadow-only. The app uses the pinned SDK inside its own narrow executor; that deployment still requires independent enforcement verification. A hosted authority and a hosted gateway are different services.

Relevant official references: [Node runtime](https://developer.atlassian.com/platform/forge/function-reference/nodejs-runtime/), [SQL](https://developer.atlassian.com/platform/forge/storage-reference/sql/), [Rovo action](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/), [graph invocation](https://developer.atlassian.com/platform/teamwork-graph/call-the-teamwork-graph-api/), [curated graph queries](https://developer.atlassian.com/platform/teamwork-graph/curated-queries/), [graph scopes](https://developer.atlassian.com/platform/teamwork-graph/scopes/), [Remote essentials](https://developer.atlassian.com/platform/forge/remote/essentials/), [Remote product APIs](https://developer.atlassian.com/platform/forge/remote/calling-product-apis/), [compatibility](https://developer.atlassian.com/platform/forge/app-compatibility/), [distribution](https://developer.atlassian.com/platform/forge/distribute-your-apps/).
