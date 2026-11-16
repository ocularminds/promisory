# Phase 4 local evidence · 16 November 2026

Mode: **local contract and fixture tests only**. No identity was registered and nothing was deployed, listed or shared.

| Area | Evidence |
|---|---|
| Retention | `tests/domain/retention.test.ts`: active and unresolved records kept; clock starts at closure or verification; only expired records deleted; stale-revision delete refused |
| Guarded SQL delete | `tests/contracts/forge-storage.test.ts`: exact parameterized `DELETE … AND revision = ?`; zero affected rows is `CONFLICT` |
| Personal data | Account collection excludes system principals; closed-account pseudonymization across commitments, project and config; inbox deletion; schema still valid; other people untouched |
| Export | Access-filtered; restricted commitments omitted; no graph context; non-administrator refused |
| Suite | `npm run check`: **180 tests in 29 files**, builds, manifest, Forge bundle, release equivalence. `forge lint`: no errors; one expected `MAJOR_VERSION_RULE` approval |

## Live acceptance still required
- Run the scheduled triggers through `forge webtrigger` or by waiting, and record `{changed, deleted}` and `{reported, closed}` with sanitized counts only.
- Run an administrator export on the test site and confirm a restricted second project's commitments are absent.
- Uninstall a disposable installation and record which Forge data the platform removes.
