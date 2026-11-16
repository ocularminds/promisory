# Promisory · Outcome-led features for Codegeist 2026

**16 November 2026 · companion to [gap-report.md](gap-report.md)**

Judging (per `docs/product/03` §8): Implementation, Design, Potential impact, Innovation and Presentation are weighted equally. The bonus tracks are Best Agents, Teamwork Graph, Marketplace and Atlassian MCP. The live rules page returned 403 to an automated fetch on 16 Nov. Re-check the bonus selection rules by hand: the Devpost draft notes that the form allows **one** bonus selection.

## 1. The positioning problem

Today the pitch is about *correctness*: separate states, exact review, verified fulfillment. Judges and buyers respond to *consequences*. Most Jira tools answer "is the work on track?" Promisory can answer a question no status rollup can:

> **"Which promises to which customers are we about to break, what are they worth, who has to act, and are we allowed to fix it right now?"**

Proposed one-liner: **"Promisory turns Jira work into kept promises: it tells you which customer and launch commitments a bug will break, before the customer finds out, and proves when you delivered."**

Every feature below makes that sentence demonstrable. Each one reuses existing building blocks: the impact engine, Rovo actions, the governed executor, and outcome verification. None breaks an AGENTS.md invariant.

---

## 2. Feature shortlist (ranked by competition leverage ÷ effort)

| # | Feature | Business outcome | Score lift | Effort |
|---|---|---|---|---|
| I-1 | **Self-proving releases** (Graph deployment evidence → fulfillment) | Zero-touch proof of delivery; ends "is it actually live?" chasing | Teamwork Graph bonus, Innovation, Implementation | 3–4 d |
| I-2 | **Promise radar on the issue** (event-driven blast radius + "before you move this date") | Breaches caught when the change happens, not at the status meeting | Impact, Innovation, Design | 4–5 d |
| I-3 | **Slip budgets** (pre-approved, governed change envelopes) | Fast, safe replanning: small slips self-serve, large ones escalate | Innovation (unique), Implementation | 3–4 d + policy approval |
| I-4 | **Exposure ledger** (value at risk + promise reliability) | Puts a number on what a blocker costs; makes delivery reliability a sales asset | Potential impact, Presentation | 3 d |
| I-5 | **PRD → promises agent** (Rovo extracts owned commitments from Confluence) | Requirements become accountable promises in minutes, not a planning week | Best Agents, Impact | 4 d |
| I-6 | **Promise context in the IDE** (`rovo:mcp`) | Engineers see the customer promise behind a ticket where they work | MCP bonus, Innovation | 1–2 d |
| I-7 | **Honest-renegotiation signal** (notice lead time) | Measures how early customers hear bad news; rewards telling them early instead of hiding it | Innovation, Impact | 1–2 d |
| I-8 | **Weekly promise review pack** (Rovo-drafted, human-published) | Cuts status-meeting prep; the spec target is −30% | Impact, Best Agents | 2–3 d |
| I-9 | **Goal-linked promise health** (Atlassian Goals rollup) | Executives see which company goals are threatened by which bugs | Teamwork Graph, Impact | 2 d |
| I-10 | **Release-version promise discovery** (first finding in < 10 min) | Activation: useful on day one without setup | Implementation, Design | 2 d |

**Recommended build set if time is tight:** I-2, I-1, I-3, I-4, I-6. Together they produce one demo arc (see §4) and all four bonus artifacts.

---

## 3. Feature specifications

### I-1 · Self-proving releases
- **Outcome:** a commitment whose acceptance condition is "shipped to production" verifies itself when the deployment really happens. Today someone pastes a link, or worse, a closed ticket counts as done.
- **How:** call the curated `jiraWorkItemLinkedExternalDeployments` query (as the user, inside Forge) for work on a commitment's required path. Map a successful production deployment to *candidate* evidence for a `QUALIFYING_RELEASE` condition. The designated verifier confirms with one click when the predicate needs a human. The evidence card shows source, environment, time and lineage `TEAMWORK_GRAPH`.
- **Graph bonus consequence:** the graph produces a visible state change, not just context.
- **Guardrails:** deployment ≠ adoption, and `OUTCOME_UNMEASURED` stays separate. Graph lineage blocks remote serialization. A stale or missing deployment stays "Outcome not yet verified". Never mark fulfilled from a closed Jira status alone.
- **Demo line:** "Nobody uploaded proof. The deployment Jira already knows about verified the promise, and the customer-acceptance condition is still honestly open."

