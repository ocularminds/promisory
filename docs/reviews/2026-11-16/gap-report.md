# Promisory · Specification-to-implementation gap report

**16 November 2026 · branch `codex/promisory-p0` at `f65ce16` · Forge development 3.6.0**
**Days to Codegeist deadline (22 Dec 2026, 21:00 Stockholm): 36. Internal cutoff: 22 Dec 12:00.**

Sources compared: `docs/product/01`–`06`, `docs/implementation-report.md`, `docs/submission/**`, `apps/forge/manifest.yml`, and the code under `apps/` and `packages/`. The status labels below come from reading the code and the recorded evidence. The live tenant was **not** re-exercised for this review.

Legend: **BLOCKER** prevents a valid or credible submission · **HIGH** materially weakens a judged criterion or bonus · **MEDIUM** is a spec deviation to fix or disclose · **LOW** is hygiene.

---

## 1. Executive summary

The engineering core is unusually strong for a hackathon. It has a typed commitment model, separate lifecycle, health, readiness, execution and fulfillment states, a real governed Jira write with grant claim, read-back and finalization, versioned requirement drift, and 139 tests. The weak points are **everything a judge touches first**: there is no installation link, no video, no Marketplace artifact, and right now no working governed action. **The product story also lacks business outcomes.** It explains why the model is correct, not what a customer gains.

| # | Gap | Severity | Criterion / bonus at risk |
|---|---|---|---|
| G1 | No judge app identity or installation link (`docs/release/profiles.example.json` is all `null`) | BLOCKER | Submission validity |
| G2 | No public demo video (< 5 min) | BLOCKER | Submission validity, Presentation |
| G3 | Both approved DCI policies **expired 2026-11-12T00:00Z** and pin exact dates (`^2026-11-12$` → `^2026-11-18$`) | BLOCKER for the demo | Implementation, Innovation |
| G4 | Teamwork Graph use is one query (`Promisory_AssignedWork`) plus an `echo` probe | HIGH | Teamwork Graph bonus, Implementation |
| G5 | Jira/Confluence events only store a marker. No recompute, finding or inbox notice | HIGH | Workflow C, "earlier intervention" outcome |
| G6 | No Marketplace listing or review ticket; `licensing.enabled: false`; vendor/support URLs open | HIGH | Marketplace bonus |
| G7 | No `rovo:mcp` module (F19) | HIGH (cheap win) | Atlassian MCP bonus |
| G8 | No business-outcome instrumentation or pilot data | HIGH | Potential impact |
| G9 | Rovo extraction cannot read Confluence/PRD prose (F04, Workflow G) | MEDIUM | Best Agents, lifecycle story |
| G10 | No cancel/supersede commitment commands, although the states exist in the contract | MEDIUM | F03 state machine |
| G11 | No retention, export or deletion jobs; uninstall cleanup is untested | MEDIUM | Marketplace privacy review, F28 |
| G12 | Recovery grant still INDETERMINATE; fresh recovery acceptance not run | MEDIUM | Credibility of the "uncertain write" claim |
| G13 | Release evidence set from plan §7 incomplete (Rovo eval, accessibility, egress review, equivalence) | MEDIUM | Implementation evidence |
| G14 | Repo hygiene: untracked duplicates of the product package at the repo root; uncommitted dossier edit | LOW | Risk of a polluted commit |

---

## 2. Submission and distribution gaps

### G1 · Judge installation (BLOCKER)
- **Spec:** 03 §8 requires two identities from one build (Marketplace and an unlicensed judge app), with equivalence checked by build hashes. F17 requires a working judge install.
- **Current:** `scripts/build-release-profiles.ts` and `scripts/verify-release-equivalence.ts` exist, but every `appId` in `docs/release/profiles.example.json` is `null`. The Devpost App ID field points to the **development** app.
- **Close it:** Register the judge app, build both profiles and run the equivalence check. Then install fresh into a clean site with a second, restricted account. Record `judge-marketplace-equivalence.md` and the install walkthrough. Update the Devpost App ID.
- **Hidden dependency:** the judge app's remote executor needs its own installation binding and its own Decionis policy (see G3). Otherwise judges can only ever see "held".

