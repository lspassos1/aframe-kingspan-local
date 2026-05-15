#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const defaultLimit = 1;
const sensitiveTokenPattern = /(?:authorization|apikey|api[_-]?key|bearer|token|secret|service[_-]?role)\s*[:=]?\s*[^\s,;]+/gi;

function printHelp() {
  console.log(`Supabase price DB smoke check

Usage:
  node scripts/supabase-price-db-smoke.mjs --json
  node scripts/supabase-price-db-smoke.mjs --query alvenaria --state BA --limit 1

Required env:
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY

This script uses public read credentials only. It never requires or sends a service-role key.`);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    json: false,
    help: false,
    query: "",
    state: "",
    referenceMonth: "",
    regime: "",
    unit: "",
    category: "",
    constructionMethod: "",
    limit: defaultLimit,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--query") args.query = argv[++index] ?? "";
    else if (arg === "--state") args.state = argv[++index] ?? "";
    else if (arg === "--reference-month") args.referenceMonth = argv[++index] ?? "";
    else if (arg === "--regime") args.regime = argv[++index] ?? "";
    else if (arg === "--unit") args.unit = argv[++index] ?? "";
    else if (arg === "--category") args.category = argv[++index] ?? "";
    else if (arg === "--construction-method") args.constructionMethod = argv[++index] ?? "";
    else if (arg === "--limit") {
      const parsed = Number(argv[++index]);
      args.limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.round(parsed), 10) : defaultLimit;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return args;
}

function requiredEnv(env, key) {
  return String(env[key] ?? "").trim();
}

function sanitizeSmokeError(value) {
  return String(value ?? "")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(sensitiveTokenPattern, "[redacted]")
    .replace(/[A-Za-z0-9_-]{28,}/g, "[redacted]")
    .trim()
    .slice(0, 180);
}

function createCheck(status, detail) {
  return { status, detail };
}

function createMissingConfigReport() {
  return {
    ok: false,
    status: "missing-config",
    configured: false,
    checks: {
      publicConfig: createCheck("failed", "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."),
      publicServiceRole: createCheck("passed", "No public service-role key is required."),
      rpc: createCheck("skipped", "RPC was not called because public read config is missing."),
      currentView: createCheck("skipped", "View was not called because public read config is missing."),
      activeOnly: createCheck("skipped", "Active-source visibility was not checked."),
    },
    latestActiveSource: null,
    candidateCount: 0,
  };
}

function createClient(env, fetcher) {
  const supabaseUrl = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return {
    configured: Boolean(supabaseUrl && anonKey),
    async request(path, init = {}) {
      const response = await fetcher(`${supabaseUrl}${path}`, {
        ...init,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      const text = await response.text();
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }
      return { response, payload };
    },
  };
}

function toSearchPayload(args) {
  return {
    search_query: args.query || null,
    search_state: args.state || null,
    search_reference_month: args.referenceMonth || null,
    search_regime: args.regime || null,
    search_unit: args.unit || null,
    search_category: args.category || null,
    search_construction_method: args.constructionMethod || null,
    search_limit: args.limit ?? defaultLimit,
  };
}

function normalizeLimit(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.round(parsed), 10) : defaultLimit;
}

function mapLatestSource(payload) {
  if (!Array.isArray(payload) || payload.length === 0 || !payload[0] || typeof payload[0] !== "object") return null;
  const row = payload[0];
  return {
    status: String(row.status ?? ""),
    referenceMonth: String(row.reference_month ?? "").slice(0, 10),
    state: String(row.state ?? ""),
    regime: String(row.regime ?? ""),
    importedAt: String(row.imported_at ?? ""),
  };
}

function assertNoPublicServiceRole(env) {
  const publicForbidden = Object.keys(env).filter((key) => /^NEXT_PUBLIC_.*(SERVICE_ROLE|SECRET_KEY|SUPABASE_SERVICE)/i.test(key) && requiredEnv(env, key));
  if (publicForbidden.length > 0) {
    throw new Error(`Public service-role style env is not allowed: ${publicForbidden.join(", ")}`);
  }
}

