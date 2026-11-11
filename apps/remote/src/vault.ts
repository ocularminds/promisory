import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type TrustedContext } from "@promisory/contracts";
import { hash, ensure } from "@promisory/domain";
import {
  claimSnapshotSchema,
  type ClaimSnapshot,
  type ClaimVault,
} from "@promisory/integrations-decionis";

/** Single-host encrypted claim vault. Use a shared secret-backed store for multiple replicas. */
export class EncryptedFileClaimVault implements ClaimVault {
  private key: Buffer;
  constructor(
    private directory: string,
    keyHex: string,
  ) {
    ensure(
      /^[a-f0-9]{64}$/i.test(keyHex),
      "INVALID_VAULT_KEY",
      "A separate 256-bit claim encryption key is required.",
    );
    this.key = Buffer.from(keyHex, "hex");
    this.directory = resolve(directory);
  }
  private async identity(context: TrustedContext, operationId: string) {
    return (
      await hash([
        context.appId,
        context.environmentId,
        context.installationId,
        context.cloudId,
        context.principalAccountId,
        operationId,
      ])
    ).slice(7);
  }
  async get(context: TrustedContext, operationId: string) {
    const identity = await this.identity(context, operationId);
    let blob: Buffer;
    try {
      blob = await readFile(join(this.directory, `${identity}.claim`));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    ensure(
      blob.length >= 28 && blob.length <= 128_000,
      "INVALID_CLAIM",
      "The encrypted claim has an invalid size.",
    );
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      blob.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(identity));
    decipher.setAuthTag(blob.subarray(12, 28));
    const plain = Buffer.concat([
      decipher.update(blob.subarray(28)),
      decipher.final(),
    ]);
    return claimSnapshotSchema.parse(JSON.parse(plain.toString("utf8")));
  }
  async save(
    context: TrustedContext,
    operationId: string,
    snapshot: ClaimSnapshot,
  ) {
    const parsed = claimSnapshotSchema.parse(snapshot),
      identity = await this.identity(context, operationId),
      nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    cipher.setAAD(Buffer.from(identity));
    const plain = Buffer.from(JSON.stringify(parsed));
    ensure(
      plain.length <= 127_000,
      "CLAIM_TOO_LARGE",
      "The claim exceeds its bounded storage contract.",
    );
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]),
      blob = Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = join(this.directory, `${identity}.claim`),
      temporary = `${target}.${crypto.randomUUID()}.tmp`;
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(blob);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, target);
    const directory = await open(this.directory, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
  async remove(context: TrustedContext, operationId: string) {
    try {
      await unlink(
        join(
          this.directory,
          `${await this.identity(context, operationId)}.claim`,
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
