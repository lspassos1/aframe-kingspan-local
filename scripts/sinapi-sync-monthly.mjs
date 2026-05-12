#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultInputPath = path.join(__dirname, "fixtures", "sinapi-monthly-dry-run-sample.json");

export const sinapiDryRunRequiredSourceFields = ["title", "supplier", "state", "referenceDate", "regime"];
export const sinapiDryRunRequiredRowColumns = ["codigo", "descricao", "unidade", "preco_total", "uf", "data_base", "regime"];
export const sinapiDryRunStatuses = ["valid", "zeroed", "missing", "requires_review", "invalid_unit", "out_of_region", "invalid"];

const validUnits = new Set(["un", "m", "m2", "m3", "kg", "package", "lot"]);
const validRegimes = new Set(["onerado", "nao_desonerado", "desonerado", "unknown"]);
const validPriceStatuses = new Set(sinapiDryRunStatuses);
const defaultWriteBatchSize = 500;

export async function readSinapiSyncInput(inputPath = defaultInputPath) {
  const raw = await readFile(inputPath, "utf8");
  return JSON.parse(raw);
}

export function runSinapiSyncDryRun(input, options = {}) {
  const source = input?.source ?? {};
  const rows = Array.isArray(input?.rows) ? input.rows : [];
  const expectedState = normalizeState(options.expectedState ?? source.state);
  const issues = [];

  for (const field of sinapiDryRunRequiredSourceFields) {
    if (!hasValue(source[field])) {
      issues.push(createIssue("missing-source-metadata", `Source metadata is missing required field "${field}".`, undefined, "invalid"));
    }
  }
  if (source.regime && !validRegimes.has(String(source.regime))) {
    issues.push(createIssue("unknown-regime", `Source regime "${source.regime}" is not supported.`, undefined, "invalid"));
  }
  if (rows.length === 0) {
    issues.push(createIssue("empty-input", "Dry-run input has no rows.", undefined, "invalid"));
  }

  const normalizedRows = rows.map((row, index) => validateSinapiDryRunRow(row, index + 2, expectedState));
  for (const row of normalizedRows) issues.push(...row.issues);

  const statusCounts = createStatusCounts(normalizedRows.map((row) => row.status));
  const invalidIssues = issues.filter((issue) => issue.severity === "invalid");

  return {
    dryRun: true,
    writeModeAvailable: false,
    source: {
      id: source.id ?? "",
      title: source.title ?? "",
      supplier: source.supplier ?? "",
      state: source.state ?? "",
      referenceDate: source.referenceDate ?? "",
      regime: source.regime ?? "unknown",
      version: source.version ?? "",
    },
    importedRows: normalizedRows.length,
    reviewRows: normalizedRows.filter((row) => row.requiresReview).length,
    statusCounts,
    issues,
    valid: invalidIssues.length === 0,
  };
}

