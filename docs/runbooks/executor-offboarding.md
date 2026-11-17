# Executor offboarding and journal retention

Owner decision, 17 November 2026: delete the executor journal 90 days after uninstall; retain unresolved claims until reconciled. This applies to Promisory's executor records, not to independently retained authority-provider evidence. Forge record retention and Atlassian's platform uninstall lifecycle are separate.

The current executor is bound to one test installation. There is no automated uninstall callback or purge job yet. This runbook defines the operator process and launch verification; it is not evidence that deletion has run.

1. Confirm the uninstall with the customer administrator and the installation's stable app, environment, installation and cloud identifiers. Record the observed uninstall time, evidence, responsible operator and deletion due date in the private support record. Do not infer uninstall from a transient connection failure.
2. Disable new governed requests for that installation through its configured access boundary. Preserve the journal, claim vault, identifiers and encryption keys needed for reconciliation. Never repurpose the existing executor binding for another installation while unresolved operations remain.
3. Inventory journal records and claim-vault entries by the exact installation scope, without exporting credentials or claim material. Separate terminal operations with positively acknowledged finalization from unresolved, reconciling and pending-finalization operations.
4. At 90 days, prepare a scoped deletion manifest for terminal records only. Review the manifest, retention exceptions and backup expiry before the storage operation. An absent provider response, a timeout or a locally settled write does not prove terminal acknowledgement.
5. Keep each unresolved claim and the minimum journal context needed to reconcile it until the supported authority flow confirms finalization. Reconciliation must not redispatch the Jira write. Once reconciled, apply the elapsed 90-day rule to that record.
6. Verify the deletion by installation scope, document excluded claims and record backup expiry separately. Confirm completion to the customer through the support case. Do not claim deletion of provider-owned evidence without the provider's confirmation.

Before enabling public customer execution, verify this process with a disposable test installation, including an unresolved claim exception and a terminal record past its retention date. The existing unresolved recovery claim is protected and must not be used as disposable test data.

Support: support@decionis.com. Privacy and data-processing requests: privacy@decionis.com.
