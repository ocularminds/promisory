import { sql, migrationRunner, type UpdateQueryResponse } from "@forge/sql";
import {
  DomainError,
  ensure,
  type RawStore,
  type RawRow,
  type RecordKind,
} from "@promisory/domain";
import { reportFailure } from "./diagnostics";

export const CREATE_RECORDS = `CREATE TABLE IF NOT EXISTS promisory_records (
  scope_hash VARCHAR(71) NOT NULL,
  record_kind VARCHAR(24) NOT NULL,
  record_id VARCHAR(200) NOT NULL,
  revision INT NOT NULL,
  body_json MEDIUMTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (scope_hash, record_kind, record_id)
)`;
export async function migrate() {
  return migrationRunner.enqueue("001-promisory-records", CREATE_RECORDS).run();
}
interface SqlRow {
  record_id: string;
  revision: number;
  body_json: string;
}
const decode = (row: SqlRow): RawRow => ({
  id: row.record_id,
  revision: Number(row.revision),
  body:
    typeof row.body_json === "string"
      ? JSON.parse(row.body_json)
      : row.body_json,
});
/** One CAS statement per aggregate; no transaction spans a remote action. */
export class ForgeSqlStore implements RawStore {
  async get(scope: string, kind: RecordKind, id: string) {
    const result = await sql
      .prepare<SqlRow>(
        "SELECT record_id, revision, body_json FROM promisory_records WHERE scope_hash = ? AND record_kind = ? AND record_id = ?",
      )
      .bindParams(scope, kind, id)
      .execute();
    return result.rows[0] ? decode(result.rows[0]) : undefined;
  }
  async list(scope: string, kind: RecordKind, limit: number) {
    ensure(
      Number.isInteger(limit) && limit > 0 && limit <= 500,
      "INVALID_LIMIT",
      "Invalid record page size.",
    );
    const result = await sql
      .prepare<SqlRow>(
        // Forge SQL rejects a bound LIMIT. The validated integer is the only
        // interpolated value; tenant scope and record kind remain parameters.
        `SELECT record_id, revision, body_json FROM promisory_records WHERE scope_hash = ? AND record_kind = ? ORDER BY record_id LIMIT ${limit}`,
      )
      .bindParams(scope, kind)
      .execute();
    return result.rows.map(decode);
  }
  async compareAndSet(
    scope: string,
    kind: RecordKind,
    id: string,
    expected: number,
    body: unknown,
  ) {
    try {
      const result =
        expected === 0
          ? await sql
              .prepare<UpdateQueryResponse>(
                "INSERT INTO promisory_records (scope_hash, record_kind, record_id, revision, body_json) VALUES (?, ?, ?, 1, ?)",
              )
              .bindParams(scope, kind, id, JSON.stringify(body))
              .execute()
          : await sql
              .prepare<UpdateQueryResponse>(
                "UPDATE promisory_records SET revision = revision + 1, body_json = ?, updated_at = CURRENT_TIMESTAMP WHERE scope_hash = ? AND record_kind = ? AND record_id = ? AND revision = ?",
              )
              .bindParams(JSON.stringify(body), scope, kind, id, expected)
              .execute();
      ensure(
        result.rows.affectedRows === 1,
        "CONFLICT",
        "This record changed. Refresh before trying again.",
      );
      return expected + 1;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      reportFailure("storage.compare-and-set", error);
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";
      if (
        code === "ER_DUP_ENTRY" ||
        code === "DUPLICATE_ENTRY" ||
        (code === "SQL_EXECUTION_ERROR" && String(error).includes("Duplicate"))
      )
        throw new DomainError(
          "CONFLICT",
          "This record already exists. Refresh before trying again.",
        );
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Storage is unavailable; the change is not confirmed.",
      );
    }
  }
  async deleteScope(scope: string) {
    await sql
      .prepare("DELETE FROM promisory_records WHERE scope_hash = ?")
      .bindParams(scope)
      .execute();
  }
}
