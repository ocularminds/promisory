# ADR 0002 · Single-aggregate storage and current-user views

Accepted for the local candidate, 10 November 2026.

Forge SQL stores versioned aggregates in one table. Each insertion or revision is one SQL statement, with `UPDATE ... WHERE revision = ?` for optimistic concurrency. A commitment's versions, reviews and operations share an aggregate so claiming an operation cannot silently overwrite a concurrent review. No multi-statement transaction or database lock is held across a remote call. This matches the documented [Forge SQL constraints](https://developer.atlassian.com/platform/forge/storage-reference/sql/).

The scope hash binds app, environment, installation and cloud; principals share records only through authorized services. The backend derives identity from Forge handler/runtime context. UI `view.getContext()` values select a presentation surface and never authorize access. Every workspace, direct record lookup, action and Rovo answer refetches current native source access. Historical agreement and proposal references are checked too. Project mutation responses return only a revision and record ID, then the UI refreshes an authorized view.

Source adapters are constructed per invocation/principal. Their memoization never becomes a shared cache. Full Confluence bodies are used transiently for fingerprints and are not stored. Teamwork Graph rows are filtered to the selected visible Jira work scope. Empty or partial results remain incomplete. Deletions and moved/restricted sources cannot expand access through old records.

Limits are explicit: 1,000 Jira work items per project import, 100 assigned graph items, 200 commitment aggregates per workspace, traversal depth 10/nodes 500/paths 100 per start and 500 retained paths per assessment, 800 KB maximum aggregate. Narrow the pilot before these limits. Durable event markers currently support invalidation diagnostics; foreground views refetch every 60 seconds. No measured event-latency or full retention guarantee is claimed.

Only `promisory.v1` is supported. Additive v1 fields have fail-closed defaults; notably missing proposal origin becomes `ATLASSIAN_ONLY`. Unknown schema versions are rejected, rather than silently cast into current types. A future schema bump requires an explicit migration and corresponding historical-access tests.