### G2 · Demo video (BLOCKER)
- **Spec:** 03 §9 has a 4:30 script that uses the real app.
- **Current:** none. The script depends on G3 (a successful governed action) and G5 (the "change the bug → impact appears" beat).

### G3 · Expired, single-use authority policy (BLOCKER for the demo)
- `docs/authority/promisory-dci-policy.v3.approved.json` sets `effective_to: 2026-11-12T00:00:00Z` and matches only `^2026-11-12$` → `^2026-11-18$`. The recovery policy also expired on 12 Nov and matches only 18 → 19 Nov.
- **Effect:** any apply today is correctly HELD or DENIED. The held path can be demonstrated; the **successful** governed path cannot. The spec's release definition (01 §13) needs both.
- **Product-level gap:** the policy authorises one specific effect, not a class of effects. A customer, or a judge, cannot use the governed action without a hand-authored policy for each date change. That is the missing F27 (*reusable commitment and policy templates*). Feature I-3 in the companion document turns this into a differentiator.
- **Close it:** publish a parameterised, time-boxed policy. For example: "due-date change on work linked to an ACTIVE commitment, delay ≤ N days, project ∈ pilot scope, independent reviewer present". Give it a validity window that covers judging (through at least Jan 2027). This needs the owner's explicit approval, as before.

### G6 · Marketplace (HIGH)
- **Spec:** F18 and 03 §8 call for a listing or review-ticket URL, privacy, support, licensing and a paid listing for a Jira-required plus Confluence-optional app.
- **Current:** draft dossier only. `app.licensing.enabled: false`, no vendor or support URL, and no listing.
- **Watch:** Marketplace review time is outside your control, and the plan targeted submission by 8 Dec. The remote egress (`promisory-test.decionis.com`) and the retention gaps (G11) are the most likely review questions. Submit the listing early and keep the review-ticket URL; the bonus accepts that URL.

### G7 · Atlassian MCP (HIGH value, low cost)
- **Spec:** F19 (P1, bonus target). 03 §8 says a `rovo:mcp` module must refer to the same action keys.
- **Current:** absent. All ten actions already exist with typed inputs and shared services, so this is mostly manifest work plus an invocation test through the Atlassian MCP endpoint. The code is ready; the gap is evidence.

---

## 3. Functional gaps against the P0 catalogue

| ID | Spec acceptance | Implementation status | Gap |
|---|---|---|---|
| F01 | Import progress, missing capabilities | Diagnostics and scope persist; live checks done | Fresh install timing; disconnect/reconnect not evidenced |
| F02 | Links, deletions and moves map correctly | Hierarchy, peers and subtasks verified live | Triggers omit `avi:jira:created/deleted:issuelink` and version events, so a **new Blocks link does not trigger anything**. Moves, deletes and key renames are not evidenced live |
| F03 | Full state machine DRAFT→…→CANCELLED/SUPERSEDED | Draft, confirm, revise and transfer exist | No `commitment.cancel` / `commitment.supersede` command (G10). Cancelled and superseded outcomes cannot be reported separately, as 01 §1 requires |
| F04 | Candidates extracted from **selected sources** with citations | Rovo `promisory-propose` accepts only `{projectId, issueId, title}` | No PRD or Confluence prose extraction (G9) |
| F05 | Roles with scope and provenance | Explicit bindings, transfer acceptance | No team discovery (Graph `atlassianTeamsBySpace` / `atlassianTeamMembers` not implemented) |
| F06/F07 | Deduplicated paths, cycles as data-quality findings | `tracePaths` collects cycles; rules v1 implement all 11 reasons | Shared-dependency and cycle cases are not evidenced live. `DELIVERY_AFTER_PROMISE` relies on an explicit target date that few tenants populate |
| F09 | Change feed with before/after | Agreement revisions immutable | No source change feed: events are not turned into history entries |
| F13 | Graph enriches team, work and evidence | Assigned work for the current user only | See G4 |
| F15 | Deduplicated notices **when things change** | Inbox, quiet hours and read state work | Notices are built on read, not pushed from events (G5). No digest delivery |
| F16 | Macro with commitments, requirements and readiness | Verified live | No gaps of note |
| F29 | Native above-epic levels or a labelled planning link | Labelled planning link verified; adapter supports native levels | The live tenant has no Premium hierarchy. Acceptable under 01 §13, but say so in the video |
| F30 | All ten phases map to selected artifacts | Model and UI phase rail exist; one synthetic PRD mapped | Discovery, release and learning artifacts not mapped live |
| F31/F32 | Stable requirement IDs, drift invalidates gate | Verified across two real PRD revisions | Whole-page fingerprint. Any edit forces reconfirmation, which is noisy. Section-level fingerprints are needed for real PRDs |

