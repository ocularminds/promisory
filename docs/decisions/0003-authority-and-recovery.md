# ADR 0003 · Bound execution and durable recovery

Accepted for the local candidate, 10 November 2026.

Use `@decionis/agent-safe-pipeline@0.5.0` directly inside the narrowly scoped remote adapter. `IntentCapture`, `DecionisGate`, `DecionisGrantVerifier` and `SafeExecutor` own intent capture, institutional evaluation, atomic claim and dispatch. This is an application executor boundary, not an organization-wide traffic interceptor or a second policy engine. The only registered handler is `jira.issue.set_due_date`; its write is inside `dispatch.run`.

The reviewed Forge action-gate Boolean is insufficient. Current SDK addressable resources are `POST /v1/authority/grants`, then `/v1/authority/grants/{grantId}/claims`, `/receipts`, and `/reconciliations`. Older sibling AgentSafe documentation names legacy execution endpoints. The implementation follows the pinned SDK and current Decionis `ExecutionAuthorityRoutes.ts`, with loopback `LocalAuthority` contracts as synthetic verification. No sibling repository was modified.

The server binds one verified installation to one organization. RS256 Forge Invocation Tokens use Atlassian's configured JWKS, expected issuer/audience and app/environment/installation/cloud/principal/module checks. The destination is the bound `api.atlassian.com/ex/jira/{cloudId}` origin/path. A second HMAC authenticates the exact internal effect envelope. Only the current user's OAuth token is accepted, never an app-token fallback; no OAuth token is persisted.

A durable file journal records the operation before dispatch. Single-host atomic creation prevents competing requests from dispatching twice. Claim material is sealed separately with AES-256-GCM and scope/principal/operation-bound authenticated data, using a key separate from the HMAC key. The claim is persisted before the handler runs. Normal finalization removes sealed material after positive acknowledgement. Pending or indeterminate attempts retain the minimum material needed for recovery.

The SDK's `adoptClaim` restores a claim after restart but does not reconstruct its in-memory indeterminate map. Recovery therefore uses the documented reconciliation resource only after a sealed, recorded indeterminate claim and matching native operation receipt have been validated. Production Decionis also requires authenticated trusted effect-observer provenance. A 409 replay response or absent observer authorization leaves finalization pending. It is never rewritten as success.

The target receives the operation ID in Jira history metadata. Reconciliation reads current state and bounded changelog evidence; it cannot dispatch. Grant/lease budgets reserve time for read-back/finalization. Native Jira edits can still race the final precheck and write; read-back detects a conflicting value, not an atomic transaction across systems.

The remote defaults to shadow/unverified with sharing disabled. Before enabling enforcement, run the live denial/no-PUT and success/receipt/replay tests against the selected deployment. A config flag is an operator assertion, not independent evidence that deployment verification happened.
