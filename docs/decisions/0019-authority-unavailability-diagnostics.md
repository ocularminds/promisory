# 0019 · Distinguish unavailable authority from a policy rejection

The first live apply after the reusable-policy rollout returned an SDK fail-closed result with no decision reference. The adapter displayed it as a policy rejection and retained no diagnostic reason. A subsequent SHADOW check from the same bound executor returned ALLOW, so that rejection wording was not supported by the available evidence.

Unavailable, failed, or oversized authority responses now leave execution HELD with an explicit availability message. Genuine BLOCK decisions and invalid intent/grant bindings remain blocked. Neither state dispatches a Jira write, and the durable operation prevents an automatic retry.

The executor emits a versioned, bounded diagnostic event containing the operation ID, HTTP status when received, elapsed time, verdict, fail-closed flag and protocol reason codes. Request/response bodies, credentials, grants, claims, source content and Graph data are excluded. Diagnostics cannot confer authority or change the grant checks.

The next live attempt received ALLOW but failed before dispatch. A second event now records the execution boundary's outcome and refusal reason, claim HTTP status, bounded protocol reason codes and whether the claimed effect commitment matched. It inspects at most 100 KiB of a copied response; the SDK still receives and validates the unchanged original. No claim material is exposed, and a refused operation is never automatically retried.

The existing policy, independent-review requirement, bound installation, allowlisted action and original unresolved recovery claim remain in force. Evidence is retained under `docs/evidence/2026-11-16-release-rollout`.
