## Inspiration

Every software team makes promises: a launch date to a customer, an integration to a partner, a fix to the support team. The plan that is supposed to keep each promise lives somewhere else, spread across epics, stories, bugs and a PRD that keeps changing.

So the promise breaks quietly. A bug is reopened on a Tuesday, a requirement is edited on Wednesday, and the account owner finds out on Friday, from the customer. Jira can show a release that is 92% done while the one blocker that matters sits on the path to the only outcome anyone outside engineering cares about.

We built Promisory to connect each promise to the work, the people and the evidence that decide whether it is kept.

## What it does

**Promise radar.** A commitment records an outcome, a beneficiary, one accountable owner, a deadline in an explicit time zone, and the conditions that prove it was delivered. Promisory links it to the real Jira hierarchy, explicit dependencies and versioned PRD requirements. When a bug on the path is reopened, a Blocks link is added or the relevant PRD section changes, the affected commitments, their owners and any stated value at stake appear in a "What changed" view and in each person's inbox, filtered to what that person may see.

**From PRD to owned promises.** Ask the Promisory Rovo agent to "turn this PRD into candidate commitments". It reads the page, proposes candidates cited to the exact section and revision, and stops. A person names the owner, deadline and acceptance conditions; the agent never guesses them.

**Recovery within agreed limits.** When work slips, Promisory shows the alternatives: repair the blocker, reduce scope, or renegotiate the promise. Moving a Jira date never silently moves the commitment. An independently reviewed date change requires institutional authorization and a bound grant before it can execute. Promisory reads the result back from Jira. When a previous execution claim remains unresolved, another write is held with the reason visible.

**Proof, not status.** A closed ticket is not a delivered promise. A commitment is fulfilled only when its agreed conditions are verified by the designated person. Later regressions stay visible, with the earlier verification preserved.

**A promise ledger.** For each project: the stated value currently exposed, how many promises were kept by their *original* date, and how many days before a deadline a beneficiary heard that it would move. It shows project-level numbers only and never ranks people.

## How we built it

Promisory is a Forge app: Jira global, project and issue-panel surfaces, an admin page, a Confluence macro, Forge SQL with compare-and-set aggregates, product-event triggers and scheduled jobs. The Rovo agent and a `rovo:mcp` server call the **same domain services** as the UI, so an answer in Rovo, the IDE or the workspace comes from one set of permission checks.

Teamwork Graph context stays inside Atlassian. MCP responses, exports and the external execution request exclude that data and its derivatives. The live external MCP check returned permitted Jira and Confluence source references and explicitly reported that Graph context was excluded.

The one external action, a Jira due-date change, runs through Decionis for institutional authorization and AgentSafe for enforcement. A bound execution grant is claimed before a single allowlisted Jira write. The result is read back, and an uncertain outcome is reconciled before any retry. Neither the browser nor the model can override the installation binding, effective identity, institutional policy or executor allowlist.

## Challenges we ran into

- **An uncertain write.** We cut the acknowledgement on a real Jira write and restarted the executor. Jira's history proved the change had landed, but the authority record could not be reconciled, because the original grant had not committed to the expected effect before dispatch. We changed the adapter to bind that commitment before every grant.
- **Live platform behaviour.** Forge SQL rejects a bound `LIMIT`, and real Rovo invocations carry metadata our fixtures did not. Both were found on the test site, fixed and covered by contract tests.
- **Saying "unknown" without saying "fine".** Empty graph results, missing permissions and stale sources had to stay visible instead of averaging into a reassuring green state.

## Accomplishments that we're proud of

- A reviewed Jira date change completed end to end on the test site under the reusable policy: the grant was claimed, Jira acknowledged and read back the write, and finalization was recorded. A separate attempt against an issue with an unresolved earlier claim was blocked before dispatch, with no additional write.
- A reopened test bug produced an affected-commitment notice in 12.6 seconds. We then verified the notice in the owner's inbox; the measured interval is for notice creation, not inbox rendering.
- Rovo read a real Confluence PRD, proposed five candidates cited to its sections and revision, and created one draft only after explicit confirmation. Owner, deadline and acceptance conditions remained unresolved for a person to complete.
- Three read-only MCP tools were discovered by an external local client. The commitments tool returned five permitted commitments with Jira and Confluence references and no Teamwork Graph context.
- 187 automated domain, contract and permission tests, plus 20 browser checks with WCAG 2.2 AA scans.

## What we learned

Most delivery tools compress six different facts into one colour: is the work on track, is the release ready, did anyone approve the change, was the change allowed, did it happen, and did the customer get what they were promised. Keeping those facts separate is what lets a team act on partial information without being misled by it.

We also learned that the most useful thing to record is the **original** promise. Teams renegotiate deadlines all the time, and that is healthy, but only if the earlier miss and the notice the customer received are still on record. That is why reliability in Promisory is measured against the first date, and why "how early did we warn them" is a metric.

Finally, the boundary between AI and authority has to live in the architecture, not in the prompt. The agent can read, explain and draft. Approval and execution are simply not among its tools.

## What's next for Promisory

Pilots with three design-partner teams (engineering delivery, product operations and customer success), measuring time to the first useful finding, notice lead time and promises kept against each team's own baseline. Next come cross-project dependency views, sprint and review packs, and approved customer updates sent only after the exact recipient and text are checked again. We are not claiming customer results yet. The separate slip-budget policy, customer executor provisioning and live deletion verification remain launch work. Marketplace version 4.0 is submitted for review; publication is controlled manually.
