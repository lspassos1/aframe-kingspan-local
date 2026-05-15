import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

const script = await import(pathToFileURL(join(process.cwd(), "scripts/supabase-price-db-smoke.mjs")).href);
const runSupabasePriceDbSmoke = script.runSupabasePriceDbSmoke as (input?: {
  env?: Record<string, string | undefined>;
  fetcher?: typeof fetch;
  args?: Record<string, unknown>;
}) => Promise<{
  ok: boolean;
  status: string;
  configured: boolean;
  checks: Record<string, { status: string; detail: string }>;
  latestActiveSource: { status: string; referenceMonth: string; state: string; regime: string; importedAt: string } | null;
  candidateCount: number;
}>;
const parseArgs = script.parseArgs as (argv?: string[]) => Record<string, unknown>;

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://prices.example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-read-key",
};

describe("Supabase price DB smoke script", () => {
  it("parses explicit smoke options without requiring secrets", () => {
    expect(parseArgs(["--json", "--query", "alvenaria", "--state", "BA", "--limit", "20"])).toMatchObject({
      json: true,
      query: "alvenaria",
      state: "BA",
      limit: 10,
    });
  });

  it("returns a safe missing-config report without calling Supabase", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const report = await runSupabasePriceDbSmoke({ env: {}, fetcher });

    expect(report).toMatchObject({
      ok: false,
      status: "missing-config",
      configured: false,
      candidateCount: 0,
    });
    expect(report.checks.rpc.status).toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("checks RPC, active view and latest active source with public anon credentials", async () => {
    const fetcher = createJsonFetcher([
      [200, [createRemoteRow()]],
      [200, [{ source_id: "source-ba", reference_month: "2026-05-01", price_status: "valid", requires_review: true }]],
      [200, []],
      [200, [{ status: "active", reference_month: "2026-05-01", state: "BA", regime: "desonerado", imported_at: "2026-05-10T00:00:00Z" }]],
    ]);

    const report = await runSupabasePriceDbSmoke({
      env,
      fetcher,
      args: { query: "alvenaria", state: "BA", limit: 1 },
    });

    expect(report).toMatchObject({
      ok: true,
      status: "ok",
      configured: true,
      candidateCount: 1,
      latestActiveSource: {
        status: "active",
        referenceMonth: "2026-05-01",
        state: "BA",
        regime: "desonerado",
      },
    });
    expect(report.checks.rpc.detail).toBe("RPC de preços respondendo.");
    expect(report.checks.currentView.status).toBe("passed");
    expect(report.checks.activeOnly.status).toBe("passed");

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://prices.example.supabase.co/rest/v1/rpc/search_price_candidates",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "anon-read-key",
          Authorization: "Bearer anon-read-key",
        }),
      })
    );
    const firstRequest = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.stringify(firstRequest.headers)).not.toMatch(/service[_-]?role/i);
  });

  it("caps programmatic search limits before calling the RPC", async () => {
    const fetcher = createJsonFetcher([
      [200, []],
      [200, []],
      [200, []],
      [200, []],
    ]);

    await runSupabasePriceDbSmoke({
      env,
      fetcher,
      args: { query: "alvenaria", limit: 999 },
    });

    const firstRequest = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(firstRequest.body))).toMatchObject({
      search_limit: 10,
    });
  });

  it.each([401, 403, 500])("reports RPC %s failures without leaking response details", async (status) => {
    const fetcher = createJsonFetcher([[status, { error: "https://prices.example.supabase.co secret-token-12345678901234567890" }]]);

    const report = await runSupabasePriceDbSmoke({ env, fetcher });
    const serialized = JSON.stringify(report);

    expect(report.ok).toBe(false);
    expect(report.checks.rpc).toMatchObject({
      status: "failed",
      detail: `RPC returned ${status}.`,
    });
    expect(serialized).not.toContain("prices.example.supabase.co");
    expect(serialized).not.toContain("secret-token");
  });

  it("fails clearly when the RPC returns an unexpected payload", async () => {
    const fetcher = createJsonFetcher([[200, { rows: [createRemoteRow()] }]]);

    const report = await runSupabasePriceDbSmoke({ env, fetcher });

    expect(report.ok).toBe(false);
    expect(report.checks.rpc).toMatchObject({
      status: "failed",
      detail: "RPC returned 200.",
    });
  });

  it("does not allow public service-role style env variables", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const report = await runSupabasePriceDbSmoke({
      env: {
        ...env,
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret",
      },
      fetcher,
    });
    const serialized = JSON.stringify(report);

    expect(report.ok).toBe(false);
    expect(report.checks.publicServiceRole.status).toBe("failed");
    expect(serialized).not.toContain("eyJhbGci");
    expect(serialized).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sanitizes thrown transport errors before returning the report", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error("fetch failed at https://prices.example.supabase.co with Authorization: Bearer secret-token-12345678901234567890");
    });

    const report = await runSupabasePriceDbSmoke({ env, fetcher });
    const serialized = JSON.stringify(report);

    expect(report.ok).toBe(false);
    expect(report.checks.rpc.status).toBe("failed");
    expect(serialized).toContain("[url]");
    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("prices.example.supabase.co");
    expect(serialized).not.toContain("secret-token");
  });
});

function createJsonFetcher(responses: Array<[number, unknown]>) {
  const queue = [...responses];
  return vi.fn<typeof fetch>(async () => {
    const next = queue.shift() ?? [500, { error: "unexpected extra request" }];
    return new Response(JSON.stringify(next[1]), { status: next[0] });
  });
}

function createRemoteRow() {
  return {
    id: "remote-wall",
    source_id: "source-ba",
    source_title: "SINAPI BA",
    supplier: "CAIXA",
    source_type: "sinapi",
    item_type: "composition",
    code: "87489",
    description: "Alvenaria de vedacao",
    unit: "m2",
    category: "civil",
    construction_method: "conventional-masonry",
    state: "BA",
    city: null,
    reference_month: "2026-05-01",
    regime: "desonerado",
    direct_unit_cost_brl: 82.45,
    price_status: "valid",
    confidence: "high",
    requires_review: true,
    pending_reason: "revisar",
    tags: ["alvenaria"],
  };
}
