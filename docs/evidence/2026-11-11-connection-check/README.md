# Read-only execution connection check

11 November 2026 · Forge 3.1.0 deployed · live invocation not yet verified

The existing Connections diagnostics reported that a remote was configured without exercising its authenticated invocation. The new **Check connections** button invokes a strict, read-only endpoint using trusted Forge context. It verifies the signed FIT and its installed app version/module, then confirms that Jira's current-user token belongs to that same active principal. It does not call Decionis, claim a grant, write a journal record, change Jira, approve a proposal or remove an execution hold. [Architecture decision](../../decisions/0011-read-only-executor-connection-check.md).

The user authorized continuation of implementation and the existing test deployment/enforcement scope. This update uses that same executor, registry, disk, identity and remote origin. No new permission scope, paid resource or shared API change is introduced.

## Local evidence

- [Full check](local-check.txt): 97 tests across 16 files passed, plus TypeScript, workspace/remote builds, manifest validation, actual Forge packaging and offline release equivalence. The existing bundle-size advisory remains.
- [Forge bundle](forge-bundle.json): actual CLI packaging succeeded. This is not evidence of an installed invocation.
- Twenty-one new tests cover strict external-field provenance, fresh correlation, exact FIT/HMAC and current-user identity, missing/expired authorization, redirect refusal, and preservation of the execution hold. FITs, Jira responses and authority configuration in these tests are explicitly synthetic.
- [Reviewed build source](build-source-check.json): all 28 file hashes and archive membership match, and configured raw/base64 credential values are absent. The source context excludes Graph data, evidence, docs, fixtures and Git history.
- [ACR build](acr-build.json): run `cj48` succeeded for reviewed source `962d3e4369a5…`. Registry read-back matches digest `sha256:838f91d36f0fc450ee4214bccd6abf8d991d0c39d2cf5426fa069e5277f6a062`. The initial CLI call returned no usable run ID; run history recovered the one submitted build, without a duplicate submission. Registry metadata omitted platform attributes; the completed build and deployed process independently establish Linux/amd64.
- [Guarded rollout](executor-rollout.json) and [runtime check](executor-runtime.json): only the test executor image changed. One non-root Node 22.23.4 process is Ready; deployed server bytes match the local build. ENFORCEMENT, the verification hold, sharing and the exact policy remain unchanged. Health is 200, unauthenticated connection/apply/reconcile are 400, unknown routes are 404, oversized connection input is 413, and operation/claim journals are empty.
- [Forge deployment](forge-deployment.json): authenticated lint passed and development 3.1.0 deployed. The same Jira/Confluence major-3 installation is Up-to-date. No scope or remote-origin change was introduced. The remote-enabled app remains ineligible for Runs on Atlassian; Marketplace eligibility is a separate question.

## Live check

Browser automation continues to report **“Local browser use is disabled in Work settings”**, including for external Chrome. No alternate automation route was used. A user can perform this read-only check in their ordinary external browser once the update is installed:

1. Open Promisory on `decionis-promisory.atlassian.net` as the primary approved test account, `festus@decionis.com`.
2. Reload the app, open **Connections**, then choose **Check connections**.
3. A verified connection with the current configuration must say that the account is verified and Jira writes remain held. A connection result is not execution authorization.

Only a successful, runtime-validated `PROMISORY_REMOTE_CONNECTION_CHECK` event from the installed Forge function establishes this check. The event contains non-secret context, version/module, correlation/time and mode/hold flags; it contains no tokens or source content. Read-back of that event and the current deployed image/configuration is required before any operator release of the verification hold. A failed check remains unavailable and must be investigated without weakening the binding.

The user reported completing the check. The [initial log observation](installed-connection-initial.json) did not contain a verification event, so it is not treated as success. [The read-only evidence collector](../../../scripts/read-test-connection.ts) retains only strict, fresh events for the pinned installation, expected deployed version and approved primary test account. It never changes the execution flag.

The [later log observation](installed-connection-after-log-delay.json) also contained no verification event. When the user replied “reinstall,” the existing installation was [reapplied through Forge's upgrade command](installation-reapply.json); Forge reported that the site was already current and made no change. The user subsequently confirmed the workspace was open and reported “not verified.” The [next observation](installed-connection-workspace-open.json) contains one failed check and no verified invocation. No uninstall occurred or is authorized by those replies. A [narrow diagnostic update](../2026-11-11-connection-diagnostics/README.md) investigates the failure while preserving the installation and write hold.

The approved v3 policy remains pinned to `457e04a4-0a1d-4f18-8bca-7a9a5df2adc8` and expires **12 November 2026 at 00:00 UTC**. Fresh independent review, source access/freshness, grant/claim, the governed write, finalization and uncertain-result recovery remain separate gates. No governed Jira write or complete P0 release is claimed.
