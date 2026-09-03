import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { splitSqlStatements } from "@/lib/db/migrate";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("community schema ensure applies pending migrations", () => {
  it("always calls applyMigrations even when base tables already exist", () => {
    const source = read("src/lib/db/ensure-community-schema.ts");
    expect(source).toContain("await applyMigrations()");
    expect(source).not.toContain("count(*) = 3 as ready");
    expect(source).not.toContain("if (!result.rows[0]?.ready)");
  });

  it("keeps dollar-quoted DO blocks intact when splitting SQL", () => {
    const sql = `
      alter table community_picks add column if not exists call_slot text;
      do $$
      begin
        if not exists (select 1 from pg_constraint where conname = 'x') then
          alter table community_picks add constraint x primary key (user_id);
        end if;
      end $$;
      create index if not exists y on community_picks (group_id);
    `;
    const parts = splitSqlStatements(sql);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toContain("add column if not exists call_slot");
    expect(parts[1]).toContain("do $$");
    expect(parts[1]).toContain("end $$");
    expect(parts[1]).toContain("primary key (user_id)");
    expect(parts[2]).toContain("create index if not exists y");
  });

  it("014 five-call migration remains additive and includes call_slot", () => {
    const migration = read("migrations/014_five_call_picks.sql");
    expect(migration).toContain("call_slot");
    expect(migration).toContain("default 'STOCK_1'");
    expect(migration).not.toContain("delete from community_picks");
    const parts = splitSqlStatements(migration);
    expect(parts.some((part) => part.includes("do $$"))).toBe(true);
    expect(parts.every((part) => part.includes("do $$") ? part.includes("end $$") : true)).toBe(
      true,
    );
  });
});
