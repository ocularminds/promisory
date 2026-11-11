import { describe, expect, it } from "vitest";
import {
  profileNames,
  profileManifest,
  assertProfileEquivalence,
  releaseIdentitiesSchema,
} from "../../scripts/release-profiles";
const fixture = () =>
  releaseIdentitiesSchema.parse(
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
describe("offline release profile guardrails", () => {
  it("rejects an identical capability change applied to every generated profile", () => {
    const profiles = fixture();
    const manifests = profileNames.map((name) =>
      profileManifest(name, profiles),
    );
    for (const manifest of manifests)
      manifest.permissions.scopes.push("read:app-system-token");
    expect(() => assertProfileEquivalence(manifests)).toThrow(
      "shared manifest generator",
    );
  });
  it("allows only identity, licensing and remote origin differences", () => {
    const profiles = fixture(),
      manifests = profileNames.map((name) => profileManifest(name, profiles));
    expect(() => assertProfileEquivalence(manifests)).not.toThrow();
    expect(manifests.map((manifest) => manifest.app.licensing.enabled)).toEqual(
      [false, false, true],
    );
    manifests[1]!.permissions.scopes.push("read:app-system-token");
    expect(() => assertProfileEquivalence(manifests)).toThrow(
      "capabilities differ",
    );
  });
  it("rejects shared identities and a weaker judge executor", () => {
    const profiles = fixture();
    profiles.judge.appId = profiles.marketplace.appId;
    expect(() => releaseIdentitiesSchema.parse(profiles)).toThrow("distinct");
    const weaker = fixture();
    delete weaker.judge.remoteUrl;
    expect(() => releaseIdentitiesSchema.parse(weaker)).toThrow(
      "same executor",
    );
    expect(() =>
      releaseIdentitiesSchema.parse({
        development: { appId: null },
        judge: { appId: null },
        marketplace: { appId: null },
      }),
    ).toThrow();
  });
});
