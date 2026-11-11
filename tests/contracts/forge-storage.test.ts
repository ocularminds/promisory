import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock("@forge/sql", () => ({
  sql: { prepare: mock.prepare },
  migrationRunner: {},
}));
import { ForgeSqlStore } from "../../apps/forge/src/storage";

describe("Forge SQL pagination boundary", () => {
  beforeEach(() => mock.prepare.mockReset());

  it("uses a validated literal page limit while binding tenant and kind values", async () => {
    const bind = vi.fn();
    mock.prepare.mockImplementation((query: string) => {
      // The live TiDB service returns ER_WRONG_ARGUMENTS for a bound LIMIT.
      if (/LIMIT \?/.test(query)) throw new Error("ER_WRONG_ARGUMENTS");
      bind.mockReturnValue({
        execute: async () => ({
          rows: [
            {
              record_id: "fixture",
              revision: 2,
              body_json: '{"schemaVersion":1}',
            },
          ],
        }),
      });
      return { bindParams: bind };
    });
    const scope = "tenant-value-with-'quote";
    const records = await new ForgeSqlStore().list(scope, "commitment", 25);
    const query = mock.prepare.mock.calls[0]![0] as string;
    expect(query).toMatch(/scope_hash = \? AND record_kind = \?/);
    expect(query).toMatch(/LIMIT 25$/);
    expect(query).not.toContain(scope);
    expect(bind).toHaveBeenCalledWith(scope, "commitment");
    expect(records).toEqual([
      { id: "fixture", revision: 2, body: { schemaVersion: 1 } },
    ]);
  });

  it("rejects nonnumeric, fractional, unbounded and injection-shaped limits before issuing SQL", async () => {
    const store = new ForgeSqlStore();
    for (const invalid of [
      0,
      -1,
      501,
      1.5,
      NaN,
      Infinity,
      "25",
      "25; DELETE FROM promisory_records",
      { valueOf: () => 25 },
    ])
      await expect(
        store.list("tenant", "commitment", invalid as number),
      ).rejects.toMatchObject({ code: "INVALID_LIMIT" });
    expect(mock.prepare).not.toHaveBeenCalled();
  });
});
