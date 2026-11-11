import { z } from "zod";
import {
  dateOnly,
  effectSchema,
  id,
  instant,
  trustedContextSchema,
  type JiraDueDateEffect,
  type TrustedContext,
} from "@promisory/contracts";
import { ensure, hash } from "@promisory/domain";

/** Only independently prepared dates and trusted scope enter this commitment. */
export const jiraEffectCommitmentSchema = z.strictObject({
  schemaVersion: z.literal("promisory.jira-date-effect.v1"),
  context: trustedContextSchema,
  operationId: id,
  issueId: id,
  fieldId: z.literal("duedate"),
  from: dateOnly.nullable(),
  to: dateOnly,
});

export async function jiraEffectDigest(
  context: TrustedContext,
  operationId: string,
  effect: JiraDueDateEffect,
): Promise<`sha256:${string}`> {
  const checked = effectSchema.parse(effect);
  ensure(
    checked.cloudId === context.cloudId,
    "EFFECT_SCOPE_MISMATCH",
    "The effect belongs to another cloud.",
  );
  return hash(
    jiraEffectCommitmentSchema.parse({
      schemaVersion: "promisory.jira-date-effect.v1",
      context,
      operationId,
      issueId: checked.issueId,
      fieldId: "duedate",
      from: checked.expectedDueDate,
      to: checked.desiredDueDate,
    }),
  );
}

/** Constructed after this invocation reads Jira and verifies its native receipt. */
export const jiraRecoveryObservationSchema = z.strictObject({
  schemaVersion: z.literal("promisory.jira-recovery-observation.v1"),
  context: trustedContextSchema,
  operationId: id,
  effect: effectSchema,
  observedDueDate: dateOnly.nullable(),
  sourceUpdatedAt: instant,
  observedAt: instant,
  receipt: z.enum(["OPERATION_HISTORY", "ACKNOWLEDGED_WRITE"]),
});
export type JiraRecoveryObservation = z.infer<
  typeof jiraRecoveryObservationSchema
>;

/** The observer is host configuration, never an invocation/model field. */
export const effectObserverIdSchema = id;
export const effectObserverVersion = "promisory.jira-date-observer/1";
