# Local implementation evidence

10 November 2026 · candidate 0.1.0 · **local/example and synthetic contract evidence only**.

No Promisory app was installed, and no live Jira/Confluence mutation or live Decionis grant was executed. `LocalAuthority` is the pinned SDK's loopback test authority; passing those tests does not establish a hosted policy or gateway deployment. The Forge runtime wrapper was fetched for packaging, which does not install the app.

## Checks

| Check | Result and scope |
|---|---|
| Strict TypeScript | Passed across frontend, domain, adapters, remote, scripts and tests |
| Domain and contract suite | 62 tests passed across 11 files: schemas/date zones, CAS/tenant isolation, hierarchy/impact, lifecycle/history/outcome, inbox, REST/graph adapters, shared Rovo tools, release guards, FIT/HMAC, grant/dispatch/finalization and encrypted vault; final pass recorded in [verification.json](verification.json) |
| Browser behavior | Eight scenarios passed, covering example/live separation, role/search filters, preserved invalid forms, owner acceptance, independent review/held action, PRD drift, native hierarchy, embedded context, accessibility and reflow |
| Accessibility | Axe WCAG A/AA scans on desktop, 390 px and the commitment dialog; explicit error focus, Escape restoration and Tab wrap checked |
| 200% reflow | 720×500 CSS viewport at device scale 2 for a 1440×1000 physical surface; submit control asserted inside the viewport. This emulates reflow; native browser zoom and screen-reader use remain installed acceptance tasks |
| UI build | Vite production bundle generated; largest JavaScript chunk 522.54 KB (151.65 KB gzip). Vite reports its standard >500 KB warning; installed load performance remains unmeasured |
| Remote build | Vite SSR Node 22 entry generated; missing server configuration fails closed |
| Forge offline manifest | Schema/modules/resources validate; no app registration lookup is implied |
| Forge backend bundle | Actual CLI 15.1.0 / bundler 7.3.2 packaged resolver, events and Rovo entry points; see [bundle record](forge-bundle.json) |
| Release equivalence | Offline profile contract passes; real IDs, generated installed profiles and sharing links are pending |
| Phase 0 inventory | [Sanitized runtime/capability record](phase0.json): authenticated CLI, unregistered app, missing tenant/remote prerequisites |
| Dependency audit | ProseMirror override applied; remaining upstream issues are recorded in [dependency review](dependency-review.md) |

The final command outputs and generated asset digests are captured in [verification.json](verification.json) and [versions-and-build-hashes.json](versions-and-build-hashes.json). No remote CI result is claimed.

## Corrected failures

The initial browser launch could not find the pinned headless-shell binary. Its CDN download then failed with TLS connection resets. The local suite uses installed **Google Chrome 157.0.8103.40**, explicitly selected with `PROMISORY_BROWSER_CHANNEL=chrome`; CI remains configured for pinned Playwright Chromium.

Real browser rendering exposed a React 19/18 mismatch with Forge dependencies. React and React DOM were aligned at 18.3.1. Subsequent checks fixed a hidden mobile project label, status-icon/text styling, narrow-table clipping, owner/deadline visibility and keyboard wrap in long dialogs. A hierarchy test initially assumed there was no task-to-story path; the fixture correctly had an explicit `IMPLEMENTS` link. The test now separates containment from that valid typed dependency.

Forge backend packaging initially used its default legacy/CommonJS TypeScript configuration, so workspace exports and the ESM SDK failed to resolve. The app-specific ESNext/bundler TypeScript configuration fixed actual Forge packaging. This failure was invisible to the root no-emit check.

## Visual evidence

All images below show the real implemented UI with visibly fictional example records. They are not installed-tenant evidence.

- [Desktop workspace](desktop.png)
- [390 px workspace](mobile.png)
- [Mobile commitment form](mobile-form.png) and [reachable final controls](mobile-form-bottom.png)
- [200% equivalent form reflow](zoom-200-form.png)
- [Independent review and held action](held-review.png)
- [PRD drift and stale gate applicability](requirement-drift.png)
- [Native work map](work-map.png)
- [Confluence macro example context](confluence-macro-example.png)

## Still unverified

The selected site's real hierarchy, two-user ACL behavior, SQL migration, Rovo invocation context and answer quality, graph query eligibility, FIT module/API-base formats, one held and one successful external action, trusted observer reconciliation, entitlement/uninstall lifecycle, performance/cost and judge/Marketplace installation remain open. Follow [live acceptance](../../runbooks/live-acceptance.md); no fixture can close those gates.
