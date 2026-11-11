# Promisory executor in the existing Azure environment

11 November 2026 · deployed test executor · ENFORCEMENT active after verified installed invocation

This adapts `SwarmPay/infra/azure/{target.json,render.mjs,release.mjs}` and `Decionis/docs/runbooks/decionis-azure-deploy-runbook.md`. It does not invoke their broad production workflows. Both sibling checkouts' unrelated edits remain intact.

## Current deployment

[test-target.json](test-target.json) fixes the existing subscription, `decionis-aks`, namespace `decionis`, ACR and ingress controller. **https://promisory-test.decionis.com** resolves to existing ingress address `52.143.254.111` and serves a valid Let's Encrypt certificate. The [deployment evidence](../../docs/evidence/2026-11-11-executor-deployment/README.md) records the user approvals and actual checks.

Seven resources are scoped to Promisory: `promisory-test-executor` NetworkPolicy, ServiceAccount, ConfigMap, Service, Deployment and Ingress, plus `promisory-test-state` PVC. The single replica uses Recreate updates, a pinned image, UID/GID 1000, read-only root, no Kubernetes token and a private state volume. Initial deployment was SHADOW with sharing and verification false. Following the user's enforcement instruction, the running mode is ENFORCEMENT and narrow intent/REST sharing is enabled; verification is now true after the real installed primary-account check and guarded rollout. Each write still requires review and a supported grant/claim. The manifest renderer still produces safe initial SHADOW defaults. Reapplying its ConfigMap will reset the live mode and sharing settings.

The user-approved **4 GiB paid disk is provisioned and attached**. Azure confirms Premium_ZRS in Central US, with public network access Disabled and network access DenyAll. The [disk record](../../docs/evidence/2026-11-11-executor-deployment/managed-disk.json) names the exact Azure resource. The `decionis-zrs` class uses Retain; state survived a pod replacement. Deleting the workload is not disk cleanup: retained storage needs an explicit retention/disposal decision. Azure retail pricing was rate limited; no exact price is claimed.

The separately approved observer change appended **`c97a5168-1325-487c-94e8-e3d4b06adffd`** to `DECIONIS_TRUSTED_EFFECT_OBSERVER_API_KEY_IDS` on shared **`decionis-api`**. The [guarded patch generator](../../scripts/prepare-observer-test.ts) preserves existing IDs and tests deployment UID, resource version and container name. The [actual rollout](../../docs/evidence/2026-11-11-executor-deployment/observer-rollout.json) passed with the same API image and healthy readiness. Its source configuration is [prepared separately](../../docs/authority/decionis-observer-config.patch), without changing the dirty Decionis checkout. Live reconciliation still needs a real claimed operation.

The current image is `decionisacr.azurecr.io/promisory/executor@sha256:f30b1ab4606a5170bc3b1dc42d4b38599d50f5cf3053003dd6b84a3f49aaea7b`, built by ACR run `cj4c`. It includes the native history fix, pre-dispatch expected-effect commitment, required recovery evidence and receipt-state preservation. The guarded update changed only the test image and configured the already trusted observer identity. [Deployment verification](../../docs/evidence/2026-11-11-recovery-test/effect-binding-deployment-verified.json) confirms server bytes, private state, original operation/grant and both probes. The existing grant lacks its original effect commitment and cannot complete supported reconciliation. Retain its exact policy, claim, one-use probe, history observer and disk pending [operator review](../../docs/authority/recovery-operator-review.md). No shared API or new paid resource was changed.

## Local preparation

Use Node 22.23.4 from this repository:

```sh
npm run check
npm run remote:package
npm run remote:render:test -- --review-only
kubectl --context=decionis-aks -n decionis apply --dry-run=server \
  -f release/azure-test-review/network-policy.json \
  -f release/azure-test-review/resources.json \
  -f release/azure-test-review/ingress.json
```

The original dry run passed for all seven resources and created none; actual deployment is recorded separately. The review bundle deliberately has zero replicas and an unbuilt image label; do not apply it. The local production dependency check and the later real Linux-image checks are separate evidence.

