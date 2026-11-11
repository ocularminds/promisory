import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertForgeBuildConfig,
  writeForgeBuildConfig,
} from "../../scripts/forge-build-config";

const temporaryDirectories: string[] = [];
async function appDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "promisory-build-contract-"));
  temporaryDirectories.push(directory);
  await mkdir(join(directory, "src"));
  return directory;
}
afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Forge executor packaging boundary", () => {
  it.each([false, true])(
    "rejects a manifest/build capability mismatch when the generated remote is %s",
    async (enabled) => {
      const directory = await appDirectory();
      await writeForgeBuildConfig(directory, enabled);
      await expect(
        assertForgeBuildConfig(directory, enabled),
      ).resolves.toBeUndefined();
      await expect(assertForgeBuildConfig(directory, !enabled)).rejects.toThrow(
        "declared remote capability differ",
      );
    },
  );

  it("rejects an enabled executor excluded from linting or a changed entry binding", async () => {
    const directory = await appDirectory();
    await writeForgeBuildConfig(directory, true);
    const config = JSON.parse(
      await readFile(join(directory, "tsconfig.json"), "utf8"),
    );
    config.exclude.push("optional");
    await writeFile(join(directory, "tsconfig.json"), JSON.stringify(config));
    await expect(assertForgeBuildConfig(directory, true)).rejects.toThrow(
      "declared remote capability differ",
    );
    await writeForgeBuildConfig(directory, false);
    await writeFile(
      join(directory, "src/remote.ts"),
      'export { configuredExecutor } from "../optional/remote";\n',
    );
    await expect(assertForgeBuildConfig(directory, false)).rejects.toThrow(
      "declared remote capability differ",
    );
  });
});
