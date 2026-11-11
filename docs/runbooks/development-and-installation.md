# Development and installation

This candidate has a fresh Promisory identity, Forge version 3.4.0 deployed and installed in development, and an installation connected to Jira and Confluence on `decionis-promisory.atlassian.net`. Use the supplied package for product context and [the implementation report](../implementation-report.md) for the actual implemented scope.

## Run locally

From the repository root, use Node 22.23.4 and npm 10.9.9. With the existing fnm installation:

```sh
fnm exec --using=22.23.4 npm ci
fnm exec --using=22.23.4 npm run check
fnm exec --using=22.23.4 npm run remote:build
fnm exec --using=22.23.4 npm run dev -- --port 4173 --strictPort
```

Open `http://127.0.0.1:4173/?mode=example`. The banner identifies fictional data, a fixed clock and held external actions. Example state is in memory and resets on reload. It is never used as a fallback for a failed live resolver. `surface=issue` and `surface=page` are explicitly fictional embedded-view previews.

For browser checks, `npm run test:e2e` uses Playwright's pinned Chromium after `npx playwright install chromium`. On this Mac the CDN download failed with a TLS connection reset; the verified local alternative is:

```sh
PROMISORY_BROWSER_CHANNEL=chrome fnm exec --using=22.23.4 npm run test:e2e
```

`npm run manifest:check` performs offline schema/resource validation and checks that the compiled executor matches the declared remote capability. `npm run forge:bundle` uses Forge CLI's installed backend bundler and Atlassian runtime-wrapper CDN without deploying. Set `PROMISORY_EVIDENCE_DIR` to a new evidence directory for a later verification run. `npm run phase0` records versions, CLI-authentication status and prerequisite presence without printing credentials. `npm run forge:lint` additionally checks the registered app with Atlassian.

## Register and install a fresh development app

For this candidate, registration and installation are complete in the Decionis developer space and test site recorded in [live evidence](../evidence/2026-11-10-live-test-site/README.md). Do not register or reinstall it again for routine code updates. Both test accounts have authenticated Jira/Confluence access; the second has owner-authorized Viewer contributor access to this private development app. Source-ACL revocation has been verified through native Confluence, app views/history/counts and real Rovo abstention. Independent gate/action review, PRD drift/remapping and designated outcome acceptance/revocation have also passed in the test site. Remaining cases are recorded in the ledger. The following fresh-registration procedure also applies to future separately authorized judge/Marketplace identities.

To obtain a test site, Atlassian supports `forge site provision`, which provisions or returns the developer's active demo site with seeded data and normally a 90-day lifetime. The attempt in this session failed. The supported fallback is the [Cloud Developer Bundle](https://go.atlassian.com/cloud-dev), using the same account as the Forge CLI. Its standard Jira/Confluence development sites have five-user limits. Complete any required agreement acceptance through the owner's authorization; never count a prepared signup as a created site.

1. In `apps/forge`, run the pinned CLI's `forge register Promisory --developer-space-id <selected-space-id>`. Complete its registration/terms prompts. Preserve the newly returned Promisory app ARI in this manifest. Do not paste an app ID from a sibling repository.
2. From the root, run `npm run manifest:configure` to retain the registered development identity with the shared manifest and executor build. Remote execution can stay unavailable while UI, source access, SQL and Rovo are tested. With no remote declaration, the executable build contains only the held executor. The optional implementation is included in compilation and Forge lint only after a real HTTPS origin is configured.
3. Run `npm run check`, `npm run forge:bundle`, and `npm run forge:lint` with Node 22.23.4.
4. In `apps/forge`, run `forge deploy --environment development`, then `forge install --environment development`. Choose the explicitly selected test site/Jira installation in the CLI. Verify current required-Jira/optional-Confluence compatibility and connect Confluence on the same site using Atlassian's supported connection flow. Do not assume separate cloud IDs from display names.
5. Verify the installation migration completed, open Jira → Apps → Promisory, and have a site admin select the pilot project in Connections. The app creates no Jira work, project hierarchy or Confluence space tree during onboarding.
6. Exercise native work discovery and page access with both users before entering real commitments. Map only existing pages whose versions/sections can be verified. Create the initial agreement through the owner's explicit acceptance.
7. Open the issue panel and Confluence macro from real sources. Enable the installed Promisory Rovo agent and run [live acceptance](live-acceptance.md). Record actual app version, environment, permitted source IDs and observed outcomes.

For this candidate, registration, manifest configuration, local checks, Forge lint, development deployment, installation, SQL migration and project-scope configuration have succeeded. Continue the remaining step 6–7 cases in the live acceptance ledger; recorded observations identify which paths have passed. Production deployment and public release remain separate owner actions.

## Enable the remote for a test installation

The included server supports one installation per process on one durable host. Build it with `npm run remote:build`; run `node apps/remote/dist/server.js` in an environment populated through the host secret manager. It defaults to loopback port 8787; the deployed container explicitly sets `PROMISORY_LISTEN_HOST=0.0.0.0` behind the existing HTTPS ingress. `/healthz` returns only process liveness. The [isolated Azure deployment](../../infra/azure/README.md) is running at `https://promisory-test.decionis.com`; image, private 4 GiB disk, TLS, request refusal and persistence across restart have passed real checks.

Use [the environment template](../../apps/remote/.env.example). Required server-controlled values are the newly registered app ARI, trusted environment/installation IDs, cloud UUID, Decionis organization UUID, explicit `PROMISORY_AUTHORITY_POLICY_ID`, authority HTTPS origin, authority credential, independent HMAC and 256-bit claim-encryption keys, and an absolute durable state directory. Obtain identity formats from a verified installed invocation; do not infer them from URL fragments or copy them from example records. Keep the state volume private and backed up with key access separately controlled. Multiple replicas require a shared atomic journal/vault implementation.

