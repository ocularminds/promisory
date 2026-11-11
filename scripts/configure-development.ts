import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";
import { makeManifest } from "./manifest";
import { writeForgeBuildConfig } from "./forge-build-config";
const path = resolve(import.meta.dirname, "../apps/forge/manifest.yml");
const current = parse(await readFile(path, "utf8"));
const appId = z
  .string()
  .regex(/^ari:cloud:ecosystem::app\/[0-9a-f-]{36}$/i)
  .parse(current.app.id);
if (current.app.licensing?.enabled === true)
  throw new Error(
    "Use release profiles for a licensed app; this command configures only an unlicensed development identity.",
  );
const input = process.argv[2];
const remote =
  input === "--no-remote"
    ? undefined
    : (input ??
      current.remotes?.find(
        (remote: { key: string }) => remote.key === "promisory-executor",
      )?.baseUrl);
if (remote) {
  const url = new URL(z.url().parse(remote));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "The remote must be an HTTPS origin without credentials, path, query, or fragment.",
    );
}
await writeForgeBuildConfig(resolve(path, ".."), Boolean(remote));
await writeFile(path, stringify(makeManifest(appId, false, remote)));
console.log(
  "Development manifest and executor build updated from the shared generators. No deployment or installation was performed.",
);
