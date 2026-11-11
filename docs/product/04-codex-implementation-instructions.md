# Promisory · Codex implementation instructions
**Version 1.0 · 10 November 2026**

This is a handoff for implementation in a dedicated Promisory repository. The current package contains specifications and a design prototype, not a deployed product. Use the included [bootstrap prompt](templates/implementation-prompt.md) and [AGENTS.md template](templates/AGENTS.md) when starting the implementation chat.

## 1. Mission

Build Promisory as an installable Forge app that connects commitments to project work, accountable people, and verifiable outcomes. Implement the bounded P0 release in the technical specification and complete the phase acceptance gates in the plan.

Represent the complete product lifecycle, including Confluence strategy/discovery/PRD/release/learning artifacts and initiative context above epics. Use the real configured Jira hierarchy: optional higher work levels → epic → story/task/bug → subtask, with project as a container. Represent a bug blocking a task through an explicit dependency relationship. Never create a false parent relationship to match a diagram.

Rovo must use the same tested domain tools as the UI. Teamwork Graph must supply real, permission-filtered context. Decionis owns institutional execution authority; AgentSafe enforces the configured external action boundary. Promisory owns delivery diagnostics, user experience, and commitment records.

## 2. Read before editing

Read in this order:

1. The user's current instructions and all applicable repository AGENTS.md files.
2. docs/product/01-technical-specification.md.
3. docs/product/02-brand-and-ux-system.md and the packaged assets/tokens.
4. docs/product/03-implementation-plan.md.
5. docs/product/05-sources-and-decisions.md.
6. docs/product/06-product-lifecycle-and-traceability.md.
7. Relevant live code and contracts in Decionis, AgentSafe, and Steward.

Copy the package into docs/product as an initial reference, preserving links and supporting folders or updating them consistently. Keep an architecture decision log for choices that depart from the specification. Recheck official Atlassian documentation before implementing Preview modules, scopes, installation behavior, or remote authentication.

Do not reinterpret a design proposal or example schema as an existing platform API. Confirm the actual contract and write an adapter.

## 3. First implementation turn

Complete useful work before requesting nonessential preferences.

- Inspect the repository, branch status, local changes, and applicable instructions.
- Inventory the Forge CLI/runtime, authenticated developer access, relevant installed app capabilities, and existing SDK/gateway versions without printing secrets.
- Create a concise capability matrix covering Jira access, Confluence connection, graph queries, Rovo actions, user-context remote calls, Decionis evaluation, grant execution, and distribution.
- Establish the workspace, typed contracts, source adapters, and CI skeleton in a scoped branch.
- Run the Phase 0 integration checks. Record unavailable prerequisites truthfully and continue independent implementation work.
- Do not register or publish to the user's existing Decionis app identity by copying its manifest ID.

If credentials or an external decision are genuinely necessary, identify the exact missing item and which test depends on it. Do not repeatedly ask for authority already supplied in the session.

## 4. Architecture rules

### Keep authority boundaries explicit

The impact engine can say why delivery appears at risk. It cannot issue institutional permission. Rovo can explain, retrieve, and draft; it cannot override the impact rules or approve its own operation.

Use one shared prepare/review/execute service for the controlled mutation. UI and agent entry points must not grow separate execution paths.

The reviewed Decionis Forge action-gate response does not contain an execution grant. Never implement “if continue_execution then requestJira.” Integrate the supported bound-grant/claim/finalization path through AgentSafe and test it.

If the selected gateway is shadow-only, show “Assessment only.” Do not forward a consequential action and label it blocked, governed, or protected.

### Handle identity and tenant scope on the server

Derive app, environment, installation, cloud, and principal from trusted Forge context. Validate remote FITs against trusted configured identity and key sources. Bind the authenticated installation to its Decionis organization in server-controlled configuration.

Never accept an effective accountId, organization ID, approver role, API destination, or execution mode from a model/browser input as authority. A model-supplied ID is a lookup candidate, not a permission grant.

Use the native user's authorized API context for the supported write. A missing/expired user token is a reason to obtain a fresh authorized invocation, not to use a broader app token. Never persist OAuth tokens in a retry queue.

### Preserve data boundaries

Keep Teamwork Graph results and derived context inside Atlassian. Validate every field at the remote serializer against provenance and the explicit data-sharing contract. Do not relabel graph data as ordinary metadata to export it.

