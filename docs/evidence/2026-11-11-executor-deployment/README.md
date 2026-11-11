# Approved executor deployment

11 November 2026 · Forge development 3.0.0 · execution verification held

The subsequent [read-only connection check update](../2026-11-11-connection-check/README.md) deployed Forge 3.1.0 and a new executor image. The observations below describe the initial deployment; the later record contains the current image and verification status.

The user approved the isolated Azure build/deployment and paid 4 GiB disk, then separately approved the shared API observer addition and rollout. The subsequent instruction **“turn on enforcement”** applies to the approved Promisory KAN-2 test action. [Authorization record](authorization.json).

The executor at **https://promisory-test.decionis.com** now runs with `PROMISORY_MODE=ENFORCEMENT`. Independent due-date intent and permitted Jira date-snapshot sharing are enabled. **`PROMISORY_ENFORCEMENT_VERIFIED=false` remains active**, so execution is held until the authenticated Forge invocation is verified. This is not a successful governed write or a completed P0 release. [Running configuration](execution-runtime.json).

| Check | Observed result |
| --- | --- |
| Source boundary | The reviewed 28-file source context was rechecked before upload. No local credentials, Graph data, fixture source, evidence or Git history were included. [Earlier source verification](../2026-11-10-live-test-site/remote-build-source-check-final.json). |
| Linux image | ACR run `cj47` succeeded. Registry metadata confirms Linux/amd64 and digest `sha256:a1de435f15a591c86fd14332fd99be9257ace62a84dd5b7cc263428086bdf4da`. [Build](acr-build.json). |
| Exact image smoke | Nine checks passed inside AKS with synthetic credentials: runtime version, UID, read-only root, private writable state, health, unauthenticated apply/reconcile, unknown route and oversized input. The temporary test pod and its deny-all network policy were removed after recording the result. [Image proof](image-smoke.json). |
| Runtime secrets | Three separately scoped values were stored in immutable Kubernetes Secret `promisory-test-secrets`. The execution credential's organization and approved non-secret key ID were revalidated. The matching HMAC is encrypted in Forge. No values were recorded. [Runtime secret](runtime-secret.json), [Forge variables](forge-variables.json). |
| Persistent storage | The actual Azure disk is 4 GiB Premium_ZRS in Central US, with public access disabled and network access DenyAll. [Disk identity and settings](managed-disk.json). The same private state survived a pod replacement; the synthetic probe was then removed. [Persistence](persistence-check.json). |
| Outbound network | Initial rules admitted Atlassian but timed out against the Decionis API's public load-balancer route. Adding HTTPS only to the existing ingress-controller selector resolved the translated private destination. Arbitrary private-network egress remains unavailable. [Failure and correction](network-check.json), [runtime preflight](runtime-preflight.json). |
| Public HTTPS | DNS resolves to the existing ingress, the Let's Encrypt certificate validates for the exact test hostname, and health returns HTTP 200. Unauthenticated apply/reconcile return 400; unknown routes 404; oversized bodies 413. [TLS/DNS](https-check.json), [request refusal](public-boundary.json). |
| Shared observer | Only key ID `c97a5168-1325-487c-94e8-e3d4b06adffd` was appended. The concurrency-guarded patch passed, the API rolled from generation 196 to 197, its image digest stayed unchanged, and readiness returned 200. [Rollout](observer-rollout.json). |
| Authority enforcement | From the deployed image, three synthetic ENFORCEMENT cases returned the expected v3 decision: wrong date BLOCK, different principal BLOCK, missing evidence ESCALATE. AgentSafe refused all three with zero verifier requests and zero inert-handler calls. No Jira client was involved. [Cases](enforcement-denials.json), [source](../../authority/check-dci-enforcement-denials.mjs). |
| Forge installation | Version 3.0.0 deployed after the expected major-version egress approval. The same Jira/Confluence installation upgraded to major 3 and is Up-to-date. The added scope is `read:app-user-token`; the added egress origin is the approved test host. [Record](forge-upgrade.json). |
| Local verification | The remote-enabled build passed 76 tests in 14 files, TypeScript, UI/remote builds, manifest validation, actual Forge packaging and offline release equivalence. [Full check](local-check.txt). |
| Final running state | The deployed server bytes match the locally compiled server. Mode is ENFORCEMENT; verification is false; operation and claim journals are empty. Health is 200 and unauthenticated apply remains refused after restart. [State](execution-runtime.json). |

The policy remains pinned to v3 UUID `457e04a4-0a1d-4f18-8bca-7a9a5df2adc8`, permits only the approved 12-to-18 November due-date effect, and expires **12 November 2026 at 00:00 UTC**. The separate DCI gateway was not changed; Promisory's configured boundary is its narrow AgentSafe executor.

The final [artifact review](artifact-review.json) found no configured credential values in the reviewed files, parsed all deployment JSON records and resolved the checked local documentation links. The denial script's syntax check also passed after formatting.

## Remaining acceptance

Browser access still reports disabled in Work settings after the user reported enabling it, a fresh computer-control session, and a later availability check. No browser workaround or alternate execution path was used. [Access record](browser-access.json). Restore effective Browser Use access and verify the real installed FIT app/module/environment/installation/cloud/principal and current-user OAuth path. The existing user approval covers the configured test deployment and enforcement; no repeat authorization is needed for that scope.

After that verification, release the verification hold through a guarded configuration update, prepare a fresh primary-authored proposal, obtain the second account's exact review, and test the supported grant/claim/write/finalization path. Check the current source afresh; older proposals expired. Exercise replay and lost-response recovery before retrying any uncertain action. Outcome, judge/Marketplace profiles and broader lifecycle acceptance remain separate gates.

The source patch for preserving the observer setting in Decionis is [separately reviewable](../../authority/decionis-observer-config.patch) and applies cleanly to its current checkout. It was not applied or committed there; the runtime change is active. Keep that source configuration aligned before a later full Decionis deployment. The paid retained disk remains allocated for the continued test; do not treat workload deletion as disk disposal.
