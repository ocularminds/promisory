# 0006 — Respect the installed Forge SQL and graph contracts

10 November 2026 · Accepted

The first actual installation exposed compatibility errors not represented by the initial synthetic adapter tests.

The native Teamwork Graph service requires operation names in `[company]_[operation]` form. A direct, read-only echo query on the dedicated test site failed with the old `PromisoryConnection` name and succeeded with `Promisory_Connection`. Both the connection probe and curated assigned-work query now use compliant names. This does not weaken object scopes, principal binding, provenance or unknown-result handling.

The installed `JiraWorkItem` graph type exposes nullable `summary`, not `title`. The curated query now requests `title: summary`; the parser accepts null summary/status fields and omits unnamed rows with incomplete coverage. Both native GraphiQL and the installed app accepted the corrected query. An empty assigned-work connection remains explicit incomplete context, never evidence that dependencies are absent.

The installation migration and configuration write succeeded, but the first configured workspace failed on a SELECT with `SQL_EXECUTION_ERROR`, `ER_WRONG_ARGUMENTS`, errno `1210`. The list statement used a bound `LIMIT`. Only a runtime-validated integer from 1 through 500 is now interpolated for this clause. Scope, kind, IDs, revisions and record bodies remain bound parameters. Tests reject strings, injection-shaped values, fractional values, infinities and out-of-range values before issuing SQL. No multi-statement transaction or broader query capability is introduced.

Operational diagnostics classify cross-realm errors by a fixed allowlist of names, SQL codes and code locations. They never log provider messages, query text, parameters, source bodies, credentials or arbitrary nested fields. Native SQL numeric error codes and operation categories help diagnose failures without exporting the data involved.

The real Rovo tool invocation also adds platform envelope fields outside the declared model inputs. The input adapter projects only the fields declared for that tool before strict command validation, and rejects supplied identity, policy and execution overrides. Opaque platform metadata, including `context` and `contextToken`, is neither decoded, logged, returned nor used as identity. Principal and installation authority still come only from Forge's trusted function context and `getAppContext()`. No undeclared field reaches the domain command. Fixed diagnostic stages distinguish input, context, workspace and response failures without recording the payload. Contract tests cover opaque envelope metadata, forged identities and attempted policy/executor overrides.

The private development app is set to **Not sharing**. Atlassian restricts access to app contributors. After explicit owner approval, the second test account received only the Viewer contributor role, with production-log access unchecked, for the two-user acceptance work. This does not confer Promisory approval roles or source permissions. Public distribution and production deployment remain separate release steps.

The live observations and installed-version record are in [test-site evidence](../evidence/2026-11-10-live-test-site/README.md). Atlassian references: [SQL execution](https://developer.atlassian.com/platform/forge/storage-reference/sql-api/), [SQL error shapes](https://developer.atlassian.com/platform/forge/storage-reference/sql-handling-errors/), [Teamwork Graph calls](https://developer.atlassian.com/platform/teamwork-graph/call-the-teamwork-graph-api/). The live service is the acceptance evidence for these compatibility details.
