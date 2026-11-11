import { z } from "zod";
import type { TrustedContext } from "@promisory/contracts";

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
export function ensure(
  value: unknown,
  code: string,
  message: string,
): asserts value {
  if (!value) throw new DomainError(code, message);
}
export const nowIso = () => new Date().toISOString();
export const newId = (kind: string) => `${kind}-${crypto.randomUUID()}`;

/** Deterministic JSON for this restricted, versioned contract. Not the provider's RFC 8785 binding. */
export function canonicalJson(input: unknown): string {
  const ancestors = new Set<object>();
  function encode(value: unknown): string {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    )
      return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value))
      return JSON.stringify(value);
    if (typeof value !== "object" || value === null || ancestors.has(value))
      throw new DomainError(
        "INVALID_CANONICAL_INPUT",
        "Intent must contain finite JSON values without cycles.",
      );
    ancestors.add(value);
    let result: string;
    if (Array.isArray(value)) result = `[${value.map(encode).join(",")}]`;
    else {
      ensure(
        Object.getPrototypeOf(value) === Object.prototype ||
          Object.getPrototypeOf(value) === null,
        "INVALID_CANONICAL_INPUT",
        "Intent must be a plain object.",
      );
      result = `{${Object.keys(value)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${encode((value as Record<string, unknown>)[key])}`,
        )
        .join(",")}}`;
    }
    ancestors.delete(value);
    return result;
  }
  return encode(input);
}
export async function hash(value: unknown): Promise<`sha256:${string}`> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
export async function scopeKey(ctx: TrustedContext): Promise<string> {
  return hash([ctx.appId, ctx.environmentId, ctx.installationId, ctx.cloudId]);
}
export interface Stored<T> {
  revision: number;
  value: T;
}
export type RecordKind =
  "commitment" | "project" | "config" | "inbox" | "event";
export interface RawRow {
  id: string;
  revision: number;
  body: unknown;
}
export interface RawStore {
  get(scope: string, kind: RecordKind, id: string): Promise<RawRow | undefined>;
  list(scope: string, kind: RecordKind, limit: number): Promise<RawRow[]>;
  compareAndSet(
    scope: string,
    kind: RecordKind,
    id: string,
    expectedRevision: number,
    body: unknown,
  ): Promise<number>;
  deleteScope(scope: string): Promise<void>;
}
export class Repository {
  constructor(
    private raw: RawStore,
    private context: TrustedContext,
  ) {}
  async get<T>(
    kind: RecordKind,
    key: string,
    schema: z.ZodType<T>,
  ): Promise<Stored<T> | undefined> {
    const row = await this.raw.get(await scopeKey(this.context), kind, key);
    return row
      ? { revision: row.revision, value: schema.parse(row.body) }
      : undefined;
  }
  async list<T>(
    kind: RecordKind,
    schema: z.ZodType<T>,
    limit = 200,
  ): Promise<Array<Stored<T>>> {
    return (await this.raw.list(await scopeKey(this.context), kind, limit)).map(
      (row) => ({ revision: row.revision, value: schema.parse(row.body) }),
    );
  }
  async save<T>(
    kind: RecordKind,
    key: string,
    expectedRevision: number,
    value: T,
    schema: z.ZodType<T>,
  ): Promise<Stored<T>> {
    const parsed = schema.parse(value);
    ensure(
      new TextEncoder().encode(JSON.stringify(parsed)).length < 800_000,
      "AGGREGATE_LIMIT",
      "This record needs archival before it can grow further.",
    );
    const revision = await this.raw.compareAndSet(
      await scopeKey(this.context),
      kind,
      key,
      expectedRevision,
      parsed,
    );
    return { revision, value: parsed };
  }
  async clear() {
    await this.raw.deleteScope(await scopeKey(this.context));
  }
}

/** Test/example storage only. The live composition root uses Forge SQL. */
export class MemoryStore implements RawStore {
  private rows = new Map<string, RawRow>();
  private key(scope: string, kind: string, id: string) {
    return JSON.stringify([scope, kind, id]);
  }
  async get(scope: string, kind: RecordKind, id: string) {
    return structuredClone(this.rows.get(this.key(scope, kind, id)));
  }
  async list(scope: string, kind: RecordKind, limit: number) {
    return structuredClone(
      [...this.rows.entries()]
        .filter(([key]) => {
          const p = JSON.parse(key) as string[];
          return p[0] === scope && p[1] === kind;
        })
        .map(([, row]) => row)
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, limit),
    );
  }
  async compareAndSet(
    scope: string,
    kind: RecordKind,
    id: string,
    expected: number,
    body: unknown,
  ) {
    const key = this.key(scope, kind, id);
    const current = this.rows.get(key);
    ensure(
      (current?.revision ?? 0) === expected,
      "CONFLICT",
      "This record changed. Refresh before trying again.",
    );
    const revision = expected + 1;
    this.rows.set(key, { id, revision, body: structuredClone(body) });
    return revision;
  }
  async deleteScope(scope: string) {
    for (const key of this.rows.keys())
      if ((JSON.parse(key) as string[])[0] === scope) this.rows.delete(key);
  }
}
