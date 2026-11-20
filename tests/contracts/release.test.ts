import { describe, expect, it } from "vitest";
import {
  profileNames,
  profileManifest,
  assertProfileEquivalence,
  releaseIdentitiesSchema,
  assertSharedManifest,
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
  it("keeps all remote profiles on user tokens with no system-token scope or web trigger", () => {
    for (const name of profileNames) {
      const manifest = profileManifest(name, fixture());
      expect(manifest.remotes?.[0]?.auth).toEqual({
        appUserToken: { enabled: true },
      });
      expect(manifest.permissions.scopes).toContain("read:app-user-token");
      expect(manifest.permissions.scopes).not.toContain(
        "read:app-system-token",
      );
      expect(manifest.modules).not.toHaveProperty("webtrigger");
    }
  });
  it("packages the PRD, read-only MCP, privacy and change-detection capabilities in every profile", () => {
    for (const name of profileNames) {
      const manifest = profileManifest(name, fixture());
      const actionByKey = new Map(
        manifest.modules.action.map((action) => [String(action.key), action]),
      );
      const functions = new Map(
        manifest.modules.function.map((fn) => [fn.key, fn.handler]),
      );
      const mcp = manifest.modules["rovo:mcp"][0]!;
      expect(mcp.tools).toHaveLength(3);
      for (const key of mcp.tools) {
        const action = actionByKey.get(key)!;
        expect(action.actionVerb).toBe("GET");
        expect(functions.get(String(action.function))).toMatch(/^rovo\.mcp/);
        expect(manifest.modules["rovo:agent"][0]!.actions).not.toContain(key);
      }
      expect(actionByKey.get("promisory-page-sections")?.actionVerb).toBe(
        "GET",
      );
      expect(actionByKey.get("promisory-propose-from-page")?.actionVerb).toBe(
        "CREATE",
      );
      expect(functions.get("rovo-propose-from-page")).toBe(
        "rovo.proposeFromPage",
      );
      expect(manifest.modules.scheduledTrigger).toContainEqual({
        key: "promisory-privacy",
        function: "privacy-report",
        interval: "day",
      });
      expect(functions.get("privacy-report")).toBe("events.privacySchedule");
      expect(
        manifest.modules.trigger.flatMap((trigger) => trigger.events),
      ).toEqual(
        expect.arrayContaining([
          "avi:jira:created:issuelink",
          "avi:jira:deleted:issuelink",
        ]),
      );
      expect(manifest.permissions.scopes).toEqual(
        expect.arrayContaining([
          "read:graph:project:jira",
          "read:graph:team:atlassian",
          "read:graph:goal:atlassian",
          "read:graph:deployment:external",
        ]),
      );
    }
  });
  it("rejects capabilities declared only in a local development manifest", () => {
    const manifest = profileManifest("development", fixture());
    manifest.modules.scheduledTrigger.push({
      key: "local-only",
      function: "privacy-report",
      interval: "day",
    });
    expect(() => assertSharedManifest(manifest)).toThrow(
      "shared manifest generator",
    );
  });
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