### I-2 · Promise radar on the issue
- **Outcome:** turns Promisory from a place you visit into something that tells you when a promise is at risk. Targets the spec outcome "< 2 min from dependency change to visible impact".
- **How:**
  1. **Push:** consume `avi:jira:updated:issue`, `created/deleted:issuelink` and version events through a Forge async queue. Recompute the affected commitments with the existing `assessImpact`. Upsert one inbox item per *(commitment, reason)* (closes G5).
  2. **Pre-flight:** in the issue panel, run "What breaks if…" for a proposed due-date change, de-scope or link removal. Run the impact engine on a *hypothetical* delta and list the commitments, beneficiaries and deadlines that would move to AT_RISK or BREACHED. Persist nothing; it is a read-only simulation.
- **Guardrails:** pre-flight is diagnostic only, never authority. Notice text contains no restricted source content, and access is re-checked on read (as the inbox already does).
- **Demo line:** "The engineer drags the bug's date. Before saving, the panel says this breaks the Northstar launch promise to the account owner's customer."

### I-3 · Slip budgets (governed change envelopes)
- **Outcome:** most date changes are small and routine. Making each one wait for a meeting slows teams down, while letting any change through quietly breaks promises. Slip budgets give **speed inside a pre-agreed envelope and escalation outside it**. This is how finance treats spending authority, applied to delivery.
- **How:** a commitment owner proposes a budget, e.g. "supporting work may slip ≤ 3 working days while the commitment deadline still holds". A sponsor approves it as a **versioned policy template** (F27). This also replaces the expired single-date DCI policy (gap G3). The Decionis policy is parameterised on project, commitment, maximum delay and expiry. Changes inside the envelope still go through grant, claim, write, read-back and finalize. Changes outside it are HELD with "exceeds slip budget by 2 days; sponsor review required".
- **Why this is unique:** competitors either block everything (approval workflows) or nothing (Jira edits). Promisory authorises **by consequence to the promise**, using its own impact engine as policy *input*. Decionis keeps institutional authority.
- **Guardrails:** budget approval is a recorded review, not title-based. The UI and the model cannot widen a budget. Consumed budget and remaining budget stay visible, and the original deadline is never moved.
- **Demo line:** "A two-day slip goes through, governed and verified. A five-day slip is held, and the exact reason and approver are shown."

### I-4 · Exposure ledger
- **Outcome:** answers the sponsor's real question, "what does this blocker cost us?", and makes promise-keeping a measurable team asset.
- **How:**
  - Optional, explicitly entered commitment fields: *value at stake* (amount, currency, basis: ARR / contract penalty / launch revenue / internal) with an owner and provenance. Exposure = the sum over AT_RISK and BREACHED commitments, **deduplicated per commitment**, shown beside counts, never instead of them.
  - **Promise reliability** at project and team level, never individual: fulfilled-by-original-date ÷ due, late, renegotiated, cancelled. A minimum-sample threshold hides small groups. This uses the original deadlines already preserved by the model.
  - The spec's pilot measures (01 §1) are computed live: time to first finding, % with an accepted owner, event-to-notice latency, and evidence-backed fulfillment. This closes G8 and gives the video **real numbers from the test tenant**, labelled as such.
- **Guardrails:** no invented ROI; a missing value shows "Value not stated", never zero. No individual ranking. Exposure follows source ACLs, so restricted commitments are excluded from totals without saying they exist.
- **Demo line:** "€180k of stated contract value is exposed by one open bug. Here is the owner who can act."

### I-5 · PRD → promises agent
- **Outcome:** a product manager selects a Confluence PRD, and Rovo proposes requirement mappings and candidate commitments, with citations to page section and revision. Owners accept them. Planning that took days of spreadsheet work takes minutes, and nothing becomes a promise without a named owner accepting it.
- **How:** a new Rovo action `promisory-propose-from-page` (pageId, sectionRefs) uses the existing `lifecycle.mapArtifact` and `commitment.createDraft` services. It fixes the whole-page fingerprint noise (gap F31) with **section-level fingerprints**, so only an edited requirement triggers drift.
- **Guardrails:** ambiguous owner, date or acceptance stays unresolved. Page text is untrusted (prompt-injection fixture in the evaluation set). The agent never activates a commitment.
- **Best Agents story:** the same agent extracts, traces, explains and drafts recovery, end to end through shared services, and it cannot approve its own proposals.

