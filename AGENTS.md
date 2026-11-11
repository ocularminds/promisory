# Promisory repository instructions

## Product references

Read docs/product/01-technical-specification.md, 02-brand-and-ux-system.md, 03-implementation-plan.md, 04-codex-implementation-instructions.md, and 05-sources-and-decisions.md. The user's current instructions take priority. Record architecture changes in docs/decisions.

## Required invariants

- Preserve actual Jira hierarchy. Tasks and bugs are standard peers unless tenant configuration proves otherwise.
- One accepted accountable owner per active commitment; scoped contributors and observers are separate.
- Keep commitment lifecycle, delivery health, review, execution authority, and fulfillment distinct.
- Use trusted installation/cloud/principal context for all access.
- Revalidate source access before views, answers, exports, and writes.
- Keep Teamwork Graph data and derivatives within Atlassian; enforce explicit provenance at any external serializer.
- Rovo retrieves, explains, and drafts through shared services; it never self-approves or selects weaker policy.
- Decionis owns institutional permission. AgentSafe owns the configured request boundary.
- An action-gate evaluation Boolean or a signed dossier is not a substitute for the supported execution grant.
- One allowlisted executor path; no arbitrary URLs, payloads, recipients, or identity overrides from the UI/model.
- Unknown, stale, held, shadow, and reconciling states remain explicit.
- A timed-out external write is reconciled before retry.
- A closed work item is not automatically a fulfilled commitment.
- Original deadlines and historic breaches survive revisions.
- No individual productivity ranking, inferred reporting lines, or title-based approval authority.
- Demo data and sample agent replies must be visibly marked and never silently substitute for live data.

## Engineering and design

Use TypeScript and versioned runtime-validated contracts. Follow the repository's existing toolchain and lockfile. Keep new dependencies purposeful. Use the packaged semantic tokens and accessible controls. Preserve local font licenses.

Use stable external IDs plus cloud scope; issue keys are display values. Implement bounded traversal, pagination, deduplication, optimistic concurrency, and recoverable operation states. Confirm current Forge SQL capabilities rather than assuming multi-statement transactions.

Tests must prove meaningful domain, permission, authority, and recovery behavior. Check live integrations in a test tenant before claiming them. Preserve sanitized evidence in docs/evidence/<release-id>.

## Scope and delivery

Implement P0 before P1/P2. Keep remote adapters narrow and upstream changes separately reviewable. Preserve unrelated user edits.

Do not create other chats, automations, or subagents unless authorized by the user or applicable instructions. Public publishing, production changes, external messages, and paid resources follow actual session authorization.

Before declaring completion, verify installation, the real Rovo/graph workflow, a held and successful governed action, outcome verification, and the Marketplace/judge release profiles.


Include the complete lifecycle supplement: product goals and initiatives, Confluence discovery/PRD/release/learning artifacts, actual configured levels above epics, story/task/bug peers, stable requirement versions, and separate readiness gates. Never treat page organization or planning links as native Jira parents.
