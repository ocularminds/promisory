import { validate } from "@forge/manifest";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { assertForgeBuildConfig } from "./forge-build-config";
const before = process.cwd();
try {
  process.chdir(resolve(import.meta.dirname, "../apps/forge"));
  const result = await validate(false, "manifest.yml");
  const manifest = parse(await readFile("manifest.yml", "utf8"));
  await assertForgeBuildConfig(
    process.cwd(),
    Boolean(
      manifest.remotes?.some(
        (remote: { key: string }) => remote.key === "promisory-executor",
      ),
    ),
  );
  console.log(
    JSON.stringify(
      {
        mode: "OFFLINE_MANIFEST",
        success: result.success,
        errors: result.errors,
        registration: "NOT_VERIFIED",
        installation: "NOT_VERIFIED",
      },
      null,
      2,
    ),
  );
  if (!result.success) process.exitCode = 1;
} finally {
  process.chdir(before);
}