### I-6 · Promise context in the IDE (`rovo:mcp`)
- **Outcome:** an engineer in Claude Code, Cursor or VS Code (through the Atlassian MCP server) asks "what customer promises does KAN-37 affect, and who owns them?" and gets the governed, permission-filtered answer. Business context reaches the people changing the code.
- **How:** add a `rovo:mcp` manifest module that references the existing read actions plus `promisory-recovery` (draft only). Record an actual invocation through the Atlassian integration as evidence.
- **Guardrails:** identical to the Rovo actions, because they are the same functions. No write or approve tool is exposed.

### I-7 · Honest-renegotiation signal
- **Outcome:** customer trust depends less on never slipping than on **hearing early**. Measure *notice lead time*: the days between the first AT_RISK finding and either the agreed revision or a breach. Report it at project level next to reliability.
- **How:** both timestamps already exist (assessments and revision history). Add the computation and an exposure-ledger column.
- **Why it matters:** this metric favours honesty over hiding risk, which a pure on-time rate does not, and it fits the preserved-breach invariant.

### I-8 · Weekly promise review pack
- **Outcome:** the weekly delivery review is prepared automatically: changes since last week, new risks, held actions, verified outcomes, and decisions needed. Targets the spec's "−30% review prep time".
- **How:** a Rovo conversation starter plus action returns a structured pack. Optionally, prepare (not publish) a Confluence page draft for the user to publish (F35 boundary).
- **Guardrails:** the user publishes, never the app. The pack contains only authorized content.

### I-9 · Goal-linked promise health
- **Outcome:** each Atlassian Goal shows the commitments that support it and their health. An executive can go from "Q4 merchant growth goal" to "this bug".
- **How:** the curated `jiraWorkItemGoals` query on required-path work, shown as a labelled planning context ("supports goal"), never as a parent. Read-only; no writes to Goals.

### I-10 · Release-version promise discovery
- **Outcome:** time-to-first-finding under 10 minutes on a fresh install, which matters for judges and pilots alike.
- **How:** after scope selection, list unreleased Jira versions and epics with due dates as **candidate** commitments, each with "needs an owner, beneficiary and acceptance". Show one evidence-linked finding immediately (e.g. "Version 2.4 has an open blocker on its path").
- **Guardrails:** candidates are labelled and never active until accepted. This is not demo data; it is real tenant data flagged as unconfirmed.

---

## 4. Revised demo arc (4:30, real app, test tenant)

| Time | Beat | Features |
|---|---|---|
| 0:00–0:20 | Problem: "Jira says 92% done. The launch promise to Northstar is still about to break." | I-4 |
| 0:20–0:55 | PM selects the PRD, and Rovo proposes owned commitments with citations. The owner accepts. | I-5 |
| 0:55–1:40 | Engineer reopens a bug. The issue panel shows promise radar: commitment, customer, € exposure and owners. The inbox updates within a minute. | I-2, I-4 |
| 1:40–2:15 | Ask Rovo "what threatens Merchant Launch?" for a cited answer with graph team context. The same question from the IDE through MCP gives the same answer. | Best Agents, I-6 |
| 2:15–3:15 | A 2-day slip inside the budget goes through and is verified by read-back. A 5-day slip is HELD with its exact reason. The original deadline remains on record. | I-3 |
| 3:15–3:55 | The production deployment from Graph verifies the delivery condition. Customer acceptance stays open, and adoption is measured separately. | I-1 |
| 3:55–4:30 | Exposure ledger: reliability, notice lead time and live pilot measures from the test tenant. Installation link and Marketplace ticket. | I-4, I-7 |

---

## 5. Differentiation summary for the Devpost story

| Typical Jira add-ons | Promisory |
|---|---|
| Roll up % of tasks done | Shows which **promises** and **customers** are exposed, and what they are worth |
| Status changes count as done | Fulfillment needs agreed evidence (deployments, acceptance); later regressions stay visible |
| Approvals block everything, or nothing is governed | **Slip budgets**: governed self-service inside an approved envelope |
| AI summarises tickets | The agent turns PRDs into owned commitments, explains impact and drafts recovery, and cannot approve itself |
| Deadline edits overwrite history | Original deadlines and breaches are kept; teams that warn customers early are recognised (notice lead time) |

## 6. Claims discipline

Every number in the video and story must come from the live test tenant and be labelled as such ("measured on our test site, n = …"). The exposure values are fictional Northstar inputs and must be shown as entered example values. Do not claim pilot ROI, Marketplace approval or "Runs on Atlassian". The remote executor makes the app ineligible for that badge.
