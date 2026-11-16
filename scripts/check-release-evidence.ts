/**
 * Check a release evidence folder against the implementation plan §7 layout,
 * and scan it for credential-shaped text. Read-only; prints a JSON report.
 * Usage: npx tsx scripts/check-release-evidence.ts docs/evidence/<release-id>
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export const REQUIRED_EVIDENCE = [
  "capability-matrix.md",
  "versions-and-build-hashes.json",
  "installation-walkthrough.md",
  "permission-test-results.md",
  "hierarchy-and-impact-results.md",
  "lifecycle-requirement-and-gate-results.md",
  "graph-query-evidence.json",
  "rovo-evaluation-results.md",
  "execution-and-reconciliation-results.md",
  "accessibility-results.md",
  "data-egress-review.md",
  "judge-marketplace-equivalence.md",
  "submission-links.md",
] as const;

const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ["bearer-token", /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/],
  ["github-token", /\bgh[opsu]_[A-Za-z0-9]{20,}/],
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["atlassian-api-token", /\bATATT[A-Za-z0-9_-]{20,}/],
  [
    "generic-secret-assignment",
    /\b(api[_-]?key|secret|password)\s*[:=]\s*["']?[A-Za-z0-9_\-]{24,}/i,
  ],
];

export async function checkEvidence(folder: string) {
  const present = new Set<string>();
  const empty: string[] = [];
  const findings: Array<{ file: string; pattern: string }> = [];
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else {
        const name = relative(folder, path);
        present.add(name);
        if ((await stat(path)).size === 0) empty.push(name);
        if (/\.(md|json|txt|ya?ml)$/i.test(name)) {
          const text = await readFile(path, "utf8");
          for (const [label, pattern] of SECRET_PATTERNS)
            if (pattern.test(text))
              findings.push({ file: name, pattern: label });
        }
      }
    }
  };
  await walk(folder);
  const missing = REQUIRED_EVIDENCE.filter((f) => !present.has(f));
  return {
    folder,
    complete: missing.length === 0 && empty.length === 0,
    missing,
    empty,
    credentialFindings: findings,
    passed: missing.length === 0 && empty.length === 0 && findings.length === 0,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const folder = process.argv[2];
  if (!folder || !/^docs\/evidence\/[a-z0-9-]+\/?$/.test(folder)) {
    process.stderr.write(
      "Usage: check-release-evidence.ts docs/evidence/<release-id>\n",
    );
    process.exit(2);
  }
  const report = await checkEvidence(folder);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}