export async function runSinapiSyncWrite(input, options = {}) {
  const dryRun = runSinapiSyncDryRun(input, options);
  if (!dryRun.valid) {
    throw new Error(`Cannot write invalid SINAPI input. Resolve ${dryRun.issues.length} dry-run issue(s) first.`);
  }

  const config = resolveSupabaseWriteConfig(options.env ?? process.env);
  const client = createSupabaseWriteClient(config, { fetcher: options.fetcher });
  const sourceType = "sinapi";
  const referenceMonth = toReferenceMonth(dryRun.source.referenceDate);
  const runPayload = {
    source_type: sourceType,
    reference_month: referenceMonth,
    state: dryRun.source.state,
    regime: dryRun.source.regime,
    status: "started",
    imported_rows: 0,
    review_rows: 0,
    status_counts: {},
  };
  let syncRun;
  let source;

  try {
    syncRun = await client.insertOne("price_sync_runs", runPayload);
    source = await client.insertOne("price_sources", {
      source_type: sourceType,
      title: dryRun.source.title,
      supplier: dryRun.source.supplier,
      state: dryRun.source.state,
      city: input?.source?.city ?? null,
      reference_month: referenceMonth,
      regime: dryRun.source.regime,
      version: dryRun.source.version || `${dryRun.source.referenceDate}-${dryRun.source.state}-${dryRun.source.regime}`,
      status: "staging",
      source_hash: input?.source?.sourceHash ?? input?.source?.hash ?? null,
      notes: input?.source?.notes ?? "",
    });

    const sourceId = requireReturnedId(source, "price_sources");
    const priceItems = createPriceItemRows(input.rows, sourceId, { ...dryRun.source, city: input?.source?.city ?? "" }, options);
    const insertedItems = await client.insertMany("price_items", priceItems, options.batchSize ?? defaultWriteBatchSize);
    validateWriteCounts(dryRun, insertedItems);

    await archivePreviousActiveSource(client, { sourceId, sourceType, source: dryRun.source, referenceMonth });
    await client.patch("price_sources", { status: "active" }, { id: `eq.${sourceId}` });
    await client.patch(
      "price_sync_runs",
      {
        status: "completed",
        finished_at: new Date().toISOString(),
        imported_rows: dryRun.importedRows,
        review_rows: dryRun.reviewRows,
        status_counts: dryRun.statusCounts,
      },
      { id: `eq.${requireReturnedId(syncRun, "price_sync_runs")}` }
    );

    return {
      ...dryRun,
      dryRun: false,
      writeMode: true,
      syncRunId: requireReturnedId(syncRun, "price_sync_runs"),
      sourceId,
      writtenRows: insertedItems.length,
      archivedPreviousActive: true,
    };
  } catch (error) {
    await recordWriteFailure(client, syncRun, source, error);
    throw error;
  }
}

