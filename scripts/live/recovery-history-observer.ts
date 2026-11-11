/** Temporary read-only transport observation for the already-dispatched test. */
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  assertRecoveryEnvironment,
  recoveryMarkerName,
  recoveryMarkerSchema,
  recoveryScope,
} from "./recovery-probe";

export const observedOperationId =
  "operation-4ba64b81-05bd-4438-86db-280c983f061d";
export const historyObservationName = `history-${observedOperationId}.json`;
const daySchema = z.iso.date();
const dateObservationSchema = z.strictObject({
  format: z.enum([
    "ABSENT",
    "NULL",
    "ISO_DATE",
    "ISO_DATE_TIME",
    "EPOCH",
    "DISPLAY_DATE",
    "OTHER",
  ]),
  calendarDate: z.enum(["2026-11-18", "2026-11-19"]).optional(),
});
export const historyObservationSchema = z.strictObject({
  schemaVersion: z.literal("promisory.recovery-history-observation.v1"),
  operationId: z.literal(observedOperationId),
  source: z.literal("JIRA_REST_CHANGELOG"),
  recordedAt: z.iso.datetime(),
  startAt: z.number().int().min(0).max(400),
  httpStatus: z.number().int().min(100).max(599),
  pageParsed: z.boolean(),
  entryCount: z.number().int().min(0).max(100),
  taggedEntryCount: z.number().int().min(0).max(100),
  dateItems: z
    .array(
      z.strictObject({
        stableFieldIdMatches: z.boolean(),
        field: z.enum(["duedate", "Due date", "Due Date", "OTHER"]),
        from: dateObservationSchema,
        to: dateObservationSchema,
        fromString: dateObservationSchema,
        toString: dateObservationSchema,
      }),
    )
    .max(20),
});

/** Keep only representation categories and the two already-approved dates. */
function dateObservation(
  value: unknown,
): z.infer<typeof dateObservationSchema> {
  let format: z.infer<typeof dateObservationSchema>["format"] = "OTHER";
  let calendarDate: string | undefined;
  if (value === undefined) format = "ABSENT";
  else if (value === null) format = "NULL";
  else if (typeof value === "string") {
    if (daySchema.safeParse(value).success) {
      format = "ISO_DATE";
      calendarDate = value;
    } else if (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})$/.test(
        value,
      ) &&
      Number.isFinite(Date.parse(value))
    ) {
      format = "ISO_DATE_TIME";
      calendarDate = value.slice(0, 10);
    } else if (/^\d{13}$/.test(value)) {
      format = "EPOCH";
      calendarDate = new Date(Number(value)).toISOString().slice(0, 10);
    } else if (/^\d{1,2}\/[A-Za-z]{3}\/\d{2,4}$/.test(value))
      format = "DISPLAY_DATE";
  } else if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1_000_000_000_000 &&
    value <= 9_999_999_999_999
  ) {
    format = "EPOCH";
    calendarDate = new Date(value).toISOString().slice(0, 10);
  }
  return dateObservationSchema.parse({
    format,
    ...(["2026-11-18", "2026-11-19"].includes(calendarDate ?? "")
      ? { calendarDate }
      : {}),
  });
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function projectHistoryResponse(
  payload: unknown,
  startAt: number,
  httpStatus: number,
  now = new Date().toISOString(),
) {
  const raw = object(payload).values;
  const entries = Array.isArray(raw) && raw.length <= 100 ? raw : undefined;
  const tagged =
    entries?.filter(
      (entry) =>
        object(object(object(entry).historyMetadata).extraData)
          .promisoryOperationId === observedOperationId,
    ) ?? [];
  const dateItems = tagged
    .flatMap((entry) => {
      const items = object(entry).items;
      return Array.isArray(items) && items.length <= 100
        ? items
            .map(object)
            .filter(
              (item) =>
                item.fieldId === "duedate" ||
                ["duedate", "Due date", "Due Date"].includes(
                  String(item.field),
                ),
            )
        : [];
    })
    .slice(0, 20)
    .map((item) => ({
      stableFieldIdMatches: item.fieldId === "duedate",
      field: ["duedate", "Due date", "Due Date"].includes(String(item.field))
        ? item.field
        : "OTHER",
      from: dateObservation(item.from),
      to: dateObservation(item.to),
      fromString: dateObservation(item.fromString),
      toString: dateObservation(item.toString),
    }));
  return historyObservationSchema.parse({
    schemaVersion: "promisory.recovery-history-observation.v1",
    operationId: observedOperationId,
    source: "JIRA_REST_CHANGELOG",
    recordedAt: now,
    startAt,
    httpStatus,
    pageParsed: Boolean(entries),
    entryCount: entries?.length ?? 0,
    taggedEntryCount: tagged.length,
    dateItems,
  });
}

