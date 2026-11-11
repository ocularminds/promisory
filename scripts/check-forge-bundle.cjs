// Package the backend with the exact bundler installed by Forge CLI. This uses
// Atlassian's runtime-wrapper CDN, but never registers, deploys, or installs.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { createHash } = require("node:crypto");
const cliRequire = createRequire(require.resolve("@forge/cli/package.json"));
const { getNodeBundler, getWrapperProvider } = cliRequire("@forge/bundler");
const { FileSystemReader } = cliRequire("@forge/cli-shared");
const { parse } = require("yaml");
const root = path.resolve(__dirname, "..");
const appDirectory = path.join(root, "apps/forge");
const manifest = parse(
  fs.readFileSync(path.join(appDirectory, "manifest.yml"), "utf8"),
);
const entryPoints = [
  ...new Set(manifest.modules.function.map((f) => f.handler.split(".")[0])),
].map((module) => ({
  name: module,
  path: path.join(appDirectory, "src", module),
}));
const logger = {
  debug: () => {},
  info: () => {},
  warn: (message) => process.stderr.write(`${message}\n`),
  error: (message) => process.stderr.write(`${message}\n`),
};
process.chdir(appDirectory);
getNodeBundler(
  logger,
  getWrapperProvider({ fileSystemReader: new FileSystemReader() }),
  { readConfig: async () => manifest },
)
  .bundle({ appDirectory, entryPoints })
  .then((result) => {
    const report = {
      mode: "FORGE_BUNDLE_ONLY",
      success: true,
      cliVersion: cliRequire("@forge/cli/package.json").version,
      bundlerVersion: cliRequire("@forge/bundler/package.json").version,
      runtimeWrapper: JSON.parse(
        result.additionalOutputs.get("runtime.json").toString(),
      ),
      entryPoints: entryPoints.map((e) => ({
        name: e.name,
        sha256: createHash("sha256")
          .update(fs.readFileSync(path.join(result.outputDir, `${e.name}.cjs`)))
          .digest("hex"),
      })),
      installation: "NOT_VERIFIED",
      recordedAt: new Date().toISOString(),
    };
    const evidence = path.resolve(
      root,
      process.env.PROMISORY_EVIDENCE_DIR ?? "docs/evidence/2026-11-10-local-p0",
    );
    fs.mkdirSync(evidence, { recursive: true });
    fs.writeFileSync(
      path.join(evidence, "forge-bundle.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
    fs.rmSync(result.outputDir, { recursive: true, force: true });
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
