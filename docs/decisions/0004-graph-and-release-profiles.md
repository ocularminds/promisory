# ADR 0004 · Graph provenance and equivalent release profiles

Accepted for the local candidate, 10 November 2026.

Teamwork Graph and its derivatives remain within Atlassian. Every source reference carries explicit lineage. The external serializer permits only independently authored due-date intent and the separately consented narrow REST date snapshot. It rejects graph lineage and arbitrary fields. Rovo tools are server-composed with the `ROVO` channel; their proposals are `ATLASSIAN_ONLY`, including otherwise plausible due-date fields. A user can prepare a fresh independent proposal in the UI, where source checks and review run again.

The curated assigned-work query is useful bounded context, not a complete dependency or reporting-line graph. Actual Jira parent/link metadata supplies deterministic hierarchy and blocking paths. Rovo calls the same domain service as the UI; it has read and internal proposal actions, with no approval or execution action. [Graph reference](https://developer.atlassian.com/platform/teamwork-graph/call-the-teamwork-graph-api/), [Rovo actions](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/).

Keep development, judge and Marketplace app identities distinct. All profiles come from one manifest generator and the same source tree. Only app ID, licensing and remote origin may differ. Capability differences, a weaker judge executor, partial profile output or divergent packaged source hashes fail verification. Generated profiles remain unverified until installed. The example configuration deliberately contains null IDs; synthetic UUIDs exist only in offline tests and are never written to deployable manifests.

Jira is required and Confluence optional on the same site. Marketplace licensing is enabled only in its profile. Current multi-app eligibility and unlicensed judge distribution require live verification, including the app's actual sharing link. [Compatibility](https://developer.atlassian.com/platform/forge/app-compatibility/), [distribution](https://developer.atlassian.com/platform/forge/distribute-your-apps/). The external authority path is disclosed; no “Runs on Atlassian” badge is claimed.
