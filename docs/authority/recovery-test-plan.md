# Controlled live recovery test

11 November 2026 · approved · native history recovery verified · authority recovery blocked

The [normal governed KAN-2 change](../evidence/2026-11-11-governed-write/README.md) from **12 to 18 November 2026** is verified. This follow-up would test recovery when Jira accepts a write but the executor loses the acknowledgement. It adds one exact date change, **18 to 19 November 2026**, and temporarily preloads an operator-only transport probe in the existing test executor.

The prior policy approval covers only 12 → 18 November. The user separately approved this plan and its exact policy in `call_6hHzX1BGUJM5Xol2KwWDPAJY:0`. The [approved publication](promisory-dci-recovery-policy.approved.json) retains `requires_approval: true` and records the actual human checker. Its rules match the [reviewed draft](promisory-dci-recovery-policy.draft.json); only approval-reference metadata was shortened for ingestion. Canonical read-back, 18 synthetic policy cases, the guarded deployment, native 204 and persistence restart passed. The later exact-history check succeeded, but the original authority grant omitted its effect commitment and cannot complete supported reconciliation. [Current result](../evidence/2026-11-11-recovery-test/README.md).

The fresh native check now verifies the exact operation-tagged history effect. The authority claim remains INDETERMINATE because its original Protocol 1.1 grant omitted the expected-effect digest. The current prevention fix is deployed as image `sha256:f30b1ab4606a5170bc3b1dc42d4b38599d50f5cf3053003dd6b84a3f49aaea7b`, with Forge 3.6.0, preserving the old claim and test controls. **Do not repeat the write or run cleanup as if recovery passed.** The ordered procedure below is the approved test plan, not a statement that every step succeeded. [Operator review](recovery-operator-review.md) and [current evidence](../evidence/2026-11-11-recovery-test/README.md).

## Exact scope

| Item                          | Proposed value                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Site and stable issue         | `decionis-promisory.atlassian.net`, KAN-2 / issue `10001`                           |
| Cloud                         | `e207942a-9edf-4952-b945-2ed6ed3707a7`                                              |
| Executing account             | `festus@decionis.com`, native account `712020:2921f941-93f4-4ccb-9c03-2555a8bfe3d9` |
| Independent proposal reviewer | `mail.festus@gmail.com`, through its existing scoped role                           |
| Jira date                     | `2026-11-18` → `2026-11-19`                                                         |
| Policy                        | `promisory-test-jira-recovery` / `promisory-recovery-test-v1`                       |
| New revision UUID             | `436f37a4-311f-4dd5-aa07-5a197ed277ed`                                              |
| DCI organization              | `124e5022-6eee-4717-ab65-a03899db6237`                                              |
| Expiry                        | **12 November 2026, 00:00 UTC** (01:00 Stockholm)                                   |
| App                           | `6e0430ce-9c00-425a-80c2-97b5cec1e8ae`                                              |
| Development environment       | `24550cf8-ab9d-4e6a-b46e-96df09cf2866`                                              |
| Installation                  | `283d450f-c6c4-43aa-85fc-aa9d05a085f8`                                              |
| Service                       | `https://promisory-test.decionis.com`                                               |
| Kubernetes scope              | Context `decionis-aks`, namespace `decionis`, deployment `promisory-test-executor`  |

