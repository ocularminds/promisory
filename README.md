# Promisory

**Keep every commitment connected.**

Promisory connects accepted commitments to Jira work, accountable people, Confluence requirements, and verifiable outcomes. Its Forge workspace and Rovo tools share permission-aware services. Jira hierarchy, delivery health, human review, execution authority, and fulfillment remain separate.

## Current status

This is a P0 implementation candidate. Development version **3.6.0** is installed on the dedicated Jira/Confluence test site, and the scoped test executor runs in ENFORCEMENT. Independent review, restricted-source checks, a held action, and the normal governed Jira due-date change have live evidence.

**P0 release acceptance remains open.** The lost-acknowledgement test verified Jira's change after a restart, but its original authority grant lacks the effect commitment required for reconciliation. The corrected grant and recovery paths are deployed; they cannot repair that immutable grant. See the [operator review](docs/authority/recovery-operator-review.md). Broader live acceptance and fresh judge/Marketplace profile installations are also pending.

The [implementation report](docs/implementation-report.md) distinguishes local tests, live observations, and remaining acceptance gates. Earlier evidence records describe the versions observed at their recorded times.

## Run locally

Use **Node 22.23.4** and **npm 10.9.9**.

```sh
npm ci
npm run check
npm run dev -- --port 4173
```

Open [the example workspace](http://127.0.0.1:4173/?mode=example). Example data and sample replies are visibly labelled; this mode performs no governed external writes.

For browser checks:

```sh
npx playwright install chromium
npm run test:e2e
```

`npm run check` validates types, domain and integration contracts, UI and remote builds, the Forge manifest and bundle, and offline release-profile equivalence. Live tenant acceptance is a separate procedure. CI runs these checks and the fixture browser suite; it does not deploy.

## Repository guide

- `apps/forge`: Jira workspace and issue panel, Confluence macro, Rovo actions, and trusted Forge entry points.
- `apps/remote`: the single allowlisted Jira due-date executor, authenticated invocation boundary, durable operation journal, and encrypted claim storage.
- `packages`: versioned contracts, domain/lifecycle services, Atlassian and Decionis adapters, design tokens, licensed fonts, and fictional fixtures.
- `tests`: domain, permission, authority, recovery, and browser checks.
- `scripts` and `infra/azure`: release tooling, bounded evidence collectors, and the reviewed test-deployment procedure.

## Documentation

- [Development and installation](docs/runbooks/development-and-installation.md)
- [Live acceptance procedure](docs/runbooks/live-acceptance.md)
- [Architecture decisions](docs/decisions)
- [Governed-write evidence](docs/evidence/2026-11-11-governed-write/README.md)
- [Recovery evidence and limitations](docs/evidence/2026-11-11-recovery-test/README.md)
- [Draft release and submission dossier](docs/submission/release-dossier.md)
- [Original product specification and design package](docs/product/README.md), including the lifecycle supplement, reference prototype, brand assets, and font licenses.
