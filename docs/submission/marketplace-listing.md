# Promisory · Atlassian Marketplace listing copy

Prepared 16 November 2026. **Nothing has been submitted.** Field limits come from Atlassian's *Building your presence on Marketplace* and *Privacy and Security tab* pages, checked on 16 Nov 2026; the character counts in brackets were measured. Items marked **OWNER** need verified business, legal or infrastructure facts that must not be invented. Items marked ⟦VERIFY⟧ depend on live evidence from `docs/runbooks/release-acceptance.md`.

Voice: calm and precise. Say what changes for the team and back it with something the product does. No superlatives, no invented ROI, no implication that Atlassian built or endorses the app. Never put an Atlassian product name first in the app name.

---

## 1. Identity

| Field | Limit | Copy |
|---|---|---|
| **App name** | 60 | `Promisory for Jira` [18] |
| Alternative name | 60 | `Promisory: Delivery Commitments for Jira` [40]. Use only if search tests show "commitments" is a term buyers type. |
| **Tagline** | 130 | `See which promises a Jira change puts at risk, act within agreed limits, and prove delivery against the original commitment.` [124] |
| **Summary** (legacy; shown in search) | 250 | `Promisory links customer and launch commitments to real Jira work, owners and PRD requirements. When a bug, link or requirement changes, see what is at risk and who can act, recover within agreed limits, and verify delivery.` [224] |

The rules forbid the words *Atlassian, plugin, beta, add-on* and *app* in the name, and the name must not start with *Jira* (for example, not "Jira Promisory").

---

## 2. Highlights (exactly three)

Screenshot: 1840×900 PNG. Cropped image: 580×330 PNG, the area shown on the details page. Capture on the test site with test personas, as in `devpost/submission-v2.md` §5. Do not include Atlassian logos you have edited, other vendors' apps, real names or the "Dev" badge.

### Highlight 1: Spot risk the moment work changes

- **Title** [50]: `See what a change puts at risk` [30]
- **Summary** [220]: `Reopen a bug, add a blocking link or edit a PRD section, and Promisory shows which commitments are affected, the owners who can act and any stated value at stake, filtered to what each person may see.` [200]
- **Screenshot:** overview with the *What changed* card, the promise ledger and one commitment marked At risk. **Cropped:** the What changed card next to the At risk row.
- **Caption** [220]: `A reopened bug on the delivery path immediately shows the customer promise it threatens, its owner and the value stated when the promise was agreed.` [148]

### Highlight 2: Recover without breaking trust

- **Title**: `Recover within agreed limits` [28]
- **Summary**: `Compare repair, scope and renegotiation options. Small, reviewed date changes inside an agreed slip budget are authorized and applied to Jira; larger ones are held with the reason. The original promise is kept.` [210]
- **Screenshot:** the review panel showing an applied change with Jira read-back, next to a held change. **Cropped:** the two result states.
- **Caption**: `An independently reviewed date change inside the budget completes and is read back from Jira. A larger slip waits for the right approver.` [137]

### Highlight 3: Prove delivery, not just status

- **Title**: `Prove the promise was kept` [26]
- **Summary**: `A closed ticket is not a delivered outcome. Verify each commitment against its agreed conditions, track promises kept by their original date, and keep later regressions visible.` [177]
- **Screenshot:** outcome verification with a linked deployment shown as candidate evidence. **Cropped:** the acceptance condition and its verifier.
- **Caption**: `The designated verifier accepts the agreed evidence. A linked deployment supports the decision; it does not replace it.` [119]

### Additional screenshots (up to 5 per highlight; captions ≤ 220)

| Attach to | Capture | Caption |
|---|---|---|
| H1 | Jira issue panel on the bug | `From the engineer's bug: the commitment it blocks, the path to it and who to coordinate with.` [93] |
| H1 | Rovo turning a PRD into candidates | `Ask the Promisory agent in Rovo to turn a PRD into candidate commitments, each cited to the exact section. People confirm the owner and date.` [141] |
| H1 | Work map with the typed path | `Your real Jira hierarchy: stories, tasks and bugs stay peers, and blocking links are shown as dependencies, not invented parents.` [129] |
| H2 | Recovery comparison | `Repair the blocker, reduce scope or renegotiate the promise. Changing an engineering date never silently changes the commitment.` [128] |
| H3 | Promise ledger | `Project-level reliability against original dates, notice before a slip and the stated value at risk. No individual rankings.` [124] |
| H3 | Confluence macro on the PRD | `The PRD shows which commitments rely on it and whether the latest edit still applies to the release-readiness review.` [117] |