### G4 · Teamwork Graph depth (HIGH)
- **Spec:** 01 §9 names `atlassianTeamsBySpace`, `atlassianTeamMembers`, `jiraWorkItemGoals` and `jiraWorkItemLinkedExternalDeployments`. The bonus evidence must show a "real query, returned objects, source links, and **visible consequence**" (03 §8).
- **Current:** `ASSIGNED_WORK_QUERY` (up to 100 items) and an `echo` connectivity probe. Coverage reporting is honest (`INCOMPLETE`, "no rows ≠ no dependencies"). The product consequence of the graph data is thin: it shows up as a "Teamwork Graph context" panel.
- **Biggest missed opportunity:** `jiraWorkItemLinkedExternalDeployments` can supply `QUALIFYING_RELEASE` evidence automatically. Likewise, `jiraWorkItemGoals` can roll commitment health up to Atlassian Goals. Each gives the graph a visible consequence, and together they make the graph bonus story credible. See I-1 and I-2.
- **Constraint to keep:** graph-derived data must not reach the remote serializer. Both features stay inside Forge.

### G5 · Event-driven impact (HIGH)
- `apps/forge/src/events.ts:sourceChanged` hashes `(source, id)` and upserts an `event` row. Nothing reads that row.
- The impact is recomputed only when someone opens the workspace. Workflow C (engineer reopens a bug, then managers, team leads and account owners are told) and the "< 2 min p95 intervention" outcome (01 §1) are therefore **not implemented**.
- **Close it:** use a Forge async-events queue consumer. For each changed work ID, find the commitments that depend on it, recompute their assessments, and upsert one deduplicated inbox item per *(commitment, reason)*. Add issuelink and version triggers. Re-check the audience's access when notices are read, which the inbox already does.
- **Constraint:** event context runs as `system-event`. Recompute is fine, but notice text must not leak restricted source content. Keep the existing "no source body" discipline.

### G8 · Business outcomes not instrumented (HIGH)
- 01 §1 defines seven pilot measures: time to first finding, % owned, intervention latency, review prep time, on-time fulfillment against the original date, evidence-backed fulfillment, and retention.
- No code computes or records any of them. The Devpost story correctly says "no customer impact … is claimed yet".
- "Potential impact" is one-fifth of the core score. Without numbers, even from the test tenant, the story reads as compliance tooling rather than a business result. See I-4 for a cheap fix that is honest about method.

### G9 · Confluence/PRD extraction (MEDIUM)
- 01 Workflow G and 06 §6 ("Product manager begins with a PRD") require Rovo to extract candidates and requirements from a selected page. The implementation report itself says "arbitrary document-prose extraction is not implemented".
- This is also the most natural **Best Agents** demo moment: "turn this PRD into tracked, owned commitments".

### G10 · Commitment cancel/supersede (MEDIUM)
- `lifecycle: z.enum(["ACTIVE","FULFILLED","CANCELLED","SUPERSEDED"])` exists in contracts, but `service.ts` has no command that sets CANCELLED or SUPERSEDED.

