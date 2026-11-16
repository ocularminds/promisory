# Judge and Marketplace distribution plan

16 November 2026 · Phase 4 of the [closure plan](../reviews/2026-11-16/gap-report.md). **No app was registered, deployed to production, listed or shared by this change.** Each step below that creates an identity, publishes a listing or shares a link needs the owner's explicit go-ahead.

## Constraint: governed execution is bound to one installation

The executor binds exactly one trusted installation (`PROMISORY_APP_ID`, environment, installation and cloud), and the DCI policy matches that installation's exact ARIs. A judge installing the **judge app** on their own site is therefore, by design, not bound to an authority tenant. Promisory fails closed: the review flow works, and **Apply** returns HELD, "Authorization unavailable". Everything else works on the judge's own data: change signals, impact, Rovo, Graph relations, PRD candidates, the ledger, slip assessment, cancel/supersede, and verification.

| Option | What judges experience | Cost / risk | Recommendation |
|---|---|---|---|
| **A. Judge app plus guest access to the test site** | Install the judge app anywhere for the full read, Rovo and lifecycle experience. For the successful governed write, sign in to the dedicated test site with provided judge accounts, where the reusable policy (valid to 31 Jan 2027) and executor are bound. | Two judge test accounts on the existing site; no new infrastructure | **Recommended.** Truthful, and shows HELD as well as SUCCEEDED |
| B. Executor serves several installations | The same executor and policy could cover installations known in advance | Code change plus one policy per judge site; judge cloud IDs are unknown, so it is impractical | Not for Codegeist |
| C. Judge profile without a remote | Read-only governed flow everywhere; "Runs on Atlassian" might become possible | Breaks the profile-equivalence rule (same executor capability in all profiles) and weakens the demo | No |

## Steps for option A (owner-run)

1. Register identities, without reusing any Decionis ID:
   ```sh
   cd apps/forge
   forge register --name "Promisory (judge)"        # copy the new app ARI
   forge register --name "Promisory"                # Marketplace identity
   ```
   Record all three ARIs in the ignored `release-identities.local.json` (schema: `scripts/release-profiles.ts`).
2. `npm run release:profiles && npm run release:check`. This refuses to reuse IDs, requires the same remote capability everywhere, and records the source digest per profile. Save `release/*/profile.json` as `judge-marketplace-equivalence.md` evidence.
3. Judge profile: `forge deploy -e production` from `release/judge`, then `forge install --upgrade` on a clean test site, then use the developer console to **share an installation link**. This works only for the unlicensed judge identity.
4. Fresh-install walkthrough on a clean site with a restricted second account: record time to the first evidence-linked finding (target < 10 minutes, spec §1).
5. Create two judge accounts on `decionis-promisory.atlassian.net` with the existing pilot project roles (owner and independent reviewer). Put the credentials in the Devpost "testing instructions" private field, never in the repository.
6. Update the Devpost App ID and installation link.

## Marketplace candidate (gap G6)

Submitting early secures a review-ticket URL, which the Marketplace bonus accepts.

| Listing field | Prepared content |
|---|---|
| Name / tagline | Promisory, "Keep every commitment connected." |
| Summary (outcome-led) | See which customer and launch promises a Jira change puts at risk, who must act, and whether the fix is allowed, then prove when you delivered. |
| Highlights | (1) Promise radar: blockers and PRD edits mapped to the commitments and stated value they threaten. (2) Governed recovery: exact, reviewed Jira date changes inside an agreed slip budget, with institutional authorization. (3) Proof of delivery: acceptance verified against the original promise, with regressions kept visible. |
| Hosting / data | Forge (Atlassian-hosted) plus an **optional** external executor that receives only the independently authored due-date intent and the Jira date snapshot. Not "Runs on Atlassian". Graph data never leaves Atlassian. See [privacy and data handling](privacy-and-data-handling.md). |
| Licensing | `licensing.enabled: true` only in the Marketplace profile. Jira is required and Confluence optional, so the app must be a **paid** listing (multi-app free listings are unsupported); set a trial and verify billing terms before choosing a price. |
| Screenshots | From the real app on the test site: overview with ledger and What changed, issue panel impact, Rovo PRD → candidates, review with slip assessment (HELD and SUCCEEDED), outcome verification. Do not use prototype images. |
| Vendor, support URL, privacy URL | **Owner to supply.** Do not invent. |
| Reviewer instructions | Option A steps 5–6, plus how to enable the optional executor and the MCP Connected-apps toggle |

Submission sequence: Marketplace profile `forge deploy -e production`, then the developer console listing form (vendor details, screenshots, privacy, support), then submit, then record the review-ticket URL in `docs/evidence/<release>/submission-links.md`.