The original probe installation used image `decionisacr.azurecr.io/promisory/executor@sha256:a387bebb193e4ad99e8fe0d10808a73bae875e6198202b95d77a4da48169bc4a`, one replica and the existing retained 4 GiB disk. During step 6, native evidence exposed a raw-date/display-date mismatch. Its [scoped parser fix](../evidence/2026-11-11-recovery-test/README.md#observed-parser-mismatch-and-deployed-fix) was built in the already approved ACR environment and deployed as image `sha256:37ba069148a4ac4ffbf346d888094b13abcb07f2d449449952472ff4efc030fd`, with the same policy, probes, claim and disk. Forge 3.5 clarifies the saved result state. No new paid resource, shared production API change, credential change or additional Jira effect was introduced. Cleanup retains the corrected image. The commitment's agreement deadline and fulfillment remain separate.

## Reviewable changes and safeguards

The [preparation tool](../../scripts/prepare-recovery-test.ts) reads the owned resources and verifies their UIDs, image, compiled server hash, actual runtime binding, single ready instance, zero pending operations and empty claim vault. It validates the draft against the approved policy's exact conditions, changing only the intended date pair. It writes new local files and performs three Kubernetes server dry runs; it never applies resources or calls a decision/write endpoint.

Run from the repository with Node 22.23.4:

```sh
fnm exec --using=22.23.4 npx tsx scripts/prepare-recovery-test.ts --output release/recovery-test-final-review
```

That local, ignored directory contains the originally reviewed `review.json`, `recovery-probe.configmap.json`, `executor.config.patch.json` and `executor.deployment.patch.json`. The ConfigMap contains only the compiled [operator probe](../../scripts/live/recovery-probe.ts). Fresh resource guards were generated in `release/recovery-test-approved/review.json` before application. The committed [preparation record](../evidence/2026-11-11-recovery-preparation/prepared-resources.json) preserves the policy/source/compiled hashes and observed deployment generation; generated deployment files remain local. Do not rerun installation preparation while the probe is active or remove the UID, resource-version or image tests.

The probe is absent from both app entry points. When explicitly enabled, it requires the exact test installation, DCI policy, authority URL, enforcement/sharing flags, state path and expiry. It forwards the normal executor's original request only after reserving an exclusive private marker on the retained disk. The exact cloud, issue, desired date, strict native payload and operation ID must match. Any additional Jira PUT in that route is refused. It does not supply identity, approval, a grant or a replacement Jira request.

A native success response is recorded as `ACKNOWLEDGEMENT_SUPPRESSED`, then a transport error is raised before the executor receives it. Real non-success responses remain non-success responses. A transport uncertainty stays uncertain. The marker prevents a second forwarded write across concurrent calls and restarts. Reads and authority calls pass through. Only fixed metadata is recorded; no OAuth, FIT, HMAC, execution token, claim material, source prose or Graph data is retained.

## Approved execution procedure

1. Obtain approval of this exact effect, expiry and probe. Use the established DCI publication/checker flow with the policy-author credential and record the actual human checker separately. Do not reuse the previous policy's checker record as approval for this effect. Verify the published canonical policy against the draft, allowing only the newly recorded approval metadata. Verify exact positive/negative policy cases in SHADOW before runtime activation; those cases are synthetic and cannot prove a Jira action.
2. Recheck that the existing operation is settled and there is no pending claim or reconciliation. Regenerate guarded patches if needed. Apply the immutable probe ConfigMap, then the policy-binding patch, then the deployment patch, always with `--context=decionis-aks -n decionis`. The deployment patch starts the same image with `node --import /app/recovery-probe.mjs /app/server.js`, adds only the probe flag/mount/volume and a digest annotation. Do not apply the initial SHADOW renderer. Wait for the owned single-instance deployment to become ready and verify its image, server/probe hashes, fixed policy, runtime flags and ready event.
3. As the primary account, refresh the installed workspace and run **Check connections**. Prepare a fresh exact proposal from the current **18 November** source date to **19 November**. If Jira has changed or the policy expired, stop. The secondary account must review this new proposal through **Reviews**; the prior review does not approve it.
4. As the primary account, choose **Apply reviewed change** once. Expect an uncertain/reconciling result after the deliberate acknowledgement loss. Preserve the probe marker and allowlisted operation metadata, including the operation ID, unknown stage, grant reference and pending/finalization state. If the probe did not record a native success, do not claim an injected acknowledgement-loss test and do not erase its marker to retry.
5. While that operation remains uncertain, restart only the owned test executor with the same image, probe and retained disk. Capture the replacement pod UID, unchanged storage identity, and continued presence of the same marker/operation/claim (counts and safe metadata only). Do not read encrypted claim contents or persist current-user tokens. The restart must finish before expiry; the probe refuses startup after its deadline.
6. As the original primary account, choose **Check operation result** for the same operation. This obtains fresh native OAuth and runs read-only reconciliation. Verify Jira's current date and the exact operation-tagged history effect before recording success. Confirm the claimed grant's authority reconciliation and recorded finalization. Do not infer recovery from a successful normal write or from the probe's private success marker alone. If Jira's history format cannot prove the exact operation, retain the uncertain state and fix only the observed parser incompatibility with regression coverage; never issue another write to resolve ambiguity.
7. Preserve before-loss, after-restart and reconciled observations. Use a collector scoped to this new policy/effect; the existing normal-write collector deliberately accepts only the old 12 → 18 policy. Record the test as **deliberately injected acknowledgement loss**, not a naturally observed outage.

## Cleanup included in this plan

During reconciliation diagnosis, a separate [read-only history observer](../../scripts/live/recovery-history-observer.ts) was added to the same image in a second immutable ConfigMap. It observes only the existing exact-target changelog requests, retains a strict metadata/date-format projection and never supplies a receipt or alters native responses. [Deployment and preservation evidence](../evidence/2026-11-11-recovery-test/history-observer-deployment-verified.json). Remove its `PROMISORY_RECOVERY_HISTORY_OBSERVER` flag, preload arguments, `/app/recovery-history-observer.mjs` mount, `promisory-history-3d06fe1f5315` volume and `promisory.decionis.com/recovery-history-observer` annotation during the same guarded cleanup. Delete that immutable ConfigMap only after matching its reviewed hash and confirming it has no pod references. Retain its sanitized observations with the recovery evidence.

After reconciliation, re-read the two owned resources. Guard their exact UIDs, fresh resource versions, image, recovery policy, probe digest, expected command/args and uniquely named additions before preparing cleanup patches. Server-dry-run both patches before applying. A failed guard requires inspection, not a force overwrite.

Restore the runtime ConfigMap's policy UUID to `457e04a4-0a1d-4f18-8bca-7a9a5df2adc8`. Remove only the probe's explicit command/args, `PROMISORY_RECOVERY_PROBE` environment entry, volume mount, volume and `promisory.decionis.com/recovery-probe` annotation, preserving all other fields. Remove the whole environment/annotation parent only if this plan created it and it has no other entries. The resulting pod again uses the image's normal command. Verify readiness, the original policy and unchanged image/server/storage. Delete the immutable probe ConfigMap only after confirming it has the reviewed digest and no pod references it. Retire only the newly created recovery policy through the guarded DCI lifecycle flow.

Keep the operation, finalization evidence and durable one-use marker. Never clear the marker to create another opportunity to dispatch. Do not remove unresolved claim state. If cleanup becomes necessary before reconciliation, removing the probe does not authorize a retry: preserve the same recovery policy binding long enough to reconcile that existing operation, and restore the old binding only when the operation is settled. If the deadline has passed, keep writes refused and assess the existing read-only recovery path.

The new Jira date remains **19 November** after this test. Reversing or making another date change requires its own exact approval. [Preparation evidence](../evidence/2026-11-11-recovery-preparation/README.md) and [design decision](../decisions/0013-controlled-recovery-acceptance.md).