Use per-principal permission-aware views. Background app events may carry context unavailable to a viewer; do not expose it through cached rollups, notifications, or agent answers.

Secrets stay in a secret API/manager. Runtime config endpoints return flags such as “configured,” never key values. Avoid copying the old starter's configuration resolver.

### Model the lifecycle without inventing platform semantics

Use the lifecycle supplement as the contract for ten phases, planning nodes, artifact roles, requirement references, and readiness. Import native above-epic work levels if configured. Otherwise connect Confluence/Promisory initiatives through explicit planning relationships. Never modify the customer's site-wide work hierarchy to satisfy the design.

Keep stories, tasks, and bugs as peers under the normal Epic level. A story can have real subtasks or an implementation link to a separate task. Confluence page parents, release versions, sprints, goals, and idea references do not become Jira parents.

Bind requirements to source IDs, revisions, section mappings, and content fingerprints. A changed required version must invalidate current gate/review applicability. A Confluence document status is not a built-in policy approval; a ready lifecycle gate is not permission to execute.

P0 maps existing pages and demonstrates one release-readiness gate. Prepare template publication as a later explicit command; do not create a Confluence space tree during onboarding without the user's authorization.

### Preserve truthful state

A review, authority decision, write attempt, external receipt, and verified outcome are separate records. No success toast before the relevant stage has succeeded.

Do not convert UNKNOWN to ON_TRACK. Do not mark fulfillment from Jira status unless that status is the exact agreed acceptance condition. Do not hide a breached original deadline behind a later revised date.

## 5. Contracts and command surface

Implement runtime-validated commands rather than allowing arbitrary field mutation. Suggested internal resolver names:

| Command | Required behavior |
|---|---|
| lifecycle.mapArtifact | Confirm page/version, artifact role, phase, scope, and owner |
| requirement.linkWork | Confirm stable requirement mapping and typed work relationships |
| lifecycle.assessReadiness | Evaluate versioned artifact and evidence conditions without granting execution authority |
| lifecycle.reviewGate | Record a designated review against exact versions; preserve stale historic reviews |
| commitment.createDraft | Validate scope and candidate fields; no external effect |
| commitment.confirm | Require complete fields and owner acceptance; create an immutable active version |
| commitment.proposeRevision | Preserve existing agreement and prepare a new version for review |
| commitment.transferOwner | Record incoming-owner acceptance separately |
| impact.trace | Return typed paths, reasons, limits, and visibility coverage |
| evidence.refresh | Refetch permitted sources and update freshness |
| proposal.prepare | Freeze exact effect, expected versions, recipients if any, and evidence references |
| review.record | Check review role and exact proposal applicability |
| action.apply | Recheck current source/permissions; use verified authority and executor |
| action.reconcile | Resolve uncertain external results before another attempt |
| outcome.verify | Evaluate versioned acceptance conditions and any required human acceptance |

These names describe proposed Promisory services; they are not claimed to be existing Atlassian endpoints. Adapt them to the actual Forge resolver mechanism without changing their semantics.

Use the proposed types in contracts/domain-contracts.ts as a starting point. Add runtime schemas, parsers, repository codecs, and version migration tests. Validate bounded lengths, permitted enums, stable identifiers, date/time behavior, and unknown fields.

### Mutation behavior

Require an idempotency key and an immutable action intent. Canonicalize the exact request before hashing; version the canonicalization method. Do not include secret/token values in logs or the public digest material.

Use conditional updates if the target endpoint supports them. If a native Jira change can race the app between precheck and write, document that limitation and design narrow set-field semantics with read-back/conflict handling. Do not claim a global lock across native Jira activity.

A timeout after dispatch becomes RECONCILING. Query the target/receipt using the operation identity before deciding whether a retry is safe. Finalize claims according to the actual provider contract; do not leave permanent claimed grants after successful or failed attempts.

## 6. Implementation slices

### Slice A · A useful installed shell

Deliver a real Forge workspace, project selection, a truthful connection screen, actual work-type discovery, and a deterministic example-data mode. Prove installation and user-context access before building a large dashboard.

### Slice B · Commitments and people

Implement planning/initiative context, ten lifecycle phases, selected Confluence artifacts and stable PRD references, creation/confirmation, exact deadlines and time zones, owner acceptance, stakeholder bindings, linked work, and the issue panel. Use the packaged design tokens and accessible controls.

