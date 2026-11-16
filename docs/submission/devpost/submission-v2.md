# Promisory · Devpost submission v2 (rewrite)

Prepared 16 November 2026 for the existing Codegeist 2026 draft (submission 1294240). **Nothing here has been entered into Devpost.** Paste field by field once the live checks marked ⟦VERIFY⟧ have evidence; delete any sentence whose ⟦VERIFY⟧ fails rather than softening it. The saved v1 copy stays in `project-story.md` and `fields.json` as the record of what is currently saved.

---

## 0. Review of the saved draft

| Area | Problem | Fix in v2 |
|---|---|---|
| Elevator pitch | Feature-led, ungrammatical ("what is at risk,  stakeholders, permitted next action"), double space, no reader benefit | One sentence that names the outcome, the user and the proof |
| Story voice | Reads as an audit report: leads with internal state separation, then spends a third of the words on what is unfinished ("INDETERMINATE", "development candidate"). Judges score impact and presentation from this page | Lead with the problem and the outcome, show the product in action, keep honesty in a short, specific "What's next" |
| Claims | Written on 11 Nov, so it misses PRD→commitments, change radar, promise ledger, slip budgets, Graph deployments/goals/teams, MCP | Updated to the PR #2–#7 stack, with each claim gated on live evidence |
| Gallery | Two of four images are fictional example mode; one image's caption leads with failure ("does not show a successful write"); the thumbnail is a bare wordmark | Seven real-app captures in story order, captions that state outcome then proof, and a thumbnail that shows the product |
| Live captures | Existing test-site screenshots show the Jira sidebar with other vendors' AI apps, a "Dev" badge, a real person's name as verifier, and are cropped mid-scroll | Re-capture with test personas ("Maya Chen", "Jon Park"), crop to the app frame, never show other vendors' apps |
| Technology answers | Outdated counts ("eight read actions"), Graph described as one assigned-work query | Rewritten for the current modules |
| AI tools answer | Names only OpenAI Codex; this work also used Claude Code | Disclose both (edit if your tooling differs) |
| Start/new-project answer | "Developed on 10–11 November" | Development continues through the submission window |
| Owner fields | Canada province answered `DE` with country United States | Set to `N/A` unless a team member lives in Canada |

---

## 1. Title and tagline

**Title:** `Promisory`

**Tagline / elevator pitch** (Devpost limit 200 characters). Recommended:

> Know which customer and launch promises a Jira change puts at risk, who can act, and whether the fix is allowed, then prove the outcome was delivered.

(150 characters.) Alternatives:

- *Outcome-first, shorter:* "Turn Jira work into kept promises: see what a change puts at risk, act within agreed limits, and prove delivery." (112)
- *Brand line:* "Keep every commitment connected." Use this as the thumbnail and video lockup line, not as the pitch, because it does not state a benefit.

---

## 2. Story (paste into "About the project")

About 1,000 words, which reads in about four minutes. Section headings match Devpost's default prompts.

### Inspiration

Every software team makes promises: a launch date to a customer, an integration to a partner, a fix to the support team. The plan that is supposed to keep each promise lives somewhere else, spread across epics, stories, bugs and a PRD that keeps changing.

So the promise breaks quietly. A bug is reopened on a Tuesday, a requirement is edited on Wednesday, and the account owner finds out on Friday, from the customer. Jira can show a release that is 92% done while the one blocker that matters sits on the path to the only outcome anyone outside engineering cares about.

We built Promisory to connect each promise to the work, the people and the evidence that decide whether it is kept.

### What it does

**Promise radar.** A commitment records an outcome, a beneficiary, one accountable owner, a deadline in an explicit time zone, and the conditions that prove it was delivered. Promisory links it to the real Jira hierarchy, explicit dependencies and versioned PRD requirements. When a bug on the path is reopened, a Blocks link is added or the relevant PRD section changes, the affected commitments, their owners and any stated value at stake appear in a "What changed" view and in each person's inbox, filtered to what that person may see.

**From PRD to owned promises.** Ask the Promisory Rovo agent to "turn this PRD into candidate commitments". It reads the page, proposes candidates cited to the exact section and revision, and stops. A person names the owner, deadline and acceptance conditions; the agent never guesses them.

