import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

// This same allowlist drives packaging and source equivalence. Never copy .env,
// local identities, OAuth credentials, developer caches, or execution journals.
export const releaseInputs = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  ".npmrc",
  ".node-version",
  "apps/forge/package.json",
  "apps/forge/tsconfig.json",
  "apps/forge/src",
  "apps/forge/optional",
  "apps/forge/resources",
  "apps/forge/static/workspace",
  "apps/remote/package.json",
  "apps/remote/src",
  "apps/remote/vite.config.ts",
  "apps/remote/.env.example",
  "packages",
  "scripts",
  "tests",
  "vitest.config.ts",
  "playwright.config.ts",
];
export const excludedReleasePart = (part: string) =>
  ["node_modules", ".vite", ".env", ".DS_Store"].includes(part) ||
  (part.startsWith(".env.") && part !== ".env.example");
export async function filesBelow(root: string): Promise<string[]> {
  const found: string[] = [];
  async function visit(path: string): Promise<void> {
    const { lstat } = await import("node:fs/promises");
    const entry = await lstat(path);
    if (entry.isSymbolicLink())
      throw new Error(
        `Unexpected symlink in release input: ${relative(root, path)}`,
      );
    if (entry.isDirectory()) {
      for (const child of (await readdir(path)).sort()) {
        if (excludedReleasePart(child)) continue;
        await visit(join(path, child));
      }
    } else found.push(relative(root, path));
  }
  for (const input of releaseInputs) await visit(join(root, input));
  return found.sort();
}
export async function sourceDigest(root: string): Promise<string> {
  const digest = createHash("sha256");
  for (const file of await filesBelow(root)) {
    digest.update(`${file}\0`);
    digest.update(await readFile(join(root, file)));
    digest.update("\0");
  }
  return digest.digest("hex");
}