### Slice C · Impact in both directions

Implement typed graph traversal and current-value rule evaluation. A bug can reveal its affected commitments; a commitment can reveal its blockers. Include initiative/requirement context, story/task/bug links, shared dependencies, missing access, cycles, stale evidence, requirement drift, and ownership gaps.

### Slice D · Review and verified execution

Implement one real due-date action through the supported remote and AgentSafe path. Demonstrate held, denied, expired, duplicate, success, and uncertain-result cases. Keep promise renegotiation separate from Jira date mutation. Add versioned release-readiness conditions without making gate acceptance an execution grant.

### Slice E · Rovo and graph

Connect the already-proven graph and Rovo primitives to the complete domain flow. Add grounded answers and internal proposal creation. Measure tool correctness, permission behavior, and abstention cases.

### Slice F · Fulfillment and distribution

Verify acceptance evidence, show late/regressed outcomes, complete notifications, Confluence, installation/lifecycle behavior, and the Marketplace/judge release split. Add safe MCP tools only after core acceptance passes.

At each slice, update the feature-to-evidence matrix. Do not advance a slice based only on mocked services if the slice's purpose is a live integration.

## 7. Design implementation rules

Use the real SVG identity and local fonts, preserve font licenses, and implement semantic tokens rather than hardcoded colors scattered through components. Keep Atlassian chrome and native component behavior intact.

The UX prototype illustrates layouts and interactions. Its local state, example values, and sample Rovo response must not become production evidence, business rules, credentials, or hidden API substitutes.

Required user states include loading, empty, partial access, unavailable connection, stale source, invalid form, pending review, held action, reconciling action, verified result, and no matching search results.

Keyboard, focus restoration, meaningful accessible names, visible error summaries, status text, reduced motion, and responsive layout are part of completion. Do not add fake buttons or links that merely look interactive.

## 8. Verification discipline

Add tests where they prove meaningful behavior, especially access boundaries, hierarchy semantics, impact rules, version applicability, and execution recovery. Do not spend the schedule on tests that merely mirror rendering code.

Run the relevant checks after each slice. At release, complete the acceptance suite from the plan, including an installed-tenant walkthrough. Record commands, versions, sanitized results, and remaining concerns.

Keep fixture, adapter-contract, and live-tenant evidence separate. Use names that reveal the mode. Never silently fall back to fixtures when live calls fail.

Use static checking and a build to validate contracts. Use browser interaction checks for forms, filters, role views, graph alternatives, and review flows. Inspect screenshots at desktop and narrow widths; use screenshots to verify visual layout, not to substitute for behavioral checks.

## 9. Working style and change control

Proceed autonomously with reversible implementation, local validation, and routine fixes within the authorized task. Preserve unrelated local edits and staging. Keep upstream integration changes minimal and separately reviewable.

Use the configured runtime and repository conventions. Do not change models, create additional chats, configure automations, or spawn agents unless the user or applicable instructions authorize it.

Prepare complete release and submission artifacts before asking for any missing final authorization. Production deployment, public Marketplace/Devpost publication, videos, customer messages, and paid infrastructure follow the user's actual session authorization; this document alone does not authorize them.

If a required platform capability is unavailable, state what failed, what is still possible, and which claims or phases depend on the missing capability. Continue independent work. Do not fabricate a successful external result.

## 10. Completion report

The final implementation report must state:

- Which P0 features are complete, with relevant source and evidence links.
- Which app/version was installed and which integrations were tested live.
- The real hierarchy and permission behavior.
- Which mutations are actually enforced and any residual concurrency limits.
- What Rovo and Teamwork Graph do in the working release.
- Marketplace status and judge installation status, with real URLs if available.
- Tests performed, failures resolved, and remaining limitations.
- The exact next action, only if something genuinely remains.

Do not mark the overall product complete while required live capabilities are simulated, installation is unverified, or a claimed governed write can bypass the configured authority path.

## 11. Ready-to-use bootstrap prompt

The standalone file templates/implementation-prompt.md contains the prompt for the next Codex implementation chat. It references this package and instructs the agent to begin with the integration checks and the first useful vertical slice. The AGENTS.md template can be placed in the new Promisory repository after checking it against the user's existing repository instructions.

