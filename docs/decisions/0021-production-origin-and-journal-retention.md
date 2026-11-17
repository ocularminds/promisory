# 0021 — Production executor origin and uninstall retention

Status: accepted owner decisions; public customer provisioning and deletion verification pending.

The Marketplace profile declares `https://promise.decionis.com`. DNS and a TLS ingress route it to the existing authenticated executor. This introduces a stable production origin without broadening the executor's one-installation authority boundary. Development and judge profiles retain the test origin, and source-equivalence checks still require the same executable capability across profiles.

The endpoint currently serves the bound test installation only. A new customer's installation must not inherit that policy or identity. Public Marketplace publication remains manual while customer provisioning is resolved.

The owner selected deletion of the executor journal 90 days after uninstall, retaining unresolved claims until reconciled. This is distinct from the configurable Forge record-retention interval and from authority-provider evidence retention. An old claim must remain recoverable even when the normal journal interval has elapsed.

The release includes an [operator runbook](../runbooks/executor-offboarding.md), not an automated uninstall/purge implementation. The deletion path and its exception handling require live verification before public customer execution. No expired policy or unresolved recovery claim is altered by this decision.