**Recovery within agreed limits.** When work slips, Promisory shows the alternatives: repair the blocker, reduce scope, or renegotiate the promise. Moving a Jira date never silently moves the commitment. The owner can agree a *slip budget* in advance. A small, independently reviewed date change inside that budget goes through institutional authorization and completes, and Promisory reads the result back from Jira. A larger one is held with the exact reason and the person who can approve it.

**Proof, not status.** A closed ticket is not a delivered promise. A commitment is fulfilled only when its agreed conditions are verified by the designated person. Deployments linked through Teamwork Graph appear as candidate evidence, and later regressions stay visible.

**A promise ledger.** For each project: the stated value currently exposed, how many promises were kept by their *original* date, and how many days before a deadline a beneficiary heard that it would move. It shows project-level numbers only and never ranks people.

### How we built it

Promisory is a Forge app: Jira global, project and issue-panel surfaces, an admin page, a Confluence macro, Forge SQL with compare-and-set aggregates, product-event triggers and scheduled jobs. The Rovo agent and a `rovo:mcp` server call the **same domain services** as the UI, so an answer in Rovo, the IDE or the workspace comes from one set of permission checks.

Teamwork Graph curated queries supply assigned work, linked deployments, goals and project teams as the current user. That data stays inside Atlassian: the MCP responses, exports and the external execution request are built without it.

The one external action, a Jira due-date change, runs through Decionis for institutional authorization and AgentSafe for enforcement. A bound execution grant is claimed before a single allowlisted Jira write. The result is read back, and an uncertain outcome is reconciled before any retry. Neither the browser nor the model can choose the target, the policy or the identity.

### Challenges we ran into

- **An uncertain write.** We cut the acknowledgement on a real Jira write and restarted the executor. Jira's history proved the change had landed, but the authority record could not be reconciled, because the original grant had not committed to the expected effect before dispatch. We changed the adapter to bind that commitment before every grant.
- **Live platform behaviour.** Forge SQL rejects a bound `LIMIT`, Teamwork Graph query names and nullable fields differed from our first assumptions, and real Rovo invocations carry metadata our fixtures did not. Each was found on the test site, fixed and covered by a contract test.
- **Saying "unknown" without saying "fine".** Empty graph results, missing permissions and stale sources had to stay visible instead of averaging into a reassuring green state.

### Accomplishments that we're proud of

- A reviewed Jira date change completed end to end on a live site: the grant was claimed, Jira acknowledged and read back the write, and the result was finalized. A second, unauthorized attempt was held with nothing written. ⟦VERIFY: re-run on the reusable policy and record both⟧
- A reopened bug reached the affected owner's inbox in ⟦VERIFY: measured seconds⟧ on the test site.
- Rovo turned a real PRD into cited candidate commitments without inventing an owner or a date. ⟦VERIFY: R03⟧
- 182 automated domain, contract and permission tests, plus 11 browser checks with WCAG 2.2 AA scans.

### What we learned

Most delivery tools compress six different facts into one colour: is the work on track, is the release ready, did anyone approve the change, was the change allowed, did it happen, and did the customer get what they were promised. Keeping those facts separate is what lets a team act on partial information without being misled by it.

We also learned that the most useful thing to record is the **original** promise. Teams renegotiate deadlines all the time, and that is healthy, but only if the earlier miss and the notice the customer received are still on record. That is why reliability in Promisory is measured against the first date, and why "how early did we warn them" is a metric.

Finally, the boundary between AI and authority has to live in the architecture, not in the prompt. The agent can read, explain and draft. Approval and execution are simply not among its tools.

### What's next for Promisory

Pilots with three design-partner teams (engineering delivery, product operations and customer success), measuring time to the first useful finding, notice lead time and promises kept against each team's own baseline. Next come cross-project dependency views, sprint and review packs, and approved customer updates sent only after the exact recipient and text are checked again. We are not claiming customer results yet.

---

## 3. "Built with" tags (≤ 25)

`atlassian-forge`, `jira`, `confluence`, `rovo`, `rovo-agents`, `teamwork-graph`, `mcp`, `forge-sql`, `typescript`, `react`, `node.js`, `zod`, `vite`, `decionis`, `agentsafe`, `azure`, `vitest`, `playwright`, `axe-core`

