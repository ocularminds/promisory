import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CanonicalIntentHasher,
  IntentCapture,
} from "@decionis/agent-safe-pipeline";
import { EncryptedFileClaimVault } from "../../apps/remote/src/vault";
import { claimSnapshotSchema } from "@promisory/integrations-decionis";
import { exampleContext } from "@promisory/test-fixtures";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
describe("durable claim vault", () => {
  it("survives restart while encrypting claim secrets, separating tenants, and rejecting tampering", async () => {
    const directory = await mkdtemp(join(tmpdir(), "promisory-vault-test-"));
    directories.push(directory);
    const key = "a1".repeat(32),
      ctx = exampleContext(),
      vault = new EncryptedFileClaimVault(directory, key);
    const captured = new IntentCapture().capture(
      {
        action: "jira.issue.set_due_date",
        target: "jira:121",
        parameters: { operationId: "operation-test" },
      },
      {
        tenantId: crypto.randomUUID(),
        actor: { id: "maya", type: "atlassian_user" },
        downstreamTarget: { system: "jira", operation: "set_due_date" },
        context: { installation_id: ctx.installationId },
        idempotencyKey: "test-key",
      },
    );
    const snapshot = claimSnapshotSchema.parse({
      intent: captured.intent,
      decision: {
        verdict: "ALLOW",
        decisionId: "decision-test",
        dossierId: "dossier-test",
        intentHash: captured.intentHash,
        reasonCodes: [],
        authorization: {
          token: "secret-execution-token",
          expiresAt: captured.intent.expiresAt,
        },
        failClosed: false,
      },
      authorization: {
        decisionId: "decision-test",
        dossierId: "dossier-test",
        grantId: "grant-test",
        intentHash: captured.intentHash,
        expiresAt: captured.intent.expiresAt,
      },
      material: {
        kind: "decionis",
        execution_token: "secret-execution-token",
        claim_token: "secret-claim-token",
        commit_correlation_id: captured.intent.intentId,
      },
    });
    await vault.save(ctx, "operation-test", snapshot);
    const file = join(directory, (await readdir(directory))[0]!),
      bytes = await readFile(file);
    expect(bytes.toString()).not.toContain("secret-claim-token");
    expect(bytes.toString()).not.toContain("maya");
    expect(
      await new EncryptedFileClaimVault(directory, key).get(
        ctx,
        "operation-test",
      ),
    ).toEqual(snapshot);
    expect(
      await vault.get(
        { ...ctx, installationId: "another-installation" },
        "operation-test",
      ),
    ).toBeUndefined();
    await expect(
      new EncryptedFileClaimVault(directory, "b2".repeat(32)).get(
        ctx,
        "operation-test",
      ),
    ).rejects.toThrow();
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
    await writeFile(file, bytes);
    await expect(vault.get(ctx, "operation-test")).rejects.toThrow();
  });
});
