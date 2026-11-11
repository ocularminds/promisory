import {
  readFile,
  readdir,
  lstat,
  mkdir,
  mkdtemp,
  writeFile,
  stat,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";

// Explicit source boundary: no evidence, documents, fixtures, .env or Git state.
const files = [
  ".dockerignore",
  ".npmrc",
  "package.json",
  "package-lock.json",
  "apps/forge/package.json",
  "apps/remote/package.json",
  "apps/remote/Dockerfile",
  "apps/remote/vite.config.ts",
  ...[
    "contracts",
    "design-system",
    "domain",
    "integrations-atlassian",
    "integrations-decionis",
    "test-fixtures",
  ].map((name) => `packages/${name}/package.json`),
];
async function sourceFiles(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Build source symlink refused: ${path}`);
    if (entry.isDirectory()) await sourceFiles(path);
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
    else throw new Error(`Unexpected remote build source: ${path}`);
  }
}
for (const root of [
  "apps/remote/src",
  "packages/contracts/src",
  "packages/domain/src",
  "packages/integrations-decionis/src",
])
  await sourceFiles(root);
files.sort();
const contents = await Promise.all(
  files.map(async (path) => {
    if (!(await lstat(path)).isFile())
      throw new Error(`Build input is not a regular file: ${path}`);
    const bytes = await readFile(path);
    return {
      path,
      bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }),
);
const manifest = contents.map(({ path, bytes, sha256 }) => ({
  path,
  bytes: bytes.length,
  sha256,
}));
const sourceSha256 = createHash("sha256")
  .update(JSON.stringify(manifest))
  .digest("hex");
await mkdir("release", { recursive: true });
const directory = await mkdtemp(
  `release/remote-build-${sourceSha256.slice(0, 12)}-`,
);
await mkdir(`${directory}/context`, { recursive: true });
for (const { path, bytes } of contents) {
  const destination = `${directory}/context/${path}`;
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
}
execFileSync(
  "tar",
  ["-czf", `${directory}/context.tgz`, "-C", `${directory}/context`, ...files],
  { stdio: "pipe" },
);
const archiveSha256 = createHash("sha256")
  .update(await readFile(`${directory}/context.tgz`))
  .digest("hex");
const report = {
  schemaVersion: "promisory.remote-build-source.v1",
  generatedAt: new Date().toISOString(),
  sourceSha256,
  archiveSha256,
  archiveBytes: (await stat(`${directory}/context.tgz`)).size,
  fileCount: manifest.length,
  files: manifest,
  containerImageBuilt: false,
  registryPushed: false,
};
await writeFile(
  `${directory}/manifest.json`,
  `${JSON.stringify(report, null, 2)}\n`,
);
await mkdir("release/azure-test-review", { recursive: true });
await writeFile(
  "release/azure-test-review/build-source-path.txt",
  `${directory}\n`,
);
console.log(
  JSON.stringify({
    directory,
    sourceSha256,
    archiveSha256,
    fileCount: report.fileCount,
    archiveBytes: report.archiveBytes,
  }),
);