export function createHistoryObserver(
  original: typeof fetch,
  stateDirectory: string,
): typeof fetch {
  return async (input, init) => {
    const response = await original(input, init);
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const startAt = url.searchParams.get("startAt");
    if (
      method !== "GET" ||
      url.origin !== "https://api.atlassian.com" ||
      url.pathname !==
        `/ex/jira/${recoveryScope.cloudId}/rest/api/3/issue/${recoveryScope.issueId}/changelog` ||
      !/^(?:0|100|200|300|400)$/.test(startAt ?? "") ||
      url.searchParams.get("maxResults") !== "100" ||
      [...url.searchParams].length !== 2
    )
      return response;
    // The response returned to the real executor is never altered. A failed
    // observation cannot authorize a result or cause another native request.
    const directory = join(stateDirectory, "recovery-tests");
    const observationName =
      startAt === "0"
        ? historyObservationName
        : historyObservationName.replace(".json", `-${startAt}.json`);
    const temporary = join(directory, `${observationName}.tmp-${randomUUID()}`);
    try {
      const marker = recoveryMarkerSchema.parse(
        JSON.parse(await readFile(join(directory, recoveryMarkerName), "utf8")),
      );
      if (
        marker.operationId !== observedOperationId ||
        marker.phase !== "ACKNOWLEDGEMENT_SUPPRESSED"
      )
        return response;
      const text = await response.clone().text();
      let payload: unknown = null;
      if (text.length <= 1_000_000) {
        try {
          payload = JSON.parse(text);
        } catch {
          // Record only the HTTP status when the provider did not return JSON.
        }
      }
      const result = projectHistoryResponse(
        payload,
        Number(startAt),
        response.status,
      );
      await writeFile(temporary, `${JSON.stringify(result)}\n`, {
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporary, join(directory, observationName));
    } catch {
      // Preserve the actual executor's behavior and the already saved claim.
    } finally {
      await rm(temporary, { force: true }).catch(() => {});
    }
    return response;
  };
}

if (process.env.PROMISORY_RECOVERY_HISTORY_OBSERVER === "true") {
  assertRecoveryEnvironment(process.env);
  const marker = recoveryMarkerSchema.parse(
    JSON.parse(
      await readFile(
        join(
          recoveryScope.stateDirectory,
          "recovery-tests",
          recoveryMarkerName,
        ),
        "utf8",
      ),
    ),
  );
  if (
    marker.operationId !== observedOperationId ||
    marker.phase !== "ACKNOWLEDGEMENT_SUPPRESSED"
  )
    throw new Error("RECOVERY_HISTORY_SCOPE_REFUSED");
  globalThis.fetch = createHistoryObserver(
    globalThis.fetch.bind(globalThis),
    recoveryScope.stateDirectory,
  );
} else if (
  process.env.PROMISORY_RECOVERY_HISTORY_OBSERVER !== undefined &&
  process.env.PROMISORY_RECOVERY_HISTORY_OBSERVER !== "false"
)
  throw new Error("RECOVERY_HISTORY_CONFIGURATION_REFUSED");
