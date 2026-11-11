# ADR 0001 · Runtime, workspace and frontend compatibility

Accepted for the local candidate, 10 November 2026.

Use a TypeScript npm workspace, Node 22.23.4, npm 10.9.9 and the committed lockfile. The repository initially contained a product package rather than an application toolchain. The package's suggested pnpm layout was illustrative; the local pnpm/Corepack configuration referenced an unavailable version. npm already worked and avoids introducing another package manager. Node was installed through fnm without changing the user's default runtime.

Forge CLI 15.1.0, API 8.5.0, bridge 7.3.0, resolver 2.0.2 and SQL 4.0.10 are pinned. Forge currently supports Node 22; the manifest declares `nodejs22.x`. [Runtime reference](https://developer.atlassian.com/platform/forge/function-reference/nodejs-runtime/).

React and React DOM are pinned together at 18.3.1. The first real browser run revealed an incompatible mixed React 19/18 dependency tree from Forge/Atlaskit, despite static checks passing. Aligning with the installed Forge peer dependencies and deduplicating restored rendering. Vite explicitly deduplicates React and React DOM. A compatible `prosemirror-view` 1.42.3 override resolves the installed paste-XSS advisory; remaining upstream advisories are documented separately.

Use local brand SVGs, semantic tokens, local fonts with preserved licenses, semantic tables/forms and native dialogs with explicit keyboard wrap. Example data is a separate opt-in client, never a live error fallback. Production platform acceptance remains independent of local browser success.

Forge's own bundler initially used a default CommonJS/legacy TypeScript configuration, which could not resolve the workspace's TypeScript exports or the ESM-only AgentSafe SDK. `apps/forge/tsconfig.json` now extends the strict workspace configuration and enables ESNext emission for Forge's loader. The actual Forge backend bundler passes with this configuration; the ordinary no-emit workspace check alone did not establish deployable packaging.
