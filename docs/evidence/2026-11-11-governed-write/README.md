# Live governed Jira due-date change

11 November 2026 · Forge development 3.4.0 · verified live execution

The approved KAN-2 change from **12 to 18 November 2026** completed through the installed Promisory app and its ENFORCEMENT executor. The user reported the fresh independent review and then **Change verified**. The [owned executor observation](executor-operation.json) independently records one settled successful operation, an acknowledged Jira write, matching native read-back and recorded authority finalization.

| Binding or result | Verified value |
| --- | --- |
| Test site | `decionis-promisory.atlassian.net` |
| Stable Jira issue | `10001`, cloud `e207942a-9edf-4952-b945-2ed6ed3707a7` |
| Native executing principal | `712020:2921f941-93f4-4ccb-9c03-2555a8bfe3d9` |
| Operation | `operation-9a24d5a1-2097-45ac-bdf9-e0bf31a87036` |
| Proposal | `proposal-fdee684c-d174-41f2-a49c-244ea8228d8d` |
| Policy revision | `457e04a4-0a1d-4f18-8bca-7a9a5df2adc8` (`promisory-test-v3`) |
| Decision | `bf4f4c88-5be8-454f-bf90-24f60e17d111` |
| Dossier | `8485dce8-7bfb-4a18-a0bd-f96e51384d37` |
| Claimed execution grant | `6206930c-05b6-80e5-849c-6ac3566d8317` |
| Result | `SUCCEEDED` / `MATCHED_EFFECT` / `RECORDED` |

The [DCI dossier read-back](authority-dossier.json) returned HTTP 200 and matched the exact organization, dossier and decision. Only correlation metadata was retained; the dossier payload and execution credentials were not copied. The connected dossier tool did not return the record, so this observation used the already-authorized organization API credential and documented read-only endpoint.

The server image and authority protocol are the [verified hosted invocation build](../2026-11-11-hosted-invocation/README.md); the [3.4.0 review guidance deployment](../2026-11-11-review-guidance/README.md) preserved those server entry points and the executor image. The executor accepts only the authenticated Forge installation/user context and signed exact intent. The shared domain service checks the current independent review before calling it; no operator collector invoked or retried the action.

This proves the normal live grant/claim/write/read-back/finalization path. It does **not** establish a lost-response recovery test, an absence of races with native Jira edits, or completion of the overall P0 release. The commitment's agreement deadline and fulfillment record are separate from the engineering due-date effect. Earlier delivery-health and regression-review badges are not execution results.

The policy retains its approved expiry of **12 November 2026 at 00:00 UTC**. A further date change requires a separately approved exact policy. Recovery, broader lifecycle cases and the real judge/Marketplace release profiles remain open acceptance work.
