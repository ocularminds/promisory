import { access, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parse } from "yaml";
import {
  assertProfileEquivalence,
  profileNames,
  profileManifest,
  releaseIdentitiesSchema,
} from "./release-profiles";
import { sourceDigest } from "./release-files";
import { makeManifest } from "./manifest";
import { assertForgeBuildConfig } from "./forge-build-config";

// Synthetic identity values exercise the packaging contract only. They are
// never written to deployable manifests or passed to Forge registration.
const synthetic = releaseIdentitiesSchema.parse(
  Object.fromEntries(
    profileNames.map((name, i) => [
      name,
      {
        appId: `ari:cloud:ecosystem::app/00000000-0000-4000-8000-00000000000${i + 1}`,
        remoteUrl: `https://${name}.example.invalid`,
      },
    ]),
  ),
);
assertProfileEquivalence(
  profileNames.map((name) => profileManifest(name, synthetic)),
);
const root = resolve(import.meta.dirname, "..");
const existing = await Promise.all(
  profileNames.map(async (name) => {
    try {
      await access(join(root, "release", name, "profile.json"));
      return true;
    } catch {
      return false;
    }
  }),
);
if (existing.some(Boolean)) {
  if (!existing.every(Boolean))
    throw new Error(
      "A release is partial; all three profiles must be regenerated from the same source.",
    );
  const manifests = await Promise.all(
    profileNames.map(
      async (name) =>
        parse(
          await readFile(
            join(root, "release", name, "apps/forge/manifest.yml"),
            "utf8",
          ),
        ) as ReturnType<typeof makeManifest>,
    ),
  );
  assertProfileEquivalence(manifests);
  const digests = await Promise.all(
    profileNames.map((name) => sourceDigest(join(root, "release", name))),
  );
  if (new Set(digests).size !== 1)
    throw new Error("Generated profile source files differ.");
  for (const [index, name] of profileNames.entries()) {
    await assertForgeBuildConfig(
      join(root, "release", name, "apps/forge"),
      Boolean(manifests[index]?.remotes),
    );
    const metadata = JSON.parse(
      await readFile(join(root, "release", name, "profile.json"), "utf8"),
    );
    if (digests[index] !== metadata.sourceDigest)
      throw new Error(`${name} sources changed after packaging.`);
    if (manifests[index]?.app.licensing.enabled !== (name === "marketplace"))
      throw new Error(`${name} licensing is incorrect.`);
  }
  if (new Set(manifests.map((manifest) => manifest.app.id)).size !== 3)
    throw new Error("Release app identities are not distinct.");
  console.log(
    "Generated profiles have identical source bytes and equivalent capabilities. Installation and distribution still require live acceptance.",
  );
} else {
  console.log(
    "Offline release equivalence passed. Real app identities and generated/installable profiles are still pending; no distribution claim is made.",
  );
}