---

## 3. More details (≤ 1000 characters; bullets, links and line breaks allowed)

```
Promisory is for software teams that promise outcomes to customers, launches and other teams, and deliver them in Jira and Confluence.

• Commitments with one accountable owner, a deadline in an explicit time zone and checkable acceptance conditions
• Works with your configured Jira hierarchy; initiatives without native levels appear as labelled planning links
• Versioned PRD requirements: an edit to the relevant section flags the affected commitments and readiness reviews
• Rovo agent and MCP tools that explain impact and draft proposals, but cannot approve or execute them
• Optional governed Jira date changes with independent review, institutional authorization and read-back
• Every view, answer and export rechecks the user's current Jira and Confluence access
• Teamwork Graph context stays inside Atlassian

Documentation: <OWNER: docs URL>
Support: <OWNER: support URL>
```

Measured at **884 characters** with the two placeholders. Re-count after inserting the real URLs and trim the last bullet if it goes over 1000.

---

## 4. Visual assets

| Asset | Spec | Source / direction |
|---|---|---|
| Logo | 144×144 PNG, transparent or chiclet | Export `packages/design-system/brand/promisory-mark.svg` at 144 px. The mark alone, with no wordmark and no Atlassian elements |
| Banner | 1120×548 PNG (shown in the in-product app browser) | Navy `#102D46` background. Left: mark plus "Promisory for Jira". Right: "See what's at risk. Act within limits. Prove delivery." Bottom: "by <OWNER: partner name>". Typefaces Manrope and Inter (local OFL files). Contrast checked against `brand/contrast-report.json` |
| Video (optional) | YouTube, 30 s or less recommended | Cut-down of the Devpost video: problem (5 s) → reopened bug shows the at-risk promise (8 s) → reviewed slip completes, a larger one is held (10 s) → verification (5 s) → logo (2 s). Show the app in use; no stock footage |

---

## 5. Categories and keywords

The categorization system changes over time, so pick categories in the form. Suggested intent:
- Primary: **Project management** (delivery or release management if offered)
- Secondary: **Reporting** or **Workflow** (governance, approvals)

Search terms to work into copy (the form has no keyword field): commitments, delivery risk, release readiness, PRD traceability, dependencies, customer promises, governed changes, Rovo agent.

---

## 6. Release and support fields

| Field | Copy / value |
|---|---|
| Version "What's new" (first release) | `First release: commitments linked to Jira work and PRD requirements, change notices, Rovo agent and MCP tools, governed date changes with slip budgets, outcome verification, promise ledger, retention and export.` [211] |
| Documentation URL | **OWNER**. Required for paid apps. Publish the setup guide (`docs/runbooks/development-and-installation.md`) plus a short user guide on a public URL |
| Work item tracker URL | **OWNER**, for example a public issue tracker or support portal |
| Partner support details | **OWNER**. Mandatory for paid apps. Use a monitored channel; do not state a response time you have not committed to |
| End User Terms | **OWNER**. Atlassian's customizable standard agreement is an option. A DPA is also needed if Promisory acts as a GDPR processor |
| Privacy policy URL | **OWNER**. Required by the Marketplace Partner Agreement. Base it on `docs/submission/privacy-and-data-handling.md` |
| Atlassian Community tag | Optional; enable once support coverage exists |

### Pricing

Recommended launch structure, reviewed against comparable Marketplace apps on 17 Nov 2026. Prices are monthly; Atlassian sets annual at 10× monthly automatically. Customers are billed for **every Jira user on the site**, not only people who use Promisory.

**Standard edition** (promise radar, PRD candidates, promise ledger, Rovo agent, MCP tools, verification, retention and export)