### G11 · Data lifecycle (MEDIUM)
- 01 §11 promises cache ≤ 24 h, history kept 180 days, deletion on disconnect, and anonymisation on account deletion. None of these jobs exist. Export does not exist. Uninstall and remote cleanup are not tested.
- **Minimum for Marketplace review:** a scheduled purge of source snapshots older than 24 h, a JSON export of commitment records for admins, and personal-data reporting handling of `accountId`s.

### G12 · Recovery acceptance (MEDIUM)
- The adapter fix binding effects before dispatch is deployed (ADR 0014). The 18 → 19 Nov grant remains INDETERMINATE, and no fresh recovery run has proven the fixed path end to end.
- **For judging:** either rerun the lost-acknowledgement scenario under the new parameterised policy (G3), or present recovery as "tested; one historical grant awaiting authority disposition". Do not show the old run as a success.

### G13 · Evidence set (MEDIUM)
The plan §7 folder layout is only partly present. These files are missing:
- `rovo-evaluation-results.md`: the plan's abstention, injection and forged-ID cases. The hostile-prompt app-level guard is "unproven" because Atlassian moderated the prompt first.
- `accessibility-results.md`: 200% zoom, keyboard and screen-reader names.
- `data-egress-review.md`
- `judge-marketplace-equivalence.md`
- `graph-query-evidence.json` for the new queries

---

## 4. Design and UX gaps

- **Business framing is absent from the first screen.** The overview leads with commitments and health. The spec's information order is correct, but no view states value or consequence: which customers, revenue or launches are exposed. See I-4 and I-5.
- **Work map:** the spec (02 §7) asks for an expandable tree, typed edges and a flat path table. The implementation renders "Confirmed relationships" lists. Verify that a judge can *see* project → epic → story/task → bug → commitment as a path in under 10 seconds. That is the core visual promise of the product.
- **`workspace.tsx` is 2,685 lines in one component file.** This is not a judge issue, but it raises regression risk during the remaining five weeks of UI changes. Split it by view before adding features.
- **Dark mode:** correctly not claimed.

---

## 5. Repository hygiene (LOW, do before the next commit)

- The repo root contains untracked copies of `01`–`06`*.md, `prototype*`, `brand*`, `viewer*`, `index.html`, `contracts/`, `diagrams/`, `previews/`, `templates/`, `validation-report.md` and `Promisory-Product-Package.zip`. The six spec files are byte-identical to `docs/product/`. These look like an unzipped package. Delete or `.gitignore` them so that `git add -A` cannot pollute the release.
- `docs/submission/release-dossier.md` has an uncommitted modification.
- The Devpost draft cites merged PR #1 (`e99c0ac`). Local `master` should be fast-forwarded before branching for the next slice.

---

## 6. Recommended closure order (36 days)

| Window | Must close | Why first |
|---|---|---|
| Nov 16–19 | G3 parameterised policy (owner approval), G14 hygiene, G10 cancel/supersede | Unblocks every live demo beat |
| Nov 19–26 | G5 event-driven impact, G4 graph queries (deployments, goals, teams), G7 `rovo:mcp` | Turns the demo from "open the page" into "the product noticed". Adds two bonus artifacts |
| Nov 26–Dec 3 | G9 PRD extraction, G8 outcome metrics, I-3 slip budgets (see companion) | Agent, Impact and Innovation scores |
| Dec 1–8 | G1 judge profile + fresh install, G6 Marketplace submission, G11 minimum data lifecycle | Review lead time; plan target Dec 8 |
| Dec 8–17 | G12 fresh recovery run, G13 evidence set, accessibility pass | Credibility |
| Dec 17–21 | G2 video, final Devpost fields, owner declarations | Freeze |

Do **not** cut access checks, truthful live/demo labels, review applicability, or held/reconciling states (03 §11). Cut P2 items and broad portfolio work first.