## 4. "Try it out" links

| Label | URL | Ready when |
|---|---|---|
| Install Promisory (judge build) | developer-console share link for the **judge** app ID | Judge identity registered and fresh install checked |
| Source code | https://github.com/ocularminds/promisory | Now (merge PR #2–#7 first so `master` matches the video) |
| Setup and judge guide | `…/blob/master/docs/runbooks/development-and-installation.md` | Now; add the judge section |
| Marketplace listing / review ticket | listing URL or ticket | After submission (Marketplace bonus) |

---

## 5. Gallery: what to capture

**Rules.** Capture everything on the dedicated test site, in the installed app, at 1440×900 with 100% zoom and the browser chrome removed. Use test personas only (Maya Chen as owner, Jon Park as reviewer, a "Northstar Retail" beneficiary) and crop to the Promisory frame plus the Jira top bar. Hide the left sidebar's *Recommended for your team* list, which currently shows other vendors' AI apps, hide the "Dev" badge, and keep the browser zoom and font rendering the same in every shot. Any image in example mode must say "Example data" in its caption; aim for none.

| # | Capture | Set-up | Caption (outcome first, then proof) |
|---|---|---|---|
| Thumbnail (3:2, 1200×800, < 5 MB) | Mark and wordmark on the left; on the right, a cropped overview showing the promise ledger and one "At risk" commitment | Compose from capture 1; navy `#102D46` background, azure `#0078D4` accent | — |
| 1 | Overview: promise ledger, What changed card, commitment list with one At risk | Seed three commitments with stated values; reopen the bug a minute before | "See the promises a change puts at risk, with stated value and owners, the moment the work changes." |
| 2 | Jira issue panel on the reopened bug | Open the bug in Jira; the panel shows the commitment, owner and path | "From the engineer's bug: which customer promise it blocks, and who to talk to." |
| 3 | Rovo chat: PRD → candidates | Ask "Turn the Merchant activation PRD into candidate commitments", confirm one | "Rovo proposes commitments cited to the exact PRD section, and leaves owner and deadline to a person." |
| 4 | Work map / impact path | Select the bug; show the epic → story / task / bug path with the Blocks edge labelled | "The real Jira hierarchy, with stories, tasks and bugs as peers, and an explicit blocking path to the promise." |
| 5 | Review: slip inside the budget → completed | Prepare a +2-day change with a 3-day budget, independent review, apply | "A reviewed slip inside the agreed budget is authorized, applied and read back from Jira." |
| 6 | Review: slip outside the budget → held | Prepare a +6-day change | "A larger slip is held with the exact reason and the approver. The original promise is unchanged." |
| 7 | Outcome verification with a Graph deployment as candidate evidence | Open commitment detail, expand Teamwork Graph relations, then verify | "Delivery is proven against the agreed condition; a linked deployment is evidence, not a verdict." |
| 8 (optional) | Confluence macro on the PRD page | The PRD page with the macro showing requirement version and readiness | "The PRD shows which commitments depend on it and whether the latest edit still applies." |

Captures 5 and 6 need the executor selector switch. Capture 6, as described, also needs the slip-budget policy. Without that policy, use the HELD result from a change outside the policy's scope and caption it "held: outside approved scope".

## 6. Video capture checklist (≤ 5 min, public YouTube)

Follow the beat sheet in `docs/submission/codegeist-2026-submission-pack.md` §3. In addition:

- Record at 1920×1080, 30 fps, with the system cursor enlarged and notifications off. Script the narration and record it separately from the screen.
- Open with the problem in 15 seconds, before any UI. State real numbers only as "measured on our test site".
- Show the **completed** governed change and the **held** one back to back. That contrast is the core innovation beat.
- Show one external MCP call in an IDE (the response has no Graph data), then return to Rovo for the same question with Graph context.
- End on the install link, the repository and the Marketplace status shown on screen.
- Add captions (an SRT file) for accessibility.

## 7. Additional-information answers (replace the saved v1 answers)

**Category rationale (Apps for Software Teams).**
Promisory is for software teams that make delivery promises, to customers, launches and other teams, and then execute them in Jira and Confluence. It connects each promise to the real work hierarchy, the accountable owner and the evidence of delivery. A team sees what a change puts at risk, acts within agreed limits and proves the outcome.

