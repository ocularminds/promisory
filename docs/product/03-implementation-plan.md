# Promisory · Implementation plan
**Version 1.0 · 10 November 2026**

## 1. Delivery objective

Ship one complete installed workflow: a product goal and initiative connect through a selected Confluence PRD to a project commitment and real Jira work; a changed bug exposes its impact and responsible people; Rovo explains the situation with Teamwork Graph context; a reviewed action follows a verified authority path; the resulting outcome is checked.

Use **Apps for Software Teams** as the primary Codegeist category because the expanded product centers on project, epic, work-item, and engineering-team delivery. Preserve the customer commitment use case as the business consequence.

The schedule assumes an experienced primary builder, access to the existing platforms, and a person available for product/policy reviews. It is a planning hypothesis. Capability checks in Phase 0 determine whether additional help or scope adjustment is required. Do not promise all roadmap features inside six weeks.

## 2. Scope and sequencing rules

1. Deliver all P0 features in the technical specification at the stated bounded scale.
2. Use one Jira project and connected Confluence in the main demonstration; support a second project for a meaningful access test.
3. Implement one real governed mutation: change a Jira work item's due date after the required review and authority checks.
4. Keep the original external promise unchanged unless its own revision workflow is explicitly completed.
5. Build Rovo and graph connectivity at the start. They are architectural dependencies, not decoration added before submission.
6. Add MCP only after the full workflow and judge installation are reliable.
7. Begin Marketplace preparation early; actual review duration is outside the team's control.
8. Preserve truthful capability labels. Simulated data is acceptable as clearly identified example data; simulated integrations do not establish bonus eligibility.

The expanded lifecycle remains bounded: all ten phases are represented, but the P0 demonstration uses one initiative, a small selected Confluence artifact set, stable PRD requirement references, and one versioned release-readiness gate. Automated template publication, portfolio optimization, external adoption analytics, and retirement automation follow after the core path works.

## 3. Schedule and acceptance gates

