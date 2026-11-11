# Pull-request preparation — 11 November 2026

Validation used a fresh export of the staged implementation on `codex/promisory-p0`, followed by a new dependency installation. The export contained no populated environment files, dependency directories, generated releases, execution journals, or claim material.

## Local validation

- `npm ci` passed with Node 22.23.4 and npm 10.9.9.
- `npm run check` passed: TypeScript, **139 tests across 20 files**, UI and remote builds, manifest validation, Forge backend packaging, and offline release-profile equivalence.
- The fixture browser suite exercised **eight cases** in an isolated headless Chrome session. Seven passed on the initial run. The readiness case exposed an outdated exact-text assertion after the UI added the gate version to its applicability label. The updated case passed separately and now verifies the retained historical approval as well as stale applicability and disabled approval controls. No application behavior was changed for this repair.
- TypeScript and formatting checks passed after the test update. Browser checks did not use the signed-in Jira session or establish new live integration evidence.
- All **365 local documentation links** in the implementation export resolved before this record was added. The release-profile example is included after narrowing the root release-output ignore rule; its identities remain null until real apps are registered.
- Publication scanning found no configured credential values or their Base64 encodings. The token-pattern match in the encrypted-vault test is an explicit synthetic fixture. Native test screenshots were visually reviewed; the graph transport screenshot contains only the synthetic echo probe, with no graph entities or derived context.

Implementation whitespace checks passed. Original reference-document formatting, command-output whitespace, and upstream font-license bytes were preserved. The complete original design package is under `docs/product`; duplicate root package files and its archive remain outside this change.

## Limits

The main workspace bundle still exceeds Vite's 500 kB warning threshold. Offline profile equivalence is not a judge or Marketplace installation test. Local validation did not deploy, alter authority policies, perform a Jira write, or retire the unresolved claim.

The [normal governed write](../2026-11-11-governed-write/README.md) has live success evidence. The [recovery record](../2026-11-11-recovery-test/README.md) still requires authority disposition of the original unbound grant and a fresh acceptance run through the corrected path. P0 and distribution acceptance remain open.
