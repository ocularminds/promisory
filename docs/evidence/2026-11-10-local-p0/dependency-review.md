# Dependency audit review

10 November 2026. `npm audit --omit=dev --json` reports **10 affected dependency entries: 6 moderate, 4 high, 0 critical** after the ProseMirror patch. These are transitive entries, not ten independent root vulnerabilities. The full development tree also contains Forge CLI/tooling advisories. No automatic major-version downgrade or incompatible Zod override was applied.

| Root advisory | Installed dependency path | Treatment |
|---|---|---|
| [ProseMirror paste XSS](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w) | Forge bridge → Atlaskit → `prosemirror-view` | Compatible override to 1.42.3; confirmed deduplicated and removed from production audit |
| [Zod constrained-collection memory exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | AgentSafe SDK → `@decionis/presence-types` → Zod v3 | Unresolved upstream compatible update. Root application schemas use patched Zod 4.6.7. Remote and command bodies are bounded before schema parsing; this is mitigation, not proof of a patched SDK dependency |
| [Glob cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | Forge dependency tree | Unresolved compatible upstream update; do not introduce an untested major override |
| [Minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) | Forge dependency tree | Unresolved compatible upstream update; no user glob patterns are accepted by Promisory |

The [sanitized audit response](production-audit.json) preserves the dependency paths and advisory metadata.

No production deployment was performed. Before release, reassess current advisories and reachable use, obtain compatible upstream fixes where possible, rerun packaging/runtime tests and record the release owner's disposition. A passing local functional suite is not a clean dependency audit.