All dates are in Europe/Stockholm. The final competition deadline is **22 December 2026, 21:00 Stockholm time**. Set an internal submission cutoff at **12:00 on 22 December**. [Official rules](https://codegeist2026.devpost.com/rules)

| Phase | Dates | Work | Exit evidence |
|---|---|---|---|
| 0 · Prove integration contracts | Nov 10–12 | Register fresh app identities; validate Forge compatibility, Rovo action, graph query, native user permissions, Decionis evaluation, grant/claim execution path, and data egress boundary | Capability matrix, installed hello-world tools, tested auth path, recorded contract decisions |
| 1 · Establish the model and workspace | Nov 13–19 | Tenant storage, actual higher-level hierarchy, story/task/bug peers, Confluence artifact mapping, requirement references, commitment/owner flow, role views, design tokens | F01–F06/F08 exercised against a seeded Jira project; access tests pass |
| 2 · Detect and explain impact | Nov 20–26 | Versioned impact rules, deduplication, event handling, evidence freshness, work map, history, inbox, initial Rovo explanations | Real bug and PRD changes yield the correct initiative/requirement/commitment paths and stakeholder views |
| 3 · Close the action loop | Nov 27–Dec 3 | Recovery proposals, reviews, remote adapter, AgentSafe enforcement, result reconciliation, release-readiness gate, fulfillment verification, Confluence lifecycle card | One held action and one verified successful action with receipts; no duplicate write on replay |
| 4 · Pilot and prepare distribution | Dec 4–10 | Pilot usability, load/cost checks, privacy review, graph/agent evaluations, MCP tools if ready, listing materials | End-to-end pilot evidence; Marketplace candidate ready; target submission by Dec 8 if checks pass |
| 5 · Harden and package | Dec 11–17 | Fresh-tenant installation, judge clone, accessibility, hostile-input cases, uninstall/export, release notes, support instructions | Release candidate accepted; independent judge walkthrough works |
| 6 · Freeze and submit | Dec 18–21 | Fix release blockers, record video, verify links, complete Devpost text, preserve release evidence | Frozen release and complete submission package |
| Buffer / final check | Dec 22 before 12:00 | Recheck availability and submit if not already completed | Submission receipt and working install/video links |

“Marketplace candidate ready” and “Marketplace approved” are different milestones. Codegeist accepts a listing or a Marketplace review-ticket link for that bonus, subject to the rules and judges' review.

## 4. Phase 0 spike checklist

| Question | Required evidence | Decision if unresolved |
|---|---|---|
| Does the tenant support actual levels above Epic? | Imported configured parent metadata, plus a planning-link fallback case | Preserve native configuration; never create site hierarchy levels automatically |
| Can a PRD requirement be bound to a stable source version? | Two page revisions, a confirmed section mapping, and scoped access results | Use explicit mapping; unresolved sections cannot pass readiness |
| Can a fresh Forge app read the intended Jira/Confluence sources? | Two users with different permissions receive different authorized results | Fix the access model before building rollups |
| Can the chosen graph fields provide useful context? | Captured real query shape, scopes, pagination, and returned entity links | Select another supported real traversal; do not fabricate graph relationships |
| Can a Rovo action call the same domain service as the UI? | Installed agent tool output tied to a real commitment ID | Resolve invocation context and permissions early |
| Does the selected AgentSafe deployment enforce? | A denied request does not reach an instrumented test destination | Use a verified enforcement-capable release; shadow is insufficient |
| How is a grant claimed and finalized? | Version-pinned provider/SDK contract and replay/expiry results | Do not dispatch from the existing action-gate Boolean |
| Can the chosen Jira write check a source precondition atomically? | Endpoint-specific test of supported conditional update behavior | Document residual race exposure; do not claim race-free source invalidation |
| Is the remote action data allowed to leave Atlassian? | Data lineage allowlist and prohibited graph-egress test | Keep restricted content inside Forge and redesign that decision path |
| Can licensed Marketplace and judge builds be kept equivalent? | Build profile diff limited to app identity, licensing, and environment binding | Establish the split before listing submission |

No credentials, customer data, or raw OAuth tokens belong in spike evidence files. Record hashes, IDs where appropriate, sanitized results, and exact versions.

## 5. Work packages and dependencies

| Package | Depends on | Deliverables | Acceptance criteria |
|---|---|---|---|
| WP01 Repository and release profiles | Phase 0 | TypeScript workspace, lockfile, CI, Forge development/judge/marketplace profiles | Build repeatable; no reused Decionis app ID |
| WP02 Contracts and repositories | WP01 | Runtime schemas, single-aggregate concurrency, installation scope, migrations | Tenant collision and stale update rejected |
| WP03 Source adapters | WP02 | Jira import, actual hierarchy, links, current-value fetch, access filter | Tasks and bugs remain peers unless tenant metadata says otherwise |
| WP04 Commitment lifecycle | WP02/WP03 | Capture, owner acceptance, versioning, acceptance conditions | Incomplete/ambiguous candidate cannot activate |
| WP05 Graph and ownership | WP03/WP04 | Real graph context, team mapping, permission-aware cache | Missing graph results do not imply full coverage |
| WP13 Product lifecycle and requirements | WP03/WP04/WP05 | Planning nodes, ten phases, versioned artifact/requirement mappings, readiness contracts | Real higher levels or labelled fallback; material PRD change invalidates the applicable review |
| WP06 Impact engine | WP04/WP05/WP13 | Rule evaluation, typed paths, dedupe, incomplete-state handling | Shared blocker counted once per commitment; cycles terminate |
| WP07 Product UI | WP04/WP06 | Overview, issue panel, role views, detail, reviews, evidence | User can follow a path and understand the next action with keyboard alone |
| WP08 Reviews and execution | WP02/WP04/WP06 | Immutable intent, review applicability, verified remote/gateway adapter, reconciliation | Held, unauthorized, expired, replayed, or changed actions do not write |
| WP09 Rovo | WP04/WP05/WP06 | Agent prompt, shared tools, grounded replies, proposal creation | Agent cannot self-approve or select another tenant |
| WP10 Fulfillment and notifications | WP06/WP08 | Condition verifier, late outcome history, quiet inbox | Closed ticket alone does not verify a different agreed condition |
| WP11 MCP and Confluence | WP07/WP09 | Macro, optional rovo:mcp tools, connection documentation | Real supported modules work in the installed release |
| WP12 Distribution | All P0 packages | Listing dossier, judge app, video, instructions, release evidence | Fresh install reproduces the demonstration |

Use IDs F01–F35 from the specification in issues, acceptance records, and release evidence. An implementation ticket is complete when its behavior and evidence are present, not when a screen exists.

## 6. Proposed repository layout

~~~text
promisory/
  apps/
    forge/
      manifest.yml
      src/resolvers/
      src/events/
      src/rovo/
      src/schedules/
      static/workspace/
    remote/
      src/auth/
      src/execution/
      src/reconciliation/
  packages/
    domain/
    contracts/
    integrations-atlassian/
    integrations-decionis/
    design-system/
    test-fixtures/
  docs/
    product/
    architecture/
    decisions/
    runbooks/
    submission/
    evidence/
  scripts/
    build-release-profiles.*
    verify-release-equivalence.*
  AGENTS.md
  package.json
  pnpm-lock.yaml
~~~

The remote package is an adapter, not a second policy engine. AgentSafe remains an independently versioned gateway dependency. Avoid copying entire Steward or Decionis repositories into the app.

## 7. Test and verification plan

### Domain and integration tests

- Product lifecycle: no higher levels versus configured program/initiative parents; Confluence page organization differs from work hierarchy; source version drift; ready gate versus authorized action; release versus adoption.
- Actual hierarchy: story/task/bug peers, subtasks, custom type names, project moves, renamed issue keys, deleted sources.
- Graph: partial permissions, missing scopes, unsupported relation, pagination, stale results, team membership changes, cross-site ID collisions.
- Impact: duplicate edges, shared blockers, cycles, depth limits, overdue vs predicted risk, simultaneous known risk and unknown coverage.
- Commitments: missing owner, pending transfer, revised deadlines, acceptance changes, superseded versions, late fulfillment.
- Authority: wrong tenant/principal, forged review, stale intent, changed payload, missing/expired/reused grant, policy unavailable, shadow mode.
- Execution: target unavailable before send, timeout after send, duplicate retry, lost acknowledgment, failed finalization, reconciled success/failure.
- Rovo/MCP: prompt injection in source content, forged identity inputs, unsupported IDs, inaccessible evidence, proposed write without review.
- Privacy: graph-derived data rejected by remote serializer; no secret/source-body leakage in logs; filtered rollups and notifications.
- Lifecycle: disconnect, uninstall, reinstallation, license expiry, data export, deletion/retention jobs.

### Product verification

Use a real installed Forge app and a fresh test tenant. Record one manager and one restricted engineer journey. Exercise both UI and Rovo entry points against the same commitment. Check 390 px width, desktop, 200% zoom, keyboard navigation, accessible dialog behavior, and visible form errors.

Performance targets from the specification are hypotheses. Measure import duration, event lag, context query latency, graph coverage, request count, remote failures, and cost per active project. A screenshot or a mocked HTTP success is not proof that the external integration works.

### Release evidence folder

~~~text
docs/evidence/<release-id>/
  capability-matrix.md
  versions-and-build-hashes.json
  installation-walkthrough.md
  permission-test-results.md
  hierarchy-and-impact-results.md
  lifecycle-requirement-and-gate-results.md
  graph-query-evidence.json
  rovo-evaluation-results.md
  execution-and-reconciliation-results.md
  accessibility-results.md
  data-egress-review.md
  judge-marketplace-equivalence.md
  submission-links.md
~~~

Store only sanitized evidence. Actual record IDs may be useful in a private test tenant; credentials never are.

## 8. Marketplace and judging strategy

The competition's five core criteria—implementation, design, potential impact, innovation, and presentation—are equally weighted. Bonus tracks are additional award opportunities; adding modules does not automatically increase a core score. [Codegeist overview](https://codegeist2026.devpost.com/)

| Opportunity | Concrete implementation | Evidence to submit |
|---|---|---|
| Core implementation | Installed Forge workflow with real Jira data and an operational action loop | Fresh install and end-to-end video |
| Design | Role-relevant views, accessible controls, explicit unknowns and errors | Demonstrated task completion and UI walkthrough |
| Impact | Specific delivery team and measurable promise outcomes | Pilot observations with method and sample size |
| Innovation | Typed promise-to-work impact, exact review applicability, verified fulfillment | A before/after scenario ordinary status rollups cannot explain |
| Presentation | One understandable story with visible results | Public YouTube video under five minutes |
| Best Agents | rovo:agent with useful shared action tools | Agent answering from real data and creating a valid draft |
| Teamwork Graph | Supported context traversal materially used in the workflow | Real query, returned objects, source links, and visible consequence |
| Marketplace | Published listing or submitted listing | Actual listing/review-ticket URL |
| Atlassian MCP | rovo:mcp exposes the same safe tools | Tool discovered and invoked through the Atlassian integration |

The MCP bonus requires the Forge rovo:mcp path specified by the rules; a separate existing Decionis MCP server alone does not establish eligibility. [Official bonus requirements](https://codegeist2026.devpost.com/rules)

### Installation and licensing profiles

Choose Jira as required and Confluence as optional on the same site. The current required-app compatibility model supports paid Marketplace listings; free multi-app listings are not supported. Plan an evaluation/trial experience rather than advertising a permanent free multi-app listing. Validate actual billing terms before setting prices. [App compatibility](https://developer.atlassian.com/platform/forge/app-compatibility/)

Keep two registered app identities derived from one release:

1. **Marketplace app:** production identity, declared remote domains, licensing and listing configuration, real privacy/support materials.
2. **Judge app:** separate unlicensed identity, equivalent features and code, isolated test binding, and a shareable installation link.

Once a Forge app is listed/submitted or licensed, its installation-link sharing is unavailable; the documented path is an unlicensed copy. Verify equivalence by source/build hashes and a small allowed configuration diff. [Distribution rules](https://developer.atlassian.com/platform/forge/distribute-your-apps/)

The hybrid external authority path is not represented as “Runs on Atlassian.” Only use that badge if the actual manifest and behavior meet Atlassian's eligibility checks. Analytics labeling is not a workaround for business-data egress. [Badge requirements](https://developer.atlassian.com/platform/forge/runs-on-atlassian/)

### Marketplace preparation

Prepare the exact product description, supported scope, screenshots from the real app, app icon, privacy and data-handling statements, support and documentation URLs, license behavior, remote provider/subprocessor details, uninstall behavior, and reviewer instructions. Validate requested scopes and all currently required Marketplace fields.

Do not invent a listing link, approval status, certification, company endorsement, or support address. Use verified existing business details when the submission is actually prepared. [Forge listing guide](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/)

## 9. Demonstration story

Use fictional Northstar Retail and a “Merchant Launch” commitment.

| Time | Demonstration |
|---|---|
| 0:00–0:25 | Show product goal, initiative, Confluence PRD, and the measurable launch commitment |
| 0:25–1:00 | Trace initiative → epic → story/task; show a blocking bug, PRD requirement, and responsible team |
| 1:00–1:40 | Change the bug's delivery context; Promisory exposes the affected commitment and stakeholder views |
| 1:40–2:20 | Ask Rovo what changed; show a real Teamwork Graph-derived context link and the source evidence |
| 2:20–3:25 | Compare recovery, show one held action, then an authorized exact action and its read-back result |
| 3:25–4:00 | Show readiness/source applicability, verify delivery evidence, and keep adoption measurement separate |
| 4:00–4:30 | Show installation availability and actual bonus artifacts; close with a measured pilot observation if available |

Use the real app for the submission video. This package's design prototype is not the submission demo. Do not publish a made-up ROI figure; if no pilot result exists, clearly state the test outcome and the proposed measure.

## 10. Adoption and commercial plan

Begin with one delivery team and a bounded project. Installation must explain the data scope and show useful findings before asking users to configure every stakeholder relationship. Avoid requiring a separate Decionis account for basic context exploration; the commercial/authority connection becomes relevant when the customer enables that capability.

Recruit three design-partner teams with different perspectives: engineering delivery, product operations, and customer success. Recruitment and external messages require explicit authorization when performed; this document does not send them.

Measure activation as a confirmed commitment plus a viewed evidence-linked finding. Measure engagement by team-level weekly use, accepted findings, and completed review/verification loops. Collect why a finding was dismissed to improve rules. Measure costs per active project before choosing the paid plan structure. Avoid seat-price or savings claims before validation.

## 11. Risks, contingencies, and cut order

| Risk | Mitigation |
|---|---|
| Graph coverage or scopes differ from examples | Phase 0 schema inspection; supported queries; visible incomplete state |
| External execution adapter is more work than expected | Prove one allowlisted action first; defer additional mutation types |
| Current hosted gateway cannot enforce | Use a verified enforcement-capable deployment; do not label shadow as protected |
| Source API lacks atomic conditional writes | Narrow operation semantics, fresh review/read-back, reconciliation, explicit residual-risk documentation |
| Marketplace review outlasts the schedule | Submit early and retain the review-ticket evidence |
| Multi-app licensing changes install behavior | Independent judge identity and reproducible release profiles |
| Rovo answers are plausible but incorrect | Shared domain tools, citations, abstention cases, and evaluation fixtures |
| Scope grows toward portfolio planning or HR analytics | Defer forecasting, capacity optimization, broad CRM connectors, and individual analytics |

Cut P2 first. Then defer P1 external messaging, advanced portfolios, and optional MCP if necessary. Do not cut access checks, source freshness, review applicability, truthful live/demo labeling, installation reliability, or evidence for a claimed core integration.

## 12. Final release checklist

- All P0 acceptance outcomes are met or the scope/claims are explicitly revised before submission.
- Fresh installation works with documented capabilities and isolated credentials.
- The lifecycle/Confluence, requirement, hierarchy, stakeholder, Rovo, graph, governed action, and verification story is reproducible.
- Marketplace and judge builds have matching source behavior.
- Video is public, under five minutes, understandable, and consistent with the installed app.
- Listing or review-ticket link, installation link, and all required materials are verified.
- Production/public publishing is performed only with the owner's authorization; prepare the complete reviewable candidate before requesting any missing final approval.