`remote:package` produces `release/remote-build-<source-digest>-<run>/context.tgz` and `manifest.json`. The explicit source allowlist excludes `.env`, credentials, docs/evidence, fixture source and Git history. Each source hash and the archive hash are recorded. The [final archive check](../../docs/evidence/2026-11-10-live-test-site/remote-build-source-check-final.json) verified all 28 files and found no configured credentials. `release/azure-test-review/build-source-path.txt` identifies the current archive. Never put secrets in build arguments or context.

The Dockerfile pins `node:22.23.4-bookworm-slim` to `sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d`. The local Docker engine returned EOF, so the approved build used existing ACR. No Docker workloads were restarted.

## Reproduce or update within the approved test scope

1. Confirm the Azure subscription and use explicit `--context=decionis-aks -n decionis` on every Kubernetes command. Do not switch global context, apply Terraform or dispatch the full Decionis pipeline.
2. Verify the archive and its extracted `context/` directory against the manifest, and scan for local credential values without printing them. Build only that reviewed directory in existing ACR with a source-digest tag and `linux/amd64`: `az acr build --registry decionisacr --image promisory/executor:<source-digest> --platform linux/amd64 --file apps/remote/Dockerfile <reviewed-context-directory>`. The CLI accepts a local directory, not a local tarball argument. Record the run identity; inspect an ambiguous submission before any retry.
3. Verify build success, registry digest and image platform. Test the image with a read-only filesystem, synthetic secrets and a private writable volume, checking health and request refusal. Render with `npm run remote:render:test -- --image decionisacr.azurecr.io/promisory/executor@sha256:<verified-digest>`. A syntactically pinned digest alone is not verification.
4. Create `promisory-test-secrets` through the runtime secret store. It contains only `PROMISORY_AUTHORITY_API_KEY` (supplied execution key), `PROMISORY_REMOTE_SIGNING_KEY` (new random HMAC) and `PROMISORY_CLAIM_ENCRYPTION_KEY` (separate random 256-bit hex). Keep values out of displayed arguments, Git and logs. Preserve keys on retries: changing encryption keys can strand claims.
5. Apply `release/azure-test/network-policy.json`, then `resources.json`. Verify PVC Bound, one Ready pod and private writable state. Test persistence across restart. Keep SHADOW mode during setup.
6. Add the `promisory-test` A record in existing `decionis.com` and apply `ingress.json`. Verify trusted HTTPS and unauthenticated request refusal. No cluster or load balancer is created.
7. For the separately approved observer change, run `./node_modules/.bin/tsx scripts/prepare-observer-test.ts` immediately before applying. Review `release/azure-test-review/observer-review.json` and `observer-append.patch.json`. The generator only reads and dry-runs; after authorization, apply the freshly generated patch with `kubectl --context=decionis-aks -n decionis patch deployment decionis-api --type=json --patch-file release/azure-test-review/observer-append.patch.json`. A failed concurrency guard requires a fresh read and review. Verify rollout and effective observer membership. Prepare the corresponding upstream configuration change separately; do not include unrelated edits or run the broad pipeline. If rollback is required, remove only this added observer ID from a freshly read, concurrency-guarded environment list; do not roll back other deployment changes.
8. Continue [Forge and authority acceptance](../../docs/authority/README.md#live-acceptance-after-deployment), using the verified v3 UUID and trusted installation. Sharing and test enforcement are now authorized. A policy expiry or broader effect requires another scope decision. Verify the real FIT/OAuth path before releasing the existing verification hold; synthetic denial checks alone do not establish a successful governed action.

Forge development **3.6.0** is deployed, and the existing Jira/Confluence installation is Up-to-date on major 3. Manifest, remote origin and scopes are unchanged. Earlier native invocation evidence establishes FIT, signed hosted context and current-user OAuth; no fresh 3.6 native check is claimed. The normal 12 → 18 November action passed. The recovery test's 18 → 19 native effect is also verified, but its original authority grant has no expected-effect commitment. The fixed adapter prevents that omission for future grants; full live recovery remains open. [Current evidence](../../docs/evidence/2026-11-11-recovery-test/README.md).
