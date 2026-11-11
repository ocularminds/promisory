# Review availability guidance

11 November 2026 · development 3.4.0 deployed · governed action subsequently verified

The user reported a disabled **Approve review** button while signed in to Jira as the designated secondary account. The prior UI put older proposals first and displayed the same name for both test accounts. These observations do not establish the cause of the disabled button or a completed review.

The updated Reviews page sorts proposals newest first, identifies a proposal authored by the current principal as **Prepared by you**, and gives an accessible explanation for each existing disabling condition: author, expiry, or recorded operation. Review eligibility and all server checks are unchanged.

- [Validation](local-validation.json): TypeScript, workspace build, three existing execution-domain tests, the existing local browser review test, Forge packaging and formatting passed. The three Forge server entry points are byte-identical to the verified 3.3.0 build. The browser test uses fictional records in a fresh test browser, makes no external requests, and does not access the user's Jira session. [Inspected fixture screenshot](held-review.png).
- [Deployment](forge-deployment.json): 3.4.0 deployed with authenticated lint reporting no issues. The existing major-3 Jira/Confluence installation is Up-to-date. No registration, uninstall, new scope, origin, external image build or runtime mutation occurred.
- [Executor read-back](executor-runtime.json): the same single Ready process, image, server hash, installation binding and exact approved policy remain active in ENFORCEMENT with verification and both sharing flags true. The prior [real signed connection and activation](../2026-11-11-hosted-invocation/README.md) remain the authentication evidence.

The user's two subsequent screenshots resolve the disabled-button question. [Sanitized availability metadata](user-screenshot-observation.json) records a proposal that expired on 10 November at 22:14 Stockholm with an already-approved, held attempt, and a separate internal Rovo proposal that expired at 23:47. The first card's “Authorization unavailable” is the saved historical attempt result. Neither pictured card is a fresh executable proposal. The UI therefore correctly disables approval; the pictures do not establish the current principal's identity or the full proposal inventory.

A new primary-authored proposal from the commitment's recovery form was requested. The user subsequently reported **Review recorded**. This is a user-reported UI result; the normal server checks must still validate the exact current review at apply. The [fresh journal observation at 03:39 UTC](operations-before-fresh-proposal.json), followed by a read-only observation at 03:42:14 UTC, found enforcement active with zero executor operations. The user has been asked to apply the new reviewed proposal once as the primary Jira account. No live governed write is claimed. Raw screenshots and the internal Rovo proposal payload were not copied into this evidence folder.

`scripts/read-test-connection.ts` now defaults to this deployment's version and binding. It remains a read-only primary-account log collector. Use `scripts/read-test-operations.ts` to inspect only the owned executor's allowlisted operation metadata after a real reviewed apply; neither collector invokes, retries, or reconciles a write.

The subsequent [live governed action](../2026-11-11-governed-write/README.md) succeeded after a fresh review. Its independent executor observation and matching DCI dossier close the normal successful-write gate. The earlier no-operation observations above describe the troubleshooting timeline, not the current operation count.
