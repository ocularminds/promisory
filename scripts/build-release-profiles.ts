import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { stringify } from "yaml";
import {
  profileNames,
  releaseIdentitiesSchema,
  profileManifest,
  assertProfileEquivalence,
} from "./release-profiles";
import {
  releaseInputs,
  sourceDigest,
  excludedReleasePart,
} from "./release-files";
import { assertForgeBuildConfig } from "./forge-build-config";

const root = resolve(import.meta.dirname, "..");
const config = resolve(
  process.argv[2] ?? join(root, "release-identities.local.json"),
);
const identities = releaseIdentitiesSchema.parse(
  JSON.parse(await readFile(config, "utf8")),
);
const manifests = profileNames.map((name) => profileManifest(name, identities));
assertProfileEquivalence(manifests);
await assertForgeBuildConfig(
  join(root, "apps/forge"),
  Boolean(identities.development.remoteUrl),
);
// A real built resource is mandatory. This command never registers or deploys.
await readFile(join(root, "apps/forge/static/workspace/dist/index.html"));
const digest = await sourceDigest(root);
const output = join(root, "release");
await mkdir(output, { recursive: true });
for (const [index, name] of profileNames.entries()) {
  const destination = join(output, name);
  // Refuse to overwrite a prior reviewable release; choose a new checkout or
  // move that existing release aside explicitly before generating again.
  await mkdir(destination);
  for (const input of releaseInputs) {
    const target = join(destination, input);
    await mkdir(resolve(target, ".."), { recursive: true });
    await cp(join(root, input), target, {
      recursive: true,
      filter: (path) => !path.split(/[\\/]/).some(excludedReleasePart),
    });
  }
  await writeFile(
    join(destination, "apps/forge/manifest.yml"),
    stringify(manifests[index]),
  );
  await writeFile(
    join(destination, "profile.json"),
    JSON.stringify(
      {
        profile: name,
        appId: identities[name].appId,
        sourceDigest: digest,
        licensed: name === "marketplace",
        requiredForgeVariables: {
          PROMISORY_LICENSED_PROFILE: String(name === "marketplace"),
        },
        installation: "NOT_VERIFIED",
        governedExecution: "NOT_VERIFIED",
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(
  `Prepared three equivalent source profiles in ${output}. No app was registered, installed, deployed, or published.`,
);
