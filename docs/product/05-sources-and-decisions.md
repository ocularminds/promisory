# Promisory · Sources, assumptions, and decisions
**Reviewed 10 November 2026**

## How to read this record

Platform facts below were checked against official Atlassian/Devpost sources. Product features, targets, architecture choices, schedules, and prices not established by those sources are proposals. Live tenant availability and actual deployed gateway behavior were not tested during this documentation task.

The supplied contracts are proposed Promisory contracts. They are not representations of undiscovered Atlassian or Decionis endpoints. The documentation and visual prototype are deliverables; no product implementation, Marketplace publication, or external message sending was performed.

## Official references

| Ref | Source | Design implication |
|---|---|---|
| S01 | [Codegeist rules](https://codegeist2026.devpost.com/rules) | Forge requirement, current dates, new/existing project conditions, installation/video requirements, and bonus eligibility |
| S02 | [Codegeist overview](https://codegeist2026.devpost.com/) | Five equally weighted core judging criteria and three category choices |
| S03 | [Jira work hierarchy](https://support.atlassian.com/jira-cloud-administration/docs/configure-the-issue-type-hierarchy) | Standard work types share a level; discover actual tenant hierarchy |
| S04 | [App compatibility](https://developer.atlassian.com/platform/forge/app-compatibility/) | Required Jira / optional Confluence, same-site operation, current paid-listing constraint |
| S05 | [Forge distribution](https://developer.atlassian.com/platform/forge/distribute-your-apps/) | Separate unlicensed judge copy once Marketplace submission/licensing affects sharing |
| S06 | [Rovo agent](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent/) | Implement a real agent module and supported access pattern |
| S07 | [Rovo action](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/) | Shared function-backed tools and trusted invocation context |
| S08 | [Rovo MCP](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/) | Optional rovo:mcp module, action references, admin enablement, Preview status |
| S09 | [Graph API overview](https://developer.atlassian.com/platform/teamwork-graph/api-reference/overview/) | Preview API; use supported query mechanisms |
| S10 | [Curated queries](https://developer.atlassian.com/platform/teamwork-graph/curated-queries/) | Discover current typed queries and paginate; no invented graph edge schema |
| S11 | [Call Teamwork Graph](https://developer.atlassian.com/platform/teamwork-graph/call-the-teamwork-graph-api/) | User-context invocation, required object scopes, schema validation |
| S12 | [Graph scopes](https://developer.atlassian.com/platform/teamwork-graph/scopes/) | Read-only API scopes and normal user access still apply |
| S13 | [Graph limitations](https://developer.atlassian.com/platform/teamwork-graph/limitations-and-considerations/) | Supported installations, org-admin graph access, egress considerations |
| S14 | [Forge Remote essentials](https://developer.atlassian.com/platform/forge/remote/essentials/) | Verify FIT identity and never disclose OAuth tokens |
| S15 | [Remote API calls](https://developer.atlassian.com/platform/forge/remote/calling-product-apis/) | Use supported user/system context and trusted API base URL |
| S16 | [Remote manifest reference](https://developer.atlassian.com/platform/forge/manifest-reference/remotes/) | Token configuration differs by invocation surface |
| S17 | [Forge listing guide](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/) | Prepare actual Marketplace fields, reviewer access, and license behavior |
| S18 | [Runs on Atlassian](https://developer.atlassian.com/platform/forge/runs-on-atlassian/) | Do not claim a no-egress badge for a hybrid business-data path |
| S19 | [Native change-risk assessment](https://support.atlassian.com/jira-service-management-cloud/docs/assess-potential-risks-to-your-changes-with-rovo-ops/) | Differentiate through commitment applicability and verified outcomes |
| S20 | [Customer service context](https://www.atlassian.com/collections/service/guides/customer-service-management) | Differentiate explicit commitments and their fulfillment beyond shared context |
| S21 | [Google Fonts repository](https://github.com/google/fonts) | Source for packaged Manrope, Inter, and IBM Plex Mono fonts and licenses |
| S22 | [Custom hierarchy levels](https://support.atlassian.com/jira-software-cloud/docs/configure-custom-hierarchy-levels-in-advanced-roadmaps/) | Native above-epic configuration depends on Jira Premium/Enterprise and admin setup |
| S23 | [Product requirements template](https://www.atlassian.com/software/confluence/templates/product-requirements?category=services) | PRD source structure, objectives, requirements, and linked Jira work |
| S24 | [Product roadmap template](https://www.atlassian.com/software/confluence/templates/product-roadmap/) | Roadmap context and schedule associations are distinct from work hierarchy |
| S25 | [Project lifecycle templates](https://www.atlassian.com/software/confluence/templates/collections/project-management) | Project plans, decision records, delivery updates, and retrospectives |
| S26 | [Product management templates](https://www.atlassian.com/software/confluence/templates/collections/product-managers) | Recommended Confluence artifacts spanning product discovery through launch |

When current documentation, the live schema, and an old example disagree, record the discrepancy and use the supported current behavior. Do not rely on old community answers that say all multi-product Marketplace apps are unsupported.

## Existing project audit

Source files were read from the user's local repositories. The exact file hashes, observed repository HEAD values, and modified-file flags are recorded in [source-audit.json](contracts/source-audit.json). A HEAD value is context; the file hash identifies the actual working-tree text read.

| Foundation | Reviewed source | Finding |
|---|---|---|
| Decionis | README.md | Policy/authority and signed-record responsibilities |
| Decionis | apps/api/src/routes/AtlassianRoutes.ts | Evaluation route returns decision metadata and dossier links; no grant field in the reviewed response |
| Decionis | docs/marketplace/atlassian/forge-starter-kit/src/index.js | Existing resolver passes request fields and returns configuration including the API key; do not carry that pattern into Promisory |
| Decionis | docs/marketplace/atlassian/forge-starter-kit/manifest.yml | Existing app identity and runtime; create a distinct Promisory app identity |
| AgentSafe | README.md | Exact-request boundary and authority-provider separation |
| AgentSafe | docs/gateway/deployment.md | That guide's reviewed deployment revision describes the managed gateway as shadow-only; verify current runtime before enforcing |
| Steward | README.md and Architecture.md | Evidence collection, scoped review, and presentation boundary |
| Steward | domain/opportunities/CustomerOpportunity.ts | Useful typed review/evidence patterns; customer account types need a new delivery domain |

No edits were made to these repositories during this task.

## Architecture decisions

| ID | Decision | Reason |
|---|---|---|
| ADR-001 | Preserve Jira hierarchy; add typed dependencies | Matches real platform semantics and the desired top-down/bottom-up trace |
| ADR-002 | One accountable owner, multiple explicit stakeholders | Avoid ambiguous responsibility and accidental authority inheritance |
| ADR-003 | Separate agreement lifecycle, health, action execution, and fulfillment | A green ticket or approved review does not prove a delivered promise |
| ADR-004 | Forge-first UI, storage, Rovo, and graph | Platform integration is central to the product and competition |
| ADR-005 | Keep graph results and derived context within Atlassian | Respect access/egress boundaries and avoid a duplicate unrestricted corpus |
| ADR-006 | Reuse external authority only through a verified adapter | Existing evaluation output alone is insufficient for live execution |
| ADR-007 | One governed mutation in P0 | Prove the complete loop before adding external communications and commercial remedies |
| ADR-008 | Two app identities from one release | Preserve judge installation alongside Marketplace submission/licensing |
| ADR-009 | Azure blue and navy vector identity with locally packaged fonts | Consistent, editable, accessible design across small product surfaces |
| ADR-010 | No employee ranking or inferred management authority | Keep the product focused on commitments, evidence, and process |
| ADR-011 | Explicit unknown and reconciliation states | Avoid false health and duplicate external writes |
| ADR-012 | Core criterion quality before additional bonus modules | Bonus eligibility does not guarantee an award or compensate for an unreliable product |

## Open questions for Phase 0

1. Which exact Jira scopes, graph object scopes, and Rovo entitlements are available in the development and judge tenants?
2. Which curated graph fields return useful team/work evidence in those tenants?
3. Which version-pinned AgentSafe deployment supports the required enforcement behavior?
4. What exact Decionis provider contract returns, claims, and finalizes the grant for the Jira request?
5. Does the selected Jira endpoint support a usable atomic source precondition? If not, what residual race behavior must be disclosed and tested?
6. Which independent action fields and REST evidence can be sent to the remote authority under the declared data policy?
7. Which Forge storage operations provide the required single-aggregate concurrency guarantees?
8. Which existing support, privacy, and legal business details should be used in the real listing?
9. Which test team will provide the first measured baseline and usability evidence?

These are implementation validation tasks. The specification deliberately does not invent credentials, unavailable endpoints, guaranteed API consistency, or business results.

## Visual asset provenance

The Connected Loop logo is an original geometric SVG identity created for this package. PNG previews derive from those vector files. The wordmark is based on the packaged Manrope font; font licenses are included. The connected image-generation service returned an unavailable-tool error, so no generated-image output is claimed.

The interface prototype is locally authored HTML/CSS/JavaScript using fictional fixtures. Its Rovo response and review interaction are explicitly identified as examples. It makes no network calls to Atlassian or Decionis.


## Additional lifecycle decisions

- **ADR-013:** Product lifecycle phases, planning relationships, document organization, and native Jira ancestry are independent dimensions.
- **ADR-014:** Read existing above-epic configuration; use labelled planning links when it is absent. Never alter site-wide hierarchy during installation.
- **ADR-015:** Bind Confluence requirements and readiness reviews to exact source versions. A changed requirement triggers reassessment; readiness never replaces execution authority.
- **ADR-016:** Treat delivery, release, adoption, operation, and retirement outcomes as separately evidenced agreements. Roll up unique commitments and coverage, not incompatible units.