| Jira users | Price | Effective annual cost |
|---|---|---|
| 1–10 | **$15 / month flat** | $150 |
| 11–100 | **$4.90 / user / month** | 25 users $1,225 · 100 users $4,900 |
| 101–250 | **$3.20 / user / month** for users in this band | 250 users $9,700 |
| 251–1,000 | **$2.00 / user / month** for users in this band | 500 users $14,700 · 1,000 users $24,700 |
| 1,001+ | **$1.10 / user / month** for users in this band | — |

**Advanced edition** (adds governed Jira changes with slip budgets and institutional authorization): about **$7–8 / user / month** at 11–100, with the same band discounts. Offer it only once edition pricing is available for the listing and the production executor and authority service are ready. It carries the executor's hosting and authority costs.

Why these numbers:
- **1–10 users.** Jira is free at this size. 45 of the 100 most-installed Jira Cloud apps are free up to 10 users, and most paid ones charge about $10 a month. The earlier $49 was roughly five times the norm and adds friction for evaluating teams, for little revenue.
- **11–100 users.** $4.90 sits just below BigPicture (about $5.20) and well below Xray Standard ($7.28). It is about half of Jira Standard's own $9.70.
- **Volume bands.** Without them, $4.90 for every user would cost a 1,000-user site $49,000 a year, about double comparable portfolio and test-management apps (BigPicture about $22,550, Xray about $28,730). The bands above land between those two.
- **Net to the vendor.** Promisory is not "Runs on Atlassian" (it uses a remote executor), so the standard Forge revenue share applies: most likely 17% from 1 Oct 2026, about $4.07 net per user per month at $4.90. Confirm with Atlassian whether the 0% incentive on a partner's first $1M of Forge revenue also covers apps that use Forge Remote.
- **Raising prices later.** Consider moving 11–100 to $5.50–6.00 only after pilot results show measured value. Prefer growing revenue per customer through the Advanced edition. Price changes apply to new customers within 24 hours; existing customers keep their price for 60 days if they stay on the same tier.

Before publishing:
- Enter the bands in the partner portal and check its customer calculator, including how the per-user rate applies at 11 users.
- Re-check competitor prices on their Marketplace pricing tabs. The figures above are third-party captures from Oct–Nov 2026.
- Set `licensing.enabled: true` only in the Marketplace profile. After the production deploy, the production app cannot be installed until the listing is approved, so test in development or staging (production installs are billed). Offer the standard 30-day trial.

---

## 7. Submission details Atlassian asks for

### Scope justifications

| Scope | Why Promisory needs it |
|---|---|
| `read:jira-work` | Read the selected project's issues, hierarchy, links, statuses and due dates, as the current user, to trace impact |
| `read:jira-user` | Resolve owners, reviewers and verifiers by account ID and check that they are active |
| `write:jira-work` | Apply one reviewed, authorized change to a Jira issue's due date. No other field is written |
| `read:page:confluence`, `read:space:confluence`, `read:confluence-content.summary` | Read selected PRD and lifecycle pages, as the current user, to map requirements and detect edits to their sections |
| `storage:app` | Store commitments, reviews, readiness gates, change signals and preferences in Forge SQL |
| `read:graph:issue:jira`, `read:graph:user:atlassian`, `read:graph:project:jira` | Teamwork Graph context for assigned work and project-scoped traversals |
| `read:graph:team:atlassian` | Show teams linked to the project as discovered context (never as a role) |
| `read:graph:goal:atlassian` | Show goals linked to supporting work as labelled planning context |
| `read:graph:deployment:external` | Show deployments linked to supporting work as candidate delivery evidence |
| `read:app-user-token` | Let the optional executor perform the reviewed Jira date change as the current user for that one invocation, without a broader app token |

### Remote hosts and data sent

| Host | Data sent | Why |
|---|---|---|
| **OWNER: production executor origin** (the test build uses `promisory-test.decionis.com`; do not list the test host for production) | Installation, cloud and principal identifiers; operation and proposal hashes; idempotency key; Jira issue ID; the issue's last-updated timestamp; the current and requested due dates; and, if configured, a within-slip-budget flag. No issue text, page content or Teamwork Graph data | Request institutional authorization and perform one enforced, allowlisted Jira due-date change, then reconcile its result |

---

## 8. Privacy & Security tab (draft answers)

Answers go live immediately when submitted, so have each one confirmed by the owner, who is accountable for them.

