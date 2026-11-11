# Recovery test preparation

11 November 2026 · prepared, not approved, not deployed

The preceding [12 → 18 November governed action](../2026-11-11-governed-write/README.md) succeeded. The [reviewable follow-up plan](../../authority/recovery-test-plan.md) proposes one **18 → 19 November** change on the same KAN-2 issue and installation, with a separately approved policy and deliberate acknowledgement loss followed by restart/reconciliation.

Local TypeScript and the full **122 tests across 17 files** pass. Six new synthetic tests verify the transport probe's one-use reservation, concurrent/restart exclusion, exact request boundary, refusal/uncertainty behavior, expiry and runtime binding. These tests make no native Jira or authority requests. The compiled module passes syntax/import checks, and an inactive import leaves transport unchanged. A read-only check confirms the existing container has the required schema library and the probe is disabled. [Validation record](local-validation.json). The test-only source is outside both application entry points; no app bundle or production image changed.

The [retained preparation report](prepared-resources.json) identifies the exact policy/source/compiled hashes, runtime binding and guarded patches; the generated resources remain in the local, ignored `release/recovery-test-final-review/` directory. At this preparation checkpoint, the owned test service had one settled operation, no pending operation and no claim file. Three server dry runs validated the proposed ConfigMap and two resource patches. Those dry runs did not install the probe or activate the draft policy. Later recovery results are recorded [separately](../2026-11-11-recovery-test/README.md).

The test uses the existing image, one replica and retained disk. No new paid resources, ACR build, Forge deployment or shared production API change is proposed. Native review, grant/claim and reconciliation remain mandatory. This evidence does **not** establish live lost-response recovery or overall release acceptance.
