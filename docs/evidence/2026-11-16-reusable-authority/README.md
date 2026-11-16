# Reusable authority policy · 16 November 2026

Owner approval: "Approved with a new reusable authority policy provisioning" (session of 16 Nov 2026). Decision record: [ADR 0015](../../decisions/0015-reusable-authority-policy-and-commitment-closure.md).

| Step | Result | Evidence |
|---|---|---|
| Dry run | Canonical request hash recorded; nothing sent | [policy-publication-dry-run.json](policy-publication-dry-run.json) |
| Attempt 1 | HTTP 400 `VALIDATION_ERROR`; the script did not yet record `issues` | [policy-publication-rejected-1.json](policy-publication-rejected-1.json) |
| Attempt 2 | HTTP 400: `/metadata/change_ticket` exceeded 200 characters | [policy-publication-rejected-2.json](policy-publication-rejected-2.json) |
| Publication | HTTP 202 accepted; artifact `33c97bbd-7ab7-424a-b7d6-a069277d1101`; exact canonical payload read back; lifecycle **ACTIVE** | [policy-publication.json](policy-publication.json) |
| Live SHADOW cases | **22 of 22 passed**: 5 ALLOW, 13 BLOCK, 4 ESCALATE (including an unset existing date). No token or grant in any response | [policy-shadow-cases.json](policy-shadow-cases.json) |

The policy file is [`promisory-dci-policy.reusable-v1.json`](../../authority/promisory-dci-policy.reusable-v1.json). Reproduce with:

~~~sh
npx tsx scripts/publish-dci-policy.ts --policy docs/authority/promisory-dci-policy.reusable-v1.json --output docs/evidence/<release>/<name>.json [--apply]
npx tsx scripts/check-dci-reusable-policy.ts --revision 33c97bbd-7ab7-424a-b7d6-a069277d1101 --version promisory-reusable-v1 --output docs/evidence/<release>/<name>.json
~~~

These are synthetic SHADOW evaluations. They involve no Jira read, grant, claim or write.

## Not yet done: executor selector (operator step)

The running test executor still selects the expired recovery revision `436f37a4…`, so live applies remain HELD until the selector changes. The Kubernetes step was not run from this session because the agent's permission policy blocks access to the shared `decionis-aks` cluster. To switch, run:

~~~sh
npx tsx scripts/prepare-policy-selector.ts        # reads, writes a guarded patch, server dry-run only
kubectl --context=decionis-aks -n decionis patch configmap promisory-test-executor --type=json --patch-file=release/policy-selector/configmap.patch.json
kubectl --context=decionis-aks -n decionis rollout restart deployment/promisory-test-executor
kubectl --context=decionis-aks -n decionis rollout status deployment/promisory-test-executor --timeout=180s
~~~

The patch tests the ConfigMap UID, its resource version and the current selector value, so a concurrent change fails instead of being overwritten. Only `PROMISORY_AUTHORITY_POLICY_ID` changes; mode, sharing, verification, image, secrets and the private disk are untouched. Afterwards, run **Connections → Check connections** and complete one reviewed date change (for example KAN-2 19 → 25 Nov) to record a fresh successful governed write.
