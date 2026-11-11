# ADR 0009 · Explicit authority policy selection

Accepted for the local candidate, 11 November 2026.

The supplied DCI execution credential has `decision:enforce` scope but no policy binding. Decionis supports a trusted `action.parameters.policy_id` selector, captured before the intent hash. An unbound credential without that selector uses the workspace's unnamed default policy; publishing a named Promisory policy does not change that default.

The remote therefore requires `PROMISORY_AUTHORITY_POLICY_ID` in its host configuration. `AgentSafeExecutor` validates the selector, adds it to the parameters before `IntentCapture`, and constrains the registered handler to that exact value. The Forge envelope and Jira effect remain unchanged and reject caller-supplied selectors. There is no UI or Rovo policy control. This also works with a credential bound to the same policy; a differently bound credential must fail rather than be retried against another policy.

The initial test binding used stable name `promisory-test-jira-due-date`. Following live validation, ADR 0010 pins the deployment to verified revision `457e04a4-0a1d-4f18-8bca-7a9a5df2adc8`. The resolved revision, policy digest, intent, claim and finalization remain Decionis responsibilities. The reviewed upstream contract is `Decionis/docs/runbooks/execution-policy-bundle-id.md`; the pinned SDK remains `@decionis/agent-safe-pipeline@0.5.0`. No upstream change was made.

The local SDK contract tests verify that the selector reaches the actual grant request and that empty configuration or caller overrides stop before evaluation or Jira dispatch. Those tests use a synthetic local authority and do not establish live enforcement. Checker approval was subsequently supplied. The initial approved revision was retired after an equality-comparison failure; corrected v3 passed 18 live shadow checks. See [ADR 0010](0010-exact-dci-policy-and-test-executor.md). The gateway still reports SHADOW/PASSTHROUGH. HTTPS executor deployment and trusted-observer registration remain prerequisites.