async function runStep(fn) {
  try {
    return await fn();
  } catch (error) {
    return { error: sanitizeSmokeError(error instanceof Error ? error.message : String(error)) || "Request failed." };
  }
}

export async function runSupabasePriceDbSmoke({
  env = process.env,
  fetcher = fetch,
  args = {},
} = {}) {
  const options = { ...parseArgs([]), ...args };
  options.limit = normalizeLimit(options.limit);
  const client = createClient(env, fetcher);
  if (!client.configured) return createMissingConfigReport();

  const report = {
    ok: false,
    status: "failed",
    configured: true,
    checks: {
      publicConfig: createCheck("passed", "Public Supabase read config is present."),
      publicServiceRole: createCheck("passed", "No public service-role key is present."),
      rpc: createCheck("pending", "RPC not checked yet."),
      currentView: createCheck("pending", "Current price view not checked yet."),
      activeOnly: createCheck("pending", "Active-source visibility not checked yet."),
    },
    latestActiveSource: null,
    candidateCount: 0,
  };

  try {
    assertNoPublicServiceRole(env);
  } catch (error) {
    report.checks.publicServiceRole = createCheck("failed", sanitizeSmokeError(error instanceof Error ? error.message : String(error)));
    return report;
  }

  const rpc = await runStep(() =>
    client.request("/rest/v1/rpc/search_price_candidates", {
      method: "POST",
      body: JSON.stringify(toSearchPayload(options)),
    })
  );
  if ("error" in rpc) {
    report.checks.rpc = createCheck("failed", rpc.error);
    return report;
  }
  if (!rpc.response.ok || !Array.isArray(rpc.payload)) {
    report.checks.rpc = createCheck("failed", `RPC returned ${rpc.response.status}.`);
    return report;
  }
  report.candidateCount = rpc.payload.length;
  report.checks.rpc = createCheck("passed", "RPC de preços respondendo.");

  const currentView = await runStep(() => client.request("/rest/v1/current_price_items?select=source_id,reference_month,state,regime,price_status,requires_review&limit=5"));
  if ("error" in currentView) {
    report.checks.currentView = createCheck("failed", currentView.error);
    return report;
  }
  if (!currentView.response.ok || !Array.isArray(currentView.payload)) {
    report.checks.currentView = createCheck("failed", `current_price_items returned ${currentView.response.status}.`);
    return report;
  }
  report.checks.currentView = createCheck("passed", "current_price_items respondeu pela leitura pública.");

  const nonActiveSources = await runStep(() => client.request("/rest/v1/price_sources?select=id,status&status=neq.active&limit=1"));
  if ("error" in nonActiveSources) {
    report.checks.activeOnly = createCheck("failed", nonActiveSources.error);
    return report;
  }
  if (!nonActiveSources.response.ok || !Array.isArray(nonActiveSources.payload)) {
    report.checks.activeOnly = createCheck("failed", `price_sources active-only check returned ${nonActiveSources.response.status}.`);
    return report;
  }
  if (nonActiveSources.payload.length > 0) {
    report.checks.activeOnly = createCheck("failed", "Public read returned non-active price sources.");
    return report;
  }
  report.checks.activeOnly = createCheck("passed", "Public read hides non-active price sources.");

  const latestSource = await runStep(() =>
    client.request("/rest/v1/price_sources?select=status,reference_month,state,regime,imported_at&status=eq.active&order=reference_month.desc&limit=1")
  );
  if (!("error" in latestSource) && latestSource.response.ok) {
    report.latestActiveSource = mapLatestSource(latestSource.payload);
  }

  report.ok = true;
  report.status = "ok";
  return report;
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }

  const report = await runSupabasePriceDbSmoke({ args });
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.ok) {
    console.log("Supabase price DB smoke passed.");
  } else {
    console.error(`Supabase price DB smoke failed: ${report.status}`);
    console.error(JSON.stringify(report.checks, null, 2));
  }

  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(sanitizeSmokeError(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