| # | Question | Draft answer |
|---|---|---|
| 1 | Stores End-User Data outside Atlassian? | **Yes**, only when the optional governed-change executor is enabled: Atlassian account ID of the requesting user; Jira cloud, installation and issue IDs; due-date values; operation records; encrypted authorization-claim material while finalization is pending |
| 2 | Processes End-User Data outside Atlassian? | **Yes**, same data as stored (tick "same as stored") |
| 3 | Logs End-User Data? | **OWNER/VERIFY.** Application code does not log request bodies, tokens or source content. Confirm the executor's structured events and the host's ingress logs before answering |
| 4 | Logs with End-User Data stored outside Atlassian? | **OWNER/VERIFY**, as for 3 |
| 5 | Exposes remote REST APIs for other tools? | **No.** Executor routes accept only signed Forge invocations from the bound installation. The `rovo:mcp` tools are served by Atlassian, not by the vendor |
| 6 | Integration permissions | Auto-filled by Atlassian |
| 7 | Scope justification | See §7 |
| 8 | Shares End-User Data with third parties? | **OWNER.** The authority service is the vendor's own (Decionis). The hosting provider (Microsoft Azure, Central US for the test executor) is a subprocessor; list its region and purpose |
| 9–10 | Shares logs with third parties / integral? | **OWNER/VERIFY** |
| 11 | Data residency | **OWNER.** Forge-stored data follows the platform; executor data is in one region. Choose "No, residency isn't supported" unless the production executor offers region choice |
| 12 | Residency migration | **No** |
| 13 | Retains data after uninstall? | **OWNER/VERIFY.** Forge storage follows the platform lifecycle; the executor journal and claim vault need a defined deletion period |
| 14 | Custom retention on request? | **Yes**: administrators set 30–365 days in the app, and other requests go through support |
| 15 | Privacy-enhancing technologies? | **Yes**: pseudonymization of closed Atlassian accounts (daily personal-data report); metadata-only change signals; no Teamwork Graph data leaves Atlassian; restricted records omitted from counts and exports |
| 16–19 | GDPR controller/processor; CCPA business/service provider | **OWNER/legal** |
| 20 | DPA | **OWNER/legal** |
| 21 | EEA transfers | **OWNER.** Depends on the executor and authority regions |
| 22 | Bug bounty | Auto-filled |
| 23–24 | Security contact, security policy | **OWNER** |
| 25 | CAIQ Lite | **No** (until completed) |
| 26 | Full-disk encryption at rest outside Atlassian | **Yes**, if production matches the test deployment: encrypted managed disk, plus AES-256-GCM sealing of claim material. Confirm for production |
| 27 | Accesses PATs, passwords or shared secrets? | **No** PATs or passwords. A short-lived current-user token supplied by Forge Remote is used in memory for one invocation and never stored. Confirm how Atlassian classifies this |
| 28 | Compliance certifications | **No** |
| 29 | Privacy policy link | **OWNER** |

The app is **not** eligible for "Runs on Atlassian", because of the optional remote executor. Do not claim it.

---

## 9. Reviewer notes (approval team)

```
Promisory reads Jira and Confluence as the current user and rechecks access for every view, answer and export.
To review:
1. Install, open Apps → Promisory, choose one project in Connections.
2. Create a commitment and link an issue; reopen a linked bug to see the change notice.
3. Ask the Promisory agent in Rovo "What threatens this commitment?"
The only write is a Jira due-date change. It requires an independent reviewer and the vendor's authorization service, which is configured per customer. Without that configuration, Apply is held by design.
Test account for the governed flow: <OWNER: provided privately>.
```

---

## 10. Pre-submission checklist

- [ ] Marketplace identity registered, separate from the judge and development apps; `release:check` passes
- [ ] Production executor host decided and declared; test host not listed
- [ ] Partner profile, support, documentation, privacy policy, EULA and DPA URLs live
- [ ] Logo, banner, three highlight screenshots and crops, and additional screenshots captured from the real app
- [ ] Privacy & Security answers confirmed by the owner (items marked OWNER/VERIFY)
- [ ] Pricing bands entered and verified in the partner calculator; licensing enabled only in the Marketplace profile
- [ ] Submit the listing and record the review-ticket URL in `docs/evidence/<release>/submission-links.md` (Codegeist Marketplace bonus)
