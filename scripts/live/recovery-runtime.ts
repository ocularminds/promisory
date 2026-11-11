/** Explicit read-back expectations for reviewed recovery runtime revisions. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { recoveryScope } from "./recovery-probe";
import { observedOperationId } from "./recovery-history-observer";

export const recoveryRuntimeProfileSchema = z.enum([
  "original",
  "history-fix",
  "effect-binding-fix",
]);
export const originalRecoveryImage =
  "decionisacr.azurecr.io/promisory/executor@sha256:a387bebb193e4ad99e8fe0d10808a73bae875e6198202b95d77a4da48169bc4a";
export const recoveryHistoryRuntimeSchema = z.strictObject({
  schemaVersion: z.literal("promisory.recovery-history-runtime.v1"),
  recordedAt: z.iso.datetime(),
  operationId: z.literal(observedOperationId),
  policyId: z.literal(recoveryScope.policyId),
  previousImage: z.literal(originalRecoveryImage),
  image: z
    .string()
    .regex(
      /^decionisacr\.azurecr\.io\/promisory\/executor@sha256:[a-f0-9]{64}$/,
    ),
  serverSha256: z.literal(
    "a72c38f8ca6e426bc158210e0b3d320407d6fac7de6c921a8e3c0ab29caaa155",
  ),
  sourceSha256: z.literal(
    "557b2cc44b123ec43b34facddaa35c07b1fde4df845a3af59a558f1d5d34dd59",
  ),
  buildRunId: z.string().regex(/^[a-z0-9]+$/),
  buildSucceeded: z.literal(true),
  registryDigestMatches: z.literal(true),
  platform: z.literal("linux/amd64"),
  nativeReceiptRule: z.literal(
    "EXACT_OPERATION_TAG_STABLE_FIELD_ID_RAW_ISO_DATES",
  ),
});
export const recoveryEffectRuntimeSchema = z.strictObject({
  schemaVersion: z.literal("promisory.recovery-effect-runtime.v1"),
  recordedAt: z.iso.datetime(),
  operationId: z.literal(observedOperationId),
  policyId: z.literal(recoveryScope.policyId),
  previousImage: z.literal(
    "decionisacr.azurecr.io/promisory/executor@sha256:37ba069148a4ac4ffbf346d888094b13abcb07f2d449449952472ff4efc030fd",
  ),
  image: z.literal(
    "decionisacr.azurecr.io/promisory/executor@sha256:f30b1ab4606a5170bc3b1dc42d4b38599d50f5cf3053003dd6b84a3f49aaea7b",
  ),
  serverSha256: z.literal(
    "be2b685d5d1853cfb85fa019eb152614bce2be6961dbad3383be61e6b8ab82e5",
  ),
  sourceSha256: z.literal(
    "c70bff275dfa43fa951ef72058e2f10c6245edf408b20609acd27acfe7316d05",
  ),
  buildRunId: z.literal("cj4c"),
  buildSucceeded: z.literal(true),
  registryDigestMatches: z.literal(true),
  platform: z.literal("linux/amd64"),
  nativeReceiptRule: z.literal(
    "EXACT_OPERATION_TAG_STABLE_FIELD_ID_RAW_ISO_DATES",
  ),
  effectCommitmentSchema: z.literal("promisory.jira-date-effect.v1"),
  effectObserverId: z.literal("c97a5168-1325-487c-94e8-e3d4b06adffd"),
  liveRecoveryVerified: z.literal(false),
});

export function recoveryRuntime(root: string, rawProfile: unknown) {
  const profile = recoveryRuntimeProfileSchema.parse(rawProfile ?? "original");
  if (profile === "original")
    return {
      profile,
      image: originalRecoveryImage,
      serverSha256:
        "9443e31f8b66a0fd6eba38aa599b3072dc3c4edb51d7f7a37abb4ddd9fbe513b",
      requiredEnvironment: {} as Record<string, string>,
    };
  if (profile === "effect-binding-fix") {
    const candidate = recoveryEffectRuntimeSchema.parse(
      JSON.parse(
        readFileSync(
          resolve(
            root,
            "docs/evidence/2026-11-11-recovery-test/effect-binding-runtime-candidate.json",
          ),
          "utf8",
        ),
      ),
    );
    return {
      profile,
      image: candidate.image,
      serverSha256: candidate.serverSha256,
      requiredEnvironment: {
        PROMISORY_EFFECT_OBSERVER_ID: candidate.effectObserverId,
      } as Record<string, string>,
    };
  }
  const candidate = recoveryHistoryRuntimeSchema.parse(
    JSON.parse(
      readFileSync(
        resolve(
          root,
          "docs/evidence/2026-11-11-recovery-test/history-fix-runtime-candidate.json",
        ),
        "utf8",
      ),
    ),
  );
  return {
    profile,
    image: candidate.image,
    serverSha256: candidate.serverSha256,
    requiredEnvironment: {} as Record<string, string>,
  };
}
