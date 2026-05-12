import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase/migrations/20260512215000_price_database_schema.sql");
const sql = readFileSync(migrationPath, "utf8");
const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase();

const coreTables = ["price_sources", "price_items", "composition_inputs", "waste_rules", "price_sync_runs"];

describe("external price database schema", () => {
  it("creates the expected schema-only tables", () => {
    for (const table of coreTables) {
      expect(normalizedSql).toContain(`create table if not exists public.${table}`);
      expect(normalizedSql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("keeps public read paths on security invoker behavior", () => {
    expect(normalizedSql).toContain("create or replace view public.current_price_items with (security_invoker = true)");
    expect(normalizedSql).toContain("create or replace function public.search_price_candidates");
    expect(normalizedSql).toContain("security invoker");
    expect(normalizedSql).not.toContain("security definer");
  });

  it("limits anon and authenticated roles to safe public reads", () => {
    expect(normalizedSql).toContain("grant select on public.current_price_items to anon, authenticated");
    expect(normalizedSql).toContain("grant execute on function public.search_price_candidates");
    expect(normalizedSql).not.toMatch(/grant\s+(all|insert|update|delete)[^;]+to\s+anon/i);
    expect(normalizedSql).not.toMatch(/grant\s+(all|insert|update|delete)[^;]+to\s+authenticated/i);
    expect(normalizedSql).not.toMatch(/grant\s+select\s+on\s+(table\s+)?public\.price_sync_runs\s+to\s+anon/i);
    expect(normalizedSql).not.toMatch(/grant\s+select\s+on\s+(table\s+)?public\.price_sync_runs\s+to\s+authenticated/i);
  });

  it("keeps service role usage out of public read definitions", () => {
    const publicReadSql = normalizedSql.slice(normalizedSql.indexOf("create or replace view public.current_price_items"));

    expect(publicReadSql).not.toContain("service_role");
    expect(normalizedSql).not.toContain("service_role_key");
    expect(normalizedSql).not.toContain("next_public");
  });

  it("models price quality fields required by the current budget contract", () => {
    for (const field of [
      "material_cost_brl",
      "labor_cost_brl",
      "equipment_cost_brl",
      "direct_unit_cost_brl",
      "total_labor_hours_per_unit",
      "price_status",
      "confidence",
      "requires_review",
      "pending_reason",
    ]) {
      expect(normalizedSql).toContain(field);
    }

    expect(normalizedSql).toContain("'valid', 'zeroed', 'missing', 'requires_review', 'invalid_unit', 'out_of_region', 'invalid'");
  });
});
