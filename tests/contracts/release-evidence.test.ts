import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkEvidence,
  REQUIRED_EVIDENCE,
} from "../../scripts/check-release-evidence";

describe("release evidence check", () => {
  it("reports missing and empty files and credential-shaped text", async () => {
    const dir = await mkdtemp(join(tmpdir(), "promisory-evidence-"));
    await writeFile(join(dir, "capability-matrix.md"), "Jira: AVAILABLE\n");
    await writeFile(join(dir, "submission-links.md"), "");
    await mkdir(join(dir, "nested"));
    await writeFile(
      join(dir, "nested", "log.txt"),
      "authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789\n",
    );
    const report = await checkEvidence(dir);
    expect(report.passed).toBe(false);
    expect(report.missing).toContain("rovo-evaluation-results.md");
    expect(report.missing).not.toContain("capability-matrix.md");
    expect(report.empty).toEqual(["submission-links.md"]);
    expect(report.credentialFindings).toEqual([
      { file: join("nested", "log.txt"), pattern: "bearer-token" },
    ]);
  });
  it("passes a complete, clean folder", async () => {
    const dir = await mkdtemp(join(tmpdir(), "promisory-evidence-"));
    for (const file of REQUIRED_EVIDENCE)
      await writeFile(join(dir, file), "sanitized evidence\n");
    expect((await checkEvidence(dir)).passed).toBe(true);
  });
});
