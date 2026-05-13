import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createPriceItemRows, parseSinapiSyncArgs, readSinapiSyncInput, runSinapiSyncDryRun, runSinapiSyncWrite } from "../scripts/sinapi-sync-monthly.mjs";

const fixturePath = join(process.cwd(), "scripts/fixtures/sinapi-monthly-dry-run-sample.json");

describe("SINAPI monthly sync write mode", () => {
  it("keeps dry-run as the default mode", () => {
    expect(parseSinapiSyncArgs([])).toMatchObject({ dryRun: true, write: false });
    expect(parseSinapiSyncArgs(["--write"])).toMatchObject({ dryRun: false, write: true });
    expect(parseSinapiSyncArgs(["--write", "--input", fixturePath])).toMatchObject({ dryRun: false, write: true, inputProvided: true });
  });

  it("requires an explicit input path in the manual write workflow", () => {
    const workflow = readFileSync(join(process.cwd(), ".github/workflows/sinapi-monthly-sync-write.yml"), "utf8");

    expect(workflow).toContain("required: true");
    expect(workflow).not.toContain("default: \"scripts/fixtures/sinapi-monthly-dry-run-sample.json\"");
  });

  it("requires Supabase admin-only secrets before writing", async () => {
    const input = await readSinapiSyncInput(fixturePath);

    await expect(runSinapiSyncWrite(input, { env: {}, fetcher: vi.fn() })).rejects.toThrow(
      "SINAPI write mode requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  });

  it("writes staging source, rows, validation updates and audit completion through mocked Supabase REST calls", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const calls = [];
    const fetcher = vi.fn(async (url, init) => {
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method: init.method, table: getTableName(url), url: String(url), body });

      if (String(url).includes("/price_sync_runs") && init.method === "POST") return jsonResponse([{ id: "sync-run-1" }]);
      if (String(url).includes("/price_sources") && init.method === "POST") return jsonResponse([{ id: "source-staging-1" }]);
      if (String(url).includes("/price_items") && init.method === "POST") {
        return jsonResponse(body.map((row, index) => ({ ...row, id: `price-item-${index + 1}` })));
      }
      if (init.method === "PATCH") return jsonResponse([{ id: "patched" }]);
      return jsonResponse([]);
    });

    const result = await runSinapiSyncWrite(input, {
      env: {
        SUPABASE_URL: "https://prices.example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
      },
      fetcher,
    });

    expect(result).toMatchObject({
      dryRun: false,
      writeMode: true,
      syncRunId: "sync-run-1",
      sourceId: "source-staging-1",
      writtenRows: 3,
      importedRows: 3,
      statusCounts: { valid: 2, zeroed: 1 },
    });
    expect(calls.map((call) => `${call.method} ${call.table} ${call.body?.status ?? ""}`)).toEqual([
      "POST price_sync_runs started",
      "POST price_sources staging",
      "POST price_items ",
      "PATCH price_sources archived",
      "PATCH price_sources active",
      "PATCH price_sync_runs completed",
    ]);
    expect(calls[2].body).toHaveLength(3);
    expect(calls[2].body[0]).toMatchObject({
      source_id: "source-staging-1",
      item_type: "composition",
      code: "SINAPI-87489",
      unit: "m2",
      state: "BA",
      direct_unit_cost_brl: 82.45,
      price_status: "valid",
      requires_review: false,
    });
    expect(calls[3].body).toMatchObject({ status: "archived" });
    expect(calls[3].url).toContain("status=eq.active");
    expect(calls[3].url).toContain("state=eq.BA");
    expect(calls[3].url).toContain("id=neq.source-staging-1");
    expect(calls[4].body).toMatchObject({ status: "active" });
  });

  it("normalizes source state before creating active source keys", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const calls = [];
    const fetcher = vi.fn(async (url, init) => {
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method: init.method, table: getTableName(url), url: String(url), body });
      if (String(url).includes("/price_sync_runs") && init.method === "POST") return jsonResponse([{ id: "sync-run-1" }]);
      if (String(url).includes("/price_sources") && init.method === "POST") return jsonResponse([{ id: "source-staging-1" }]);
      if (String(url).includes("/price_items") && init.method === "POST") {
        return jsonResponse(body.map((row, index) => ({ ...row, id: `price-item-${index + 1}` })));
      }
      if (init.method === "PATCH") return jsonResponse([{ id: "patched" }]);
      return jsonResponse([]);
    });

    await runSinapiSyncWrite(
      {
        ...input,
        source: { ...input.source, state: "Bahia" },
      },
      {
        env: {
          SUPABASE_URL: "https://prices.example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        },
        fetcher,
      }
    );

    expect(calls[0].body).toMatchObject({ state: "BA" });
    expect(calls[1].body).toMatchObject({ state: "BA" });
    expect(calls.find((call) => call.body?.status === "archived")?.url).toContain("state=eq.BA");
  });

  it("rejects negative component costs before write mode creates audit records", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const invalidInput = {
      ...input,
      rows: [{ ...input.rows[0], material: -1 }],
    };

    const dryRun = runSinapiSyncDryRun(invalidInput);

    expect(dryRun.valid).toBe(false);
    expect(dryRun.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "negative-component-cost", severity: "invalid" })]));
    await expect(
      runSinapiSyncWrite(invalidInput, {
        env: {
          SUPABASE_URL: "https://prices.example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        },
        fetcher: vi.fn(),
      })
    ).rejects.toThrow("Cannot write invalid SINAPI input.");
  });

  it("rejects non-numeric component costs before write mode creates audit records", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const invalidInput = {
      ...input,
      rows: [{ ...input.rows[0], hh: "--" }],
    };

    const dryRun = runSinapiSyncDryRun(invalidInput);

    expect(dryRun.valid).toBe(false);
    expect(dryRun.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-component-cost", severity: "invalid" })]));
    await expect(
      runSinapiSyncWrite(invalidInput, {
        env: {
          SUPABASE_URL: "https://prices.example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        },
        fetcher: vi.fn(),
      })
    ).rejects.toThrow("Cannot write invalid SINAPI input.");
  });

  it("coerces unsupported row regimes to unknown before price item insertion", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const rows = createPriceItemRows([{ ...input.rows[0], regime: "nao informado" }], "source-staging-1", input.source);

    expect(rows[0]).toMatchObject({
      regime: "unknown",
      price_status: "requires_review",
      requires_review: true,
    });
  });

  it("records sync failure after a started run", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const calls = [];
    const fetcher = vi.fn(async (url, init) => {
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method: init.method, table: getTableName(url), body });
      if (String(url).includes("/price_sync_runs") && init.method === "POST") return jsonResponse([{ id: "sync-run-1" }]);
      if (String(url).includes("/price_sources") && init.method === "POST") return jsonResponse([{ id: "source-staging-1" }]);
      if (String(url).includes("/price_items") && init.method === "POST") return jsonResponse([{ id: "only-one-row" }]);
      if (init.method === "PATCH") return jsonResponse([{ id: "patched" }]);
      return jsonResponse([]);
    });

    await expect(
      runSinapiSyncWrite(input, {
        env: {
          SUPABASE_URL: "https://prices.example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        },
        fetcher,
      })
    ).rejects.toThrow("Supabase write returned 1 row(s), expected 3.");

    expect(calls.map((call) => `${call.method} ${call.table} ${call.body?.status ?? ""}`)).toEqual([
      "POST price_sync_runs started",
      "POST price_sources staging",
      "POST price_items ",
      "PATCH price_sources failed",
      "PATCH price_sync_runs failed",
    ]);
  });

  it("keeps a newly active source active when only final audit completion fails", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const calls = [];
    const fetcher = vi.fn(async (url, init) => {
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method: init.method, table: getTableName(url), body });
      if (String(url).includes("/price_sync_runs") && init.method === "POST") return jsonResponse([{ id: "sync-run-1" }]);
      if (String(url).includes("/price_sources") && init.method === "POST") return jsonResponse([{ id: "source-staging-1" }]);
      if (String(url).includes("/price_items") && init.method === "POST") {
        return jsonResponse(body.map((row, index) => ({ ...row, id: `price-item-${index + 1}` })));
      }
      if (String(url).includes("/price_sync_runs") && init.method === "PATCH" && body?.status === "completed") {
        return jsonResponse({ error: "audit failed" }, 500);
      }
      if (init.method === "PATCH") return jsonResponse([{ id: "patched" }]);
      return jsonResponse([]);
    });

    await expect(
      runSinapiSyncWrite(input, {
        env: {
          SUPABASE_URL: "https://prices.example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        },
        fetcher,
      })
    ).rejects.toThrow("Supabase price_sync_runs PATCH failed with status 500");

    expect(calls.map((call) => `${call.method} ${call.table} ${call.body?.status ?? ""}`)).toEqual([
      "POST price_sync_runs started",
      "POST price_sources staging",
      "POST price_items ",
      "PATCH price_sources archived",
      "PATCH price_sources active",
      "PATCH price_sync_runs completed",
      "PATCH price_sync_runs failed",
    ]);
    expect(calls).not.toEqual(expect.arrayContaining([expect.objectContaining({ table: "price_sources", body: expect.objectContaining({ status: "failed" }) })]));
  });

  it("restores the previous active source if promotion fails after archiving", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const calls = [];
    const fetcher = vi.fn(async (url, init) => {
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method: init.method, table: getTableName(url), url: String(url), body });
      if (String(url).includes("/price_sync_runs") && init.method === "POST") return jsonResponse([{ id: "sync-run-1" }]);
      if (String(url).includes("/price_sources") && init.method === "POST") return jsonResponse([{ id: "source-staging-1" }]);
      if (String(url).includes("/price_items") && init.method === "POST") {
        return jsonResponse(body.map((row, index) => ({ ...row, id: `price-item-${index + 1}` })));
      }
      if (String(url).includes("/price_sources") && init.method === "PATCH" && body?.status === "archived") return jsonResponse([{ id: "source-active-previous" }]);
      if (String(url).includes("/price_sources") && init.method === "PATCH" && body?.status === "active" && String(url).includes("source-staging-1")) {
        return jsonResponse({ error: "unique active source violation" }, 409);
      }
      if (init.method === "PATCH") return jsonResponse([{ id: "patched" }]);
      return jsonResponse([]);
    });

    await expect(
      runSinapiSyncWrite(input, {
        env: {
          SUPABASE_URL: "https://prices.example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        },
        fetcher,
      })
    ).rejects.toThrow("Supabase price_sources PATCH failed with status 409");

    expect(calls.map((call) => `${call.method} ${call.table} ${call.body?.status ?? ""}`)).toEqual([
      "POST price_sync_runs started",
      "POST price_sources staging",
      "POST price_items ",
      "PATCH price_sources archived",
      "PATCH price_sources active",
      "PATCH price_sources active",
      "PATCH price_sources failed",
      "PATCH price_sync_runs failed",
    ]);
    expect(calls[5].url).toContain("id=eq.source-active-previous");
  });

  it("keeps service role key references out of app and client runtime code", () => {
    const forbidden = /SUPABASE_SERVICE_ROLE_KEY|service_role/i;
    const runtimeFiles = [...listFiles(join(process.cwd(), "src/app")), ...listFiles(join(process.cwd(), "src/components")), ...listFiles(join(process.cwd(), "src/lib"))];

    for (const file of runtimeFiles) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(forbidden);
    }
  });
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function getTableName(url) {
  const pathname = new URL(String(url)).pathname;
  return pathname.split("/").at(-1);
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) return [];
    return [fullPath];
  });
}