export function createStatusCounts(statuses) {
  const counts = Object.fromEntries(sinapiDryRunStatuses.map((status) => [status, 0]));
  for (const status of statuses) {
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

export function validateSinapiDryRunRow(row, rowNumber, expectedState = "") {
  const issues = [];
  const data = isRecord(row) ? row : {};
  if (!isRecord(row)) {
    issues.push(createIssue("invalid-row", `Row ${rowNumber} must be an object.`, rowNumber, "invalid"));
  }
  for (const column of sinapiDryRunRequiredRowColumns) {
    if (!Object.hasOwn(data, column)) {
      issues.push(createIssue("missing-column", `Row ${rowNumber} is missing required column "${column}".`, rowNumber, "invalid"));
    }
  }

  const unit = String(data.unidade ?? "").trim();
  const total = toNumber(data.preco_total);
  const state = normalizeState(data.uf);
  const regime = String(data.regime ?? "unknown").trim() || "unknown";
  let status = "valid";

  if (issues.length > 0) status = "invalid";
  if (!hasValue(data.codigo) || !hasValue(data.descricao)) {
    issues.push(createIssue("invalid-row", `Row ${rowNumber} must include code and description.`, rowNumber, "invalid"));
    status = "invalid";
  }
  if (unit && !validUnits.has(unit)) {
    issues.push(createIssue("invalid-unit", `Row ${rowNumber} has unsupported unit "${unit}".`, rowNumber, "invalid"));
    if (status === "valid") status = "invalid_unit";
  }
  if (!Number.isFinite(total)) {
    issues.push(createIssue("missing-price", `Row ${rowNumber} has no numeric total price.`, rowNumber));
    if (status === "valid") status = "missing";
  } else if (total === 0) {
    issues.push(createIssue("zeroed-price", `Row ${rowNumber} has zero price and must remain under review.`, rowNumber));
    if (status === "valid") status = "zeroed";
  } else if (total < 0) {
    issues.push(createIssue("invalid-price", `Row ${rowNumber} has negative price.`, rowNumber, "invalid"));
    status = "invalid";
  }
  if (!state) {
    issues.push(createIssue("missing-state", `Row ${rowNumber} has no UF/state.`, rowNumber));
    if (status === "valid") status = "requires_review";
  } else if (expectedState && state !== expectedState) {
    issues.push(createIssue("out-of-region", `Row ${rowNumber} UF "${data.uf}" differs from source/project UF.`, rowNumber));
    if (status === "valid") status = "out_of_region";
  }
  if (!validRegimes.has(regime)) {
    issues.push(createIssue("unknown-regime", `Row ${rowNumber} has unsupported regime "${regime}".`, rowNumber));
    if (status === "valid") status = "requires_review";
  }

  return {
    rowNumber,
    code: String(data.codigo ?? ""),
    description: String(data.descricao ?? ""),
    unit,
    status,
    requiresReview: status !== "valid",
    issues,
  };
}

export function parseSinapiSyncArgs(argv) {
  const args = {
    dryRun: true,
    write: false,
    inputPath: defaultInputPath,
    expectedState: undefined,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") {
      args.dryRun = true;
      args.write = false;
    }
    else if (value === "--json") args.json = true;
    else if (value === "--input") {
      args.inputPath = path.resolve(readRequiredArgValue(argv, index, "--input"));
      index += 1;
    } else if (value === "--expected-state") {
      args.expectedState = readRequiredArgValue(argv, index, "--expected-state");
      index += 1;
    }
    else if (value === "--write" || value === "--write-mode" || value === "--mode=write") {
      args.write = true;
      args.dryRun = false;
    } else if (value === "--help" || value === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return args;
}

export function formatSinapiDryRunSummary(result) {
  return [
    "SINAPI monthly sync dry-run",
    `Source: ${result.source.title || "unknown"} (${result.source.state || "UF?"} ${result.source.referenceDate || "reference?"})`,
    `Rows: ${result.importedRows}`,
    `Rows requiring review: ${result.reviewRows}`,
    `Status counts: ${JSON.stringify(result.statusCounts)}`,
    `Issues: ${result.issues.length}`,
    `Valid dry-run: ${result.valid ? "yes" : "no"}`,
    `Write mode: ${result.writeMode ? "completed" : "available only with --write"}`,
  ].join("\n");
}

async function main() {
  const args = parseSinapiSyncArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/sinapi-sync-monthly.mjs --dry-run [--input file.json] [--expected-state UF] [--json]");
    return;
  }
  const input = await readSinapiSyncInput(args.inputPath);
  const result = args.write ? await runSinapiSyncWrite(input, { expectedState: args.expectedState }) : runSinapiSyncDryRun(input, { expectedState: args.expectedState });
  console.log(args.json ? JSON.stringify(result, null, 2) : formatSinapiDryRunSummary(result));
  if (!result.valid) process.exitCode = 1;
}

export function resolveSupabaseWriteConfig(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SINAPI write mode requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    serviceRoleKey,
  };
}

export function createSupabaseWriteClient(config, options = {}) {
  const fetcher = options.fetcher ?? fetch;
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function request(method, table, body, query = {}, prefer = "return=representation") {
    const url = `${config.supabaseUrl}/rest/v1/${table}${formatQuery(query)}`;
    const response = await fetcher(url, {
      method,
      headers: {
        ...headers,
        Prefer: prefer,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Supabase ${table} ${method} failed with status ${response.status}: ${await readResponseText(response)}`);
    }
    if (response.status === 204) return [];
    const text = await response.text();
    if (!text) return [];
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  return {
    insertOne: async (table, body) => {
      const rows = await request("POST", table, body);
      return rows[0];
    },
    insertMany: async (table, rows, batchSize = defaultWriteBatchSize) => {
      const inserted = [];
      for (let index = 0; index < rows.length; index += batchSize) {
        inserted.push(...(await request("POST", table, rows.slice(index, index + batchSize))));
      }
      return inserted;
    },
    patch: async (table, body, query) => request("PATCH", table, body, query),
  };
}

export function createPriceItemRows(rows, sourceId, source, options = {}) {
  return rows.map((row, index) => {
    const normalized = validateSinapiDryRunRow(row, index + 2, normalizeState(options.expectedState ?? source.state));
    const materialCost = toNumber(row.material);
    const laborCost = toNumber(row.mao_obra);
    const equipmentCost = toNumber(row.equipamento);
    const directCost = toNumber(row.preco_total);
    const category = String(row.etapa ?? "civil").trim() || "civil";
    const constructionMethod = String(row.metodo ?? "conventional-masonry").trim() || "conventional-masonry";
    const tags = parseTags(row.tags);
    const pendingReason = normalized.issues.map((issue) => issue.message).join(" ");

    return {
      source_id: sourceId,
      item_type: row.tipo_item === "input" ? "input" : "composition",
      code: normalized.code,
      description: normalized.description,
      unit: normalized.unit,
      category,
      construction_method: constructionMethod,
      state: normalizeState(row.uf || source.state),
      city: source.city || null,
      reference_month: toReferenceMonth(row.data_base || source.referenceDate),
      regime: String(row.regime ?? source.regime ?? "unknown").trim() || "unknown",
      material_cost_brl: Number.isFinite(materialCost) ? materialCost : 0,
      labor_cost_brl: Number.isFinite(laborCost) ? laborCost : 0,
      equipment_cost_brl: Number.isFinite(equipmentCost) ? equipmentCost : 0,
      third_party_cost_brl: Number.isFinite(toNumber(row.terceiros)) ? toNumber(row.terceiros) : 0,
      other_cost_brl: Number.isFinite(toNumber(row.outros)) ? toNumber(row.outros) : 0,
      direct_unit_cost_brl: Number.isFinite(directCost) ? directCost : 0,
      total_labor_hours_per_unit: Number.isFinite(toNumber(row.hh)) ? toNumber(row.hh) : 0,
      price_status: validPriceStatuses.has(normalized.status) ? normalized.status : "requires_review",
      confidence: normalized.status === "valid" ? "high" : "medium",
      requires_review: normalized.requiresReview,
      pending_reason: pendingReason,
      tags,
      search_text: [normalized.code, normalized.description, category, constructionMethod, ...tags].filter(Boolean).join(" "),
    };
  });
}

function createIssue(code, message, rowNumber, severity = "pending") {
  return { code, message, rowNumber, severity };
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function normalizeState(value) {
  return String(value ?? "").trim().toUpperCase();
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRequiredArgValue(argv, index, name) {
  const next = argv[index + 1];
  if (!next || next.startsWith("--")) throw new Error(`${name} requires a value.`);
  return next;
}

function validateWriteCounts(dryRun, insertedItems) {
  if (insertedItems.length !== dryRun.importedRows) {
    throw new Error(`Supabase write returned ${insertedItems.length} row(s), expected ${dryRun.importedRows}.`);
  }
}

async function archivePreviousActiveSource(client, { sourceId, sourceType, source, referenceMonth }) {
  await client.patch(
    "price_sources",
    { status: "archived" },
    {
      source_type: `eq.${sourceType}`,
      state: `eq.${source.state}`,
      reference_month: `eq.${referenceMonth}`,
      regime: `eq.${source.regime}`,
      status: "eq.active",
      id: `neq.${sourceId}`,
    }
  );
}

async function recordWriteFailure(client, syncRun, source, error) {
  const message = error instanceof Error ? error.message : String(error);
  if (source?.id) {
    await client.patch("price_sources", { status: "failed", notes: `Sync failed: ${message}` }, { id: `eq.${source.id}` }).catch(() => undefined);
  }
  if (syncRun?.id) {
    await client
      .patch(
        "price_sync_runs",
        {
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: message,
        },
        { id: `eq.${syncRun.id}` }
      )
      .catch(() => undefined);
  }
}

function requireReturnedId(row, table) {
  if (!row?.id) throw new Error(`Supabase ${table} write did not return an id.`);
  return row.id;
}

function formatQuery(query = {}) {
  const entries = Object.entries(query);
  if (entries.length === 0) return "";
  return `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&")}`;
}

async function readResponseText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function toReferenceMonth(value) {
  const normalized = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(normalized)) return `${normalized}-01`;
  return normalized;
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  return String(value ?? "")
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return Number.NaN;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
