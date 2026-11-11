import { z } from "zod";
import { canonicalJson } from "@promisory/domain";
import { makeManifest } from "./manifest";

export const profileNames = ["development", "judge", "marketplace"] as const;
export type ProfileName = (typeof profileNames)[number];
const appId = z
  .string()
  .regex(
    /^ari:cloud:ecosystem::app\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
const remoteUrl = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/"
    );
  }, "Use an HTTPS origin without credentials, path, query, or fragment.")
  .optional();
const identity = z.object({ appId, remoteUrl }).strict();
export const releaseIdentitiesSchema = z
  .object({
    development: identity,
    judge: identity,
    marketplace: identity,
  })
  .strict()
  .superRefine((profiles, context) => {
    if (
      new Set(profileNames.map((name) => profiles[name].appId.toLowerCase()))
        .size !== 3
    )
      context.addIssue({
        code: "custom",
        message:
          "Development, judge, and Marketplace must have distinct newly registered Promisory identities.",
      });
    if (
      new Set(profileNames.map((name) => Boolean(profiles[name].remoteUrl)))
        .size !== 1
    )
      context.addIssue({
        code: "custom",
        message:
          "All profiles must expose the same executor capability. Configure remote origins for all three, or for none.",
      });
  });
export type ReleaseIdentities = z.infer<typeof releaseIdentitiesSchema>;
export function profileManifest(
  name: ProfileName,
  profiles: ReleaseIdentities,
) {
  return makeManifest(
    profiles[name].appId,
    name === "marketplace",
    profiles[name].remoteUrl,
  );
}
export function normalizedManifest(
  manifest: ReturnType<typeof makeManifest>,
): string {
  const copy = structuredClone(manifest);
  copy.app.id = "PROFILE_IDENTITY";
  copy.app.licensing.enabled = false;
  if (copy.remotes)
    for (const remote of copy.remotes) remote.baseUrl = "PROFILE_REMOTE_ORIGIN";
  return canonicalJson(copy);
}
export function assertProfileEquivalence(
  manifests: Array<ReturnType<typeof makeManifest>>,
): void {
  if (
    manifests.length !== 3 ||
    new Set(manifests.map(normalizedManifest)).size !== 1
  )
    throw new Error(
      "Profile modules, source access, or execution capabilities differ. Only app identity, licensing, and remote origin may vary.",
    );
  const first = manifests[0]!;
  const expected = makeManifest(
    first.app.id,
    false,
    first.remotes?.[0]?.baseUrl,
  );
  if (normalizedManifest(first) !== normalizedManifest(expected))
    throw new Error(
      "Profiles differ from the shared manifest generator. Equal changes to all profiles cannot bypass the declared capability contract.",
    );
}
