import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { z } from "zod";
import { failureDiagnostic } from "../../apps/forge/src/diagnostics";

describe("Forge diagnostic privacy", () => {
  it("reports only allowlisted validation fields and categories, never input or messages", () => {
    const result = z.strictObject({ projectId: z.string() }).safeParse({
      projectId: 10000,
      inputs: { secret: "confidential" },
      "private-source-content": "confidential",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const report = failureDiagnostic("rovo.context.input", result.error);
    expect(report).toMatchObject({
      kind: "ZodError",
      validation: [
        { field: "projectId", code: "invalid_type" },
        {
          field: "OTHER",
          code: "unrecognized_keys",
          keys: ["inputs", "OTHER"],
        },
      ],
    });
    expect(JSON.stringify(report)).not.toMatch(/private|confidential|10000/);
  });
  it("omits source bodies, credentials, provider text and arbitrary error fields", () => {
    const error = new TypeError(
      "private source body; Bearer confidential-token; https://provider.invalid/?secret=private",
    );
    error.stack =
      "TypeError: private source body\n    at source (https://provider.invalid/?secret=private:1:2)\n    at workspace (/var/task/index.cjs:123:45)";
    Object.assign(error, {
      cause: { authorization: "confidential-token" },
      code: "PRIVATE_PROVIDER_DETAIL",
    });
    const report = failureDiagnostic("workspace.read", error);
    expect(report).toEqual({
      event: "PROMISORY_INVOCATION_FAILURE",
      operation: "workspace.read",
      kind: "TypeError",
      locations: ["index.cjs:123:45"],
    });
    expect(JSON.stringify(report)).not.toMatch(
      /private|confidential|provider/i,
    );
  });

  it("identifies only known missing runtime globals without disclosing arbitrary identifiers", () => {
    expect(
      failureDiagnostic(
        "workspace.read",
        new ReferenceError("structuredClone is not defined"),
      ),
    ).toMatchObject({ missingGlobal: "structuredClone" });
    expect(
      failureDiagnostic(
        "workspace.read",
        new ReferenceError("privateIdentifier is not defined"),
      ),
    ).not.toHaveProperty("missingGlobal");
    expect(
      failureDiagnostic("workspace.read", {
        message: "secret",
        stack: "private",
      }),
    ).toMatchObject({ kind: "UNKNOWN", locations: [] });
  });

  it("classifies cross-realm runtime errors without copying their text", () => {
    const error = runInNewContext(
      'new ReferenceError("structuredClone is not defined")',
    );
    expect(error).not.toBeInstanceOf(Error);
    expect(failureDiagnostic("workspace.read", error)).toMatchObject({
      kind: "ReferenceError",
      missingGlobal: "structuredClone",
    });
    expect(
      failureDiagnostic("workspace.read", {
        name: "ForgeSQLError",
        code: "SQL_EXECUTION_ERROR",
        message: "private query",
        context: {
          responseText: "private body",
          queryType: "select",
          debug: {
            code: "ER_PARSE_ERROR",
            errno: 1064,
            sqlMessage: "private SQL error",
            sql: "private query with source data",
            message: "private body",
          },
        },
        stack: "Error: private query\n    at source (/var/task/index.js:12:34)",
      }),
    ).toEqual({
      event: "PROMISORY_INVOCATION_FAILURE",
      operation: "workspace.read",
      kind: "ForgeSQLError",
      code: "SQL_EXECUTION_ERROR",
      sqlCode: "ER_PARSE_ERROR",
      sqlErrno: 1064,
      sqlOperation: "select",
      locations: ["index.js:12:34"],
    });
  });
});