**Main technology explanation.**
Promisory is an Atlassian Forge app: Jira global, project and issue-panel pages, an admin page, a Confluence macro, Forge SQL, product-event triggers and scheduled jobs. A `rovo:agent` with read and proposal actions and a `rovo:mcp` server with read-only tools call the same domain services as the UI, so every entry point applies the same current-user permission checks. Teamwork Graph curated queries supply assigned work, linked deployments, goals and project teams as the current user, and that data stays inside Atlassian. One optional external action, an independently reviewed Jira due-date change, is authorized by Decionis and enforced by AgentSafe with a bound grant, read back from Jira and reconciled if its result is uncertain.

**Best Agents (Rovo).**
The Promisory agent reads a permitted PRD and proposes candidate commitments cited to the exact section and revision. It traces how a bug or requirement change affects commitments and initiatives, identifies the accountable people from confirmed role bindings, explains readiness and fulfilment, and drafts recovery proposals on request. It uses the same services and permission checks as the UI. It treats page and issue text as untrusted evidence and cannot review, approve or execute: those actions are not among its tools. ⟦VERIFY: R01, R03, R04, R05 recorded⟧

**Teamwork Graph** (if a second bonus can be selected).
Promisory reads Teamwork Graph curated queries as the current user: assigned work for the "My work" view, plus linked deployments, goals and project teams for each commitment. Deployments become candidate fulfilment evidence, goals become labelled planning context, and teams become discovered context that grants no role. Empty results are shown as "not proven absent". Graph data and its derivatives never leave Atlassian; MCP responses and exports exclude them. ⟦VERIFY: graph-query-evidence.json⟧

**Atlassian MCP** (if a second bonus can be selected).
A `rovo:mcp` server exposes three read-only Promisory tools (commitments, people, lifecycle). An engineer in an MCP client can ask which customer promise a ticket affects. The response is projected to exclude Teamwork Graph data and agent-originated proposals before it leaves Atlassian. ⟦VERIFY: external client invocation⟧

**Forge experience feedback.**
Forge let us put Jira, Confluence, SQL storage, product events, Rovo and MCP in one app with one permission model. That shared model is what makes the agent trustworthy. The hardest parts were things only a live site reveals: Forge SQL's handling of bound `LIMIT`, curated Graph node types that we had to discover tier by tier, Rovo invocation metadata, and validating the installed remote invocation's identity. End-to-end samples that combine Rovo actions, Graph queries and Forge Remote, plus clearer runtime diagnostics for scope and consent problems, would save other builders days.

**AI tools used.**
We used AI coding assistants (OpenAI Codex and Anthropic Claude Code) for implementation, tests, integration debugging, reviews and documentation. Every claim in this submission is backed by automated tests or recorded evidence from the installed app on our test site. Rovo is part of the product itself.

**New project explanation.**
Promisory, its Forge app and all workflow code were created for Codegeist 2026, starting 10 November 2026 and continuing through the submission period. It uses our existing Decionis and AgentSafe services as dependencies for institutional authorization; those products are not claimed as new for this entry.

**Testing instructions (for judges).**
1. Install the judge build from the link and choose a Jira site with Confluence.
2. In **Promisory → Connections**, select one project and connect Confluence.
3. Create a commitment, link an epic or task, and ask the Promisory agent in Rovo: "What threatens this commitment?"
4. To see the governed Jira change complete, sign in to our test site with the judge accounts in the private field. On your own site the same step is held, because execution is bound to our authority tenant by design.
5. Example mode (`?mode=example` in local development) uses clearly labelled fictional data and never performs external actions.

Put judge credentials **only** in Devpost's private testing field, never in the repository or the public story.

## 8. Owner fields to fix before Submit

- Canada province: `DE` → `N/A`, unless a team member resides in Canada.
- App ID: the development ID (`6e0430ce…`) → the **judge** app ID.
- Bonus: confirm whether more than one selection is allowed. If only one, keep **Best Agents**.
- Survey ratings, eligibility attestation and terms: personal declarations for the owner to complete.
- Re-read the elevator pitch in the live preview; the card truncates around 140 characters on some layouts.