The administrator-only Connections → Execution setup identifiers disclosure provides those four non-secret Forge/cloud values from the authenticated invocation. The actual development binding, published DCI policy and verified credential scopes are in [the DCI setup](../authority/README.md). Pin the server policy selector to verified v3 revision `457e04a4-0a1d-4f18-8bca-7a9a5df2adc8`; it is captured before the SDK intent hash and cannot be supplied by the caller. The unbound execution key must not use the workspace default. The approved effect passed 18 live shadow cases after the faulty v2 was retired. The paid deployment and shared observer rollout are now authorized and complete. The separate DCI gateway remains SHADOW/PASSTHROUGH; the configured Promisory boundary is its own narrow executor.

Verify the actual FIT claim shape and module key for function-to-remote calls against the declared allowlist. The current adapter expects `promisory-resolver` and the commercial-cloud Jira API base URL. Missing current-user OAuth, incorrect audience, cloud, environment, installation, principal, destination or module is rejected. Isolated-cloud identities are deliberately unsupported until their key/destination binding is implemented and tested.

The Forge side needs these variables in the same environment:

| Variable                             | Purpose                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `PROMISORY_REMOTE_SIGNING_KEY`       | Encrypted secret, matching the remote's HMAC key                                                  |
| `PROMISORY_REMOTE_ENABLED`           | Explicit `true` only for the configured test remote                                               |
| `PROMISORY_SHARE_DUE_DATE_INTENT`    | Explicit data-handling consent for independently authored action intent                           |
| `PROMISORY_SHARE_JIRA_DATE_SNAPSHOT` | Explicit consent for the narrow REST date snapshot                                                |
| `PROMISORY_LICENSED_PROFILE`         | `false` for development/judge, `true` for Marketplace; required for production-profile app writes |

Use `forge variables set --encrypt --environment development` and the CLI prompts for the signing secret, keeping it out of shell history and source files. The host uses its own secret manager. Public configuration never returns secret values. After variable changes, redeploy the intended environment as required by Forge.

Run `npm run manifest:configure -- https://<owned-executor-origin>` after the HTTPS origin exists; the shared generator adds the function-to-remote declaration and current-user-token scope. Rebuild, lint and upgrade the test installation for the changed scope. `--no-remote` explicitly removes that development declaration if desired.

For a new deployment, keep mode SHADOW, verification false and both sharing flags false until the corresponding prerequisites are met. In this approved test deployment, the user requested enforcement: mode is now ENFORCEMENT and narrow intent/REST sharing is enabled. Verification is now true after the real 3.3.0 FIT/hosted-context/current-user check and guarded hold release. Three earlier authority denial cases passed with synthetic inputs and an inert handler. The [independently reviewed 12-to-18 November action](../evidence/2026-11-11-governed-write/README.md) now proves successful live grant/claim/write/read-back/finalization. Lost-response recovery remains an open acceptance case. Do not remove the verification hold merely to change the displayed mode. The initial manifest renderer will reset these live mode/sharing overrides if its ConfigMap is reapplied.

Production Decionis reconciliation requires the authenticated reporter to be registered as a trusted effect observer. The approved test credential is now registered and the shared API rollout passed; live reconciliation still requires a real claimed operation. Keep `PENDING` finalization visible if observer provenance or receipt acknowledgement is unavailable. Reconcile using a fresh invocation by the original authorized user; do not retry with stored OAuth or an app token.

### Verify the current-user executor connection

The Connections page includes an explicit **Check connections** control. This read-only command checks the signed Forge invocation, exact installation/module and the active Jira account behind the current user token. It accepts no action or issue payload and never requests authority, claims a grant or changes Jira. A successful check can still report that execution is held. [Connection-check design](../decisions/0011-read-only-executor-connection-check.md), [test and deployment evidence](../evidence/2026-11-11-connection-check/README.md).

Run it from the installed app under the intended native user, then inspect the runtime-validated `PROMISORY_REMOTE_CONNECTION_CHECK` event in Forge or the owned test executor logs. Version 3.2 adds a strict diagnostic with the failing stage when verification does not succeed. Match the request context, current app version/module, time and mode/hold flags to the deployment. Never export FITs, OAuth tokens or profile content for troubleshooting. Do not set the verification flag based on a configured label, a local synthetic test or a user-reported message alone. The explicit check supplies connection evidence; an operator must still verify the running image/binding and preserve the normal proposal/review/grant requirements.

## Prepare judge and Marketplace profiles

Register separate fresh Promisory identities when the owner is ready for the release process. Copy [profiles.example.json](../release/profiles.example.json) to the ignored `release-identities.local.json` and replace nulls with those real app ARIs. Add `remoteUrl` HTTPS origins to all three profiles or to none; capabilities must be equivalent. Do not use synthetic test UUIDs.

First configure the development build for the same executor capability as all three intended profiles, then build the candidate. Profile packaging checks this binding before copying the identical source files:

```sh
npm run release:profiles -- release-identities.local.json
npm run release:check
```

The generator writes `release/development`, `release/judge` and `release/marketplace` with the same source bytes and individual manifests. It refuses to overwrite an existing candidate. It does not register, deploy, install or publish. Use `npm ci` inside a generated profile before its build/deploy steps, and set the profile's declared Forge licensing variable. Keep remote bindings and secrets isolated by profile.

Verify the actual judge sharing link and fresh installation. Marketplace submission may disable sharing for that identity, which is why the judge identity stays separate. Check current multi-app eligibility before advertising free or trial terms. Complete privacy, support, retention, security and reviewer fields in [the release dossier](../submission/release-dossier.md) before requesting public-release authorization.
