# Codegeist 2026 submission pack

16 November 2026 · Phase 6 of the [closure plan](../reviews/2026-11-16/gap-report.md). **Nothing in this document has been submitted, uploaded or published.** Final submission, the video upload, eligibility declarations and legal terms are owner actions.

Deadline: **22 Dec 2026 21:00 Europe/Stockholm**; internal cutoff 22 Dec 12:00. The existing Devpost draft (submission 1294240) and its prepared copy are in the working-tree folder `docs/submission/devpost/`, which is not committed in this stack. Update that draft with the copy below.

## 1. Positioning

**One-liner (Devpost "elevator pitch", ≤ 200 chars):**
> Promisory shows which customer and launch promises a Jira change will break, who must act, and whether the fix is allowed, then proves when you delivered.

**Category:** Apps for Software Teams. **Bonus selection:** the saved form allowed one selection. Keep **Best Agents (Rovo)**: the agent reads a PRD, proposes cited commitments, traces impact and drafts recovery through shared services, and cannot approve itself. Before submitting, re-check the rules page by hand. If several bonus selections are allowed, add Teamwork Graph (deployments, goals and teams in the workflow), Atlassian MCP (`rovo:mcp` tools with a graph-egress guard) and Marketplace (review-ticket URL), each only once its evidence exists.

## 2. Story copy (outcome-led; replaces the "What it does" section of the draft)

**The problem.** Jira can say a release is 92% done while the promise behind it, to a customer, a launch or a partner team, is about to break. Status rollups average away the one blocker that matters, deadlines get silently moved, and "done" means a ticket closed rather than an outcome delivered.

**What Promisory does.**
1. **Promise radar.** Every accepted commitment is linked to the real Jira hierarchy, explicit dependencies and versioned PRD requirements. When a bug is reopened, a Blocks link is added or a PRD section changes, Promisory shows within a refresh which commitments, beneficiaries and stated value are now exposed, and who can act.
2. **PRD → owned promises.** The Rovo agent reads a permitted PRD, proposes candidate commitments cited to the exact section and revision, and leaves owner, deadline and acceptance for a person to confirm.
3. **Governed recovery with slip budgets.** Changing a Jira date goes through exact review and Decionis institutional authorization, with a grant claimed, the write read back and the result reconciled if uncertain. Small slips inside an owner-agreed budget proceed; larger ones are held with the exact reason. Moving a Jira date never silently moves the promise.
4. **Proof of delivery.** A commitment is fulfilled only when its agreed acceptance conditions are verified. Linked deployments from Teamwork Graph are candidate evidence, the designated verifier decides, and regressions stay visible.
5. **A promise ledger.** Stated value exposed, promises kept by the **original** date, and how many days before a deadline the beneficiary heard about a slip. Project-level only, with no individual rankings.

**Built with.** Forge (Custom UI, Forge SQL, triggers and scheduled jobs), Rovo agent and actions, Teamwork Graph curated queries, a `rovo:mcp` server, Jira and Confluence REST, Decionis and AgentSafe for execution authority, TypeScript, React and Zod. Claims about tests and live checks come from `docs/evidence/` only.

**What's next.** Pilot with three design-partner teams and measure time to the first evidence-linked finding, notice lead time and reliability against their own baseline. No customer results are claimed yet.

## 3. Video script (4:30, real app on the test site; example-mode images are not used)

| Time | Beat | Shown in the real app | Evidence needed first |
|---|---|---|---|
| 0:00–0:20 | Problem: "92% done, promise about to break" | Overview: promise ledger with stated value exposed | Ledger on test data with entered values (label them as entered values) |
| 0:20–0:55 | PRD → candidates with Rovo | Rovo: "Turn this PRD into candidate commitments"; owner accepts one | R03 passes |
| 0:55–1:40 | Bug reopened → promise radar | Reopen MX bug and add a Blocks link → What changed card and inbox notice; issue panel shows the commitment and owner | Event-to-notice latency recorded |
| 1:40–2:15 | Ask Rovo and use the IDE | Rovo R01 answer with citations; the same question through an MCP client with no graph fields in the response | R01, R12 |
| 2:15–3:15 | Governed recovery | Slip inside the budget → SUCCEEDED with read-back; slip outside it → HELD with reason; original deadline still shown | Selector switch done; slip policy published, otherwise show the reusable policy SUCCEEDED plus a non-bound HELD |
| 3:15–3:55 | Proof of delivery | Graph relations panel: deployment as candidate evidence; verifier accepts; adoption measured separately | Graph selections recorded |
| 3:55–4:30 | Install and close | Judge install link, Marketplace ticket, repository; "measured on our test site" numbers only | Submission links |

Say plainly, on screen or in narration: the test site has no Premium hierarchy above epics, so initiatives are labelled planning links.

## 4. Final checklist

| Item | Owner | Status |
|---|---|---|
| Merge PRs #2–#6 in order (stacked) | Owner review | Open |
| Executor selector switch to `33c97bbd…` (Phase 1 evidence README) | Owner | Open |
| Deploy the new major version to development; admin approves scopes and MCP | Owner | Open |
| Executor image rebuild for slip signals; publish the slip-budget policy after approval | Owner | Open (optional for video) |
| Run `docs/runbooks/release-acceptance.md`; `npm run evidence:check` passes | Owner with agent | Open |
| Register judge and Marketplace identities; judge share link; listing submitted | Owner | Open |
| Judge guest accounts on the test site; credentials only in the Devpost private testing field | Owner | Open |
| Record and upload the public YouTube video (< 5 min) | Owner | Open |
| Update Devpost: pitch, story, App ID, install link, video, bonus, survey, eligibility, terms; fix the Canada province field (`DE` → `N/A` unless applicable) | Owner | Open |
| Final Submit before 22 Dec 12:00 Stockholm | Owner | Open |
