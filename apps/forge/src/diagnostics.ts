/** Diagnostics contain code locations and fixed classifications, never source data or provider error text. */
export function failureDiagnostic(operation: string, error: unknown) {
  const knownKinds = [
    "Error",
    "TypeError",
    "ReferenceError",
    "RangeError",
    "SyntaxError",
    "ForgeSQLAPIError",
    "ForgeSQLError",
    "ForgeError",
    "APIError",
    "FetchError",
    "ZodError",
  ];
  // Forge and SDK failures can cross a VM boundary and fail instanceof Error.
  const value =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : undefined;
  const name = typeof value?.name === "string" ? value.name : undefined;
  const message =
    typeof value?.message === "string" ? value.message : undefined;
  const stack = typeof value?.stack === "string" ? value.stack : undefined;
  const code =
    typeof value?.code === "string" &&
    [
      "UNKNOWN_ERROR",
      "SQL_EXECUTION_ERROR",
      "INVALID_SQL_QUERY",
      "QUERY_TIMED_OUT",
      "APP_NOT_ENABLED",
      "SQL_POLICY_VIOLATION",
    ].includes(value.code)
      ? value.code
      : undefined;
  const context =
    typeof value?.context === "object" && value.context !== null
      ? (value.context as Record<string, unknown>)
      : undefined;
  const debug =
    typeof context?.debug === "object" && context.debug !== null
      ? (context.debug as Record<string, unknown>)
      : undefined;
  const sqlCode =
    typeof debug?.code === "string" &&
    [
      "ER_PARSE_ERROR",
      "ER_NO_SUCH_TABLE",
      "ER_BAD_FIELD_ERROR",
      "ER_TABLEACCESS_DENIED_ERROR",
      "ER_WRONG_ARGUMENTS",
      "ER_DUP_ENTRY",
      "ER_BAD_NULL_ERROR",
      "ER_DATA_TOO_LONG",
      "ER_TRUNCATED_WRONG_VALUE",
      "ER_UNSUPPORTED_PS",
    ].includes(debug.code)
      ? debug.code
      : undefined;
  const sqlErrno =
    typeof debug?.errno === "number" &&
    Number.isInteger(debug.errno) &&
    debug.errno >= 1000 &&
    debug.errno <= 9999
      ? debug.errno
      : undefined;
  const sqlOperation =
    typeof context?.queryType === "string" &&
    ["select", "insert", "update", "delete", "other"].includes(
      context.queryType,
    )
      ? context.queryType
      : undefined;
  const missingGlobal = [
    "structuredClone",
    "crypto",
    "TextEncoder",
    "TextDecoder",
    "fetch",
    "Buffer",
    "setTimeout",
  ].find(
    (name) =>
      message === `${name} is not defined` ||
      message === `${name} is not a function`,
  );
  const locations =
    stack
      ?.split("\n")
      .slice(1)
      .flatMap((line) =>
        line.trim().startsWith("at ")
          ? (line.match(/(?:index|rovo|events)\.[cm]?js:\d+:\d+/g) ?? [])
          : [],
      )
      .slice(0, 5) ?? [];
  const validation =
    name === "ZodError" && Array.isArray(value?.issues)
      ? value.issues.slice(0, 5).map((raw: unknown) => {
          const issue =
            typeof raw === "object" && raw !== null
              ? (raw as Record<string, unknown>)
              : {};
          const field = Array.isArray(issue.path) ? issue.path[0] : undefined;
          return {
            ...(issue.code === "unrecognized_keys" && Array.isArray(issue.keys)
              ? {
                  keys: issue.keys
                    .slice(0, 10)
                    .map((key: unknown) =>
                      typeof key === "string" &&
                      [
                        "context",
                        "contextToken",
                        "contextJwt",
                        "payload",
                        "input",
                        "inputs",
                        "parameters",
                        "configuration",
                        "metadata",
                        "actionMetadata",
                        "action",
                        "actionId",
                        "actionKey",
                        "actionName",
                        "actionVerb",
                        "actionInvocationId",
                        "actionCallId",
                        "moduleKey",
                        "extension",
                        "extensionContext",
                        "cloudId",
                        "accountId",
                        "installationId",
                        "installationContext",
                        "requestContext",
                        "userContext",
                        "userAccess",
                        "rovoContext",
                        "agentId",
                        "conversationId",
                        "requestId",
                        "invocationId",
                        "schemaVersion",
                        "eventType",
                        "isAutomation",
                        "prompt",
                      ].includes(key)
                        ? key
                        : "OTHER",
                    ),
                }
              : {}),
            field:
              typeof field === "string" &&
              [
                "projectId",
                "commitmentId",
                "workId",
                "requirementId",
                "issueId",
                "accountId",
                "principal",
                "appId",
                "environmentId",
                "installationId",
                "cloudId",
                "principalAccountId",
              ].includes(field)
                ? field
                : "OTHER",
            code:
              typeof issue.code === "string" &&
              [
                "invalid_type",
                "invalid_value",
                "invalid_format",
                "too_small",
                "too_big",
                "unrecognized_keys",
                "custom",
              ].includes(issue.code)
                ? issue.code
                : "OTHER",
          };
        })
      : undefined;
  return {
    event: "PROMISORY_INVOCATION_FAILURE",
    operation,
    kind: name && knownKinds.includes(name) ? name : "UNKNOWN",
    ...(code ? { code } : {}),
    ...(sqlCode ? { sqlCode } : {}),
    ...(sqlErrno ? { sqlErrno } : {}),
    ...(sqlOperation ? { sqlOperation } : {}),
    ...(missingGlobal ? { missingGlobal } : {}),
    ...(validation ? { validation } : {}),
    locations,
  };
}

export function reportFailure(operation: string, error: unknown) {
  console.error(JSON.stringify(failureDiagnostic(operation, error)));
}
