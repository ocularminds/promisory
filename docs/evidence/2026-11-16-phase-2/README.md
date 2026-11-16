# Phase 2 local evidence · 16 November 2026

Mode: **local contract and fixture tests only**. No live tenant observation is claimed here.

| Area | Evidence |
|---|---|
| Change signals | `tests/domain/changes.test.ts`: metadata-only parsing (no values, summaries or actors), nested and top-level issue-link shapes, hostile IDs rejected, coalescing, 7-day pruning, 200-signal cap, restricted link non-disclosure, change→commitment join, a single inbox `CHANGE` notice, closed commitments excluded |
| Graph relations | `tests/contracts/graph-relations.test.ts`: tier fallback and recording, member ARI mapping, hostile issue IDs never queried, explicit FAILED and coverage notes. `tests/domain/graph-relations.test.ts`: access-checked command; a restricted supporting item makes the commitment unavailable |
| MCP | `tests/contracts/mcp.test.ts`: one `rovo:mcp` server exposing only `GET` tools on `rovo.mcp*` handlers, and an external projection that removes graph data, graph sources and Rovo-origin proposals |
| Suite | `npm run check`: **157 tests in 25 files**, builds, manifest validation, Forge bundle, offline release equivalence. `forge lint` (CLI 15.1.0): no errors; one expected `MAJOR_VERSION_RULE` approval for the added graph scopes |

## Live acceptance still required
1. `forge deploy -e development`, then an administrator approves the upgrade (new scopes and MCP module).
2. Edit a bug on a commitment's path and add a Blocks link. Record event-to-notice latency from the inbox `Change observed` time and the first refresh showing it.
3. Open a commitment with supporting work and record `graph.relations` `selections` and coverage as `graph-query-evidence.json`. The selection tiers reveal the tenant's actual node types.
4. Enable MCP exposure under Connected apps, connect a client to `https://mcp.atlassian.com/forge/6e0430ce-9c00-425a-80c2-97b5cec1e8ae`, invoke `promisory-mcp-commitments`, and confirm the response contains no graph fields.
