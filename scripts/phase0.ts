import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const root = resolve(import.meta.dirname, "..");
const lock = JSON.parse(
  await readFile(join(root, "package-lock.json"), "utf8"),
);
const manifest = parse(
  await readFile(join(root, "apps/forge/manifest.yml"), "utf8"),
);
function command(file: string, args: string[]) {
  try {
    return {
      ok: true,
      output: execFileSync(file, args, {
        cwd: root,
        timeout: 30_000,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch {
    return { ok: false, output: "" };
  }
}
const cli = join(root, "node_modules/.bin/forge");
const auth = command(cli, ["whoami"]);
const cliVersion = command(cli, ["--version"]);
const report = {
  recordedAt: new Date().toISOString(),
  mode: "LOCAL_PREREQUISITE_CHECK_ONLY",
  versions: {
    node: process.versions.node,
    npm: command("npm", ["--version"]).output,
    forgeCli: cliVersion.output.match(/\d+\.\d+\.\d+/)?.[0] ?? "UNAVAILABLE",
    ...Object.fromEntries(
      [
        "@forge/api",
        "@forge/bridge",
        "@forge/resolver",
        "@forge/sql",
        "@forge/manifest",
        "@decionis/agent-safe-pipeline",
        "react",
        "react-dom",
      ].map((name) => [
        name,
        lock.packages[`node_modules/${name}`]?.version ?? "UNAVAILABLE",
      ]),
    ),
  },
  forgeAuthentication: auth.ok ? "AUTHENTICATED_CLI_ONLY" : "UNAVAILABLE",
  appIdentity: /^ari:cloud:ecosystem::app\/[0-9a-f-]{36}$/i.test(
    manifest.app.id,
  )
    ? "UUID_PRESENT_UNVERIFIED"
    : "NOT_REGISTERED",
  credentialsPresentOnly: Object.fromEntries(
    [
      "ATLASSIAN_SITE",
      "PROMISORY_APP_ID",
      "PROMISORY_AUTHORITY_URL",
      "PROMISORY_AUTHORITY_API_KEY",
      "PROMISORY_EFFECT_OBSERVER_ID",
      "PROMISORY_REMOTE_SIGNING_KEY",
      "PROMISORY_INSTALLATION_ID",
    ].map((name) => [name, Boolean(process.env[name])]),
  ),
  capabilities: [
    [
      "Jira current-user read and due-date permission",
      "NOT_RUN",
      "A selected Jira test site and installed Promisory identity are required.",
    ],
    [
      "Confluence connected page access",
      "NOT_RUN",
      "Connect Confluence and use two users with different page access.",
    ],
    [
      "Teamwork Graph current-user query",
      "NOT_RUN",
      "Install the declared graph scopes and verify result, denial, partial and unavailable cases.",
    ],
    [
      "Rovo agent and shared actions",
      "NOT_RUN",
      "Enable Rovo in the selected site and validate installed action context.",
    ],
    [
      "Forge current-user remote invocation",
      "NOT_RUN",
      "An HTTPS remote and verified FIT installation binding are required.",
    ],
    [
      "Decionis authority and bound grant",
      "NOT_RUN",
      "A test organization, authority credentials and configured policy are required; local SDK contracts are separate evidence.",
    ],
    [
      "AgentSafe enforced dispatch and reconciliation",
      "NOT_RUN",
      "Verify enforcement and trusted effect-observer provenance on the configured authority before enabling writes.",
    ],
    [
      "Marketplace and judge installation",
      "NOT_RUN",
      "Register distinct identities and verify current multi-app distribution eligibility and installation URLs.",
    ],
  ].map(([capability, status, prerequisite]) => ({
    capability,
    status,
    prerequisite,
  })),
  limitations: [
    "CLI authentication is not tenant installation.",
    "No credential, account email, OAuth token, API response body, or local signing material is included.",
    "Offline manifest and fixture tests are recorded separately from live evidence.",
  ],
};
const directory = resolve(
  process.argv[2] ?? join(root, "docs/evidence/2026-11-10-local-p0"),
);
await mkdir(directory, { recursive: true });
await writeFile(
  join(directory, "phase0.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
