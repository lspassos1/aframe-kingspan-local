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

export function createStatusCounts(statuses) {
  const counts = Object.fromEntries(sinapiDryRunStatuses.map((status) => [status, 0]));
  for (const status of statuses) {
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

export function validateSinapiDryRunRow(row, rowNumber, expectedState = "") {
  const issues = [];
  for (const column of sinapiDryRunRequiredRowColumns) {
    if (!Object.hasOwn(row, column)) {
      issues.push(createIssue("missing-column", `Row ${rowNumber} is missing required column "${column}".`, rowNumber, "invalid"));
    }
  }

  const unit = String(row.unidade ?? "").trim();
  const total = toNumber(row.preco_total);
  const state = normalizeState(row.uf);
  const regime = String(row.regime ?? "unknown").trim() || "unknown";
  let status = "valid";

  if (issues.length > 0) status = "invalid";
  if (!hasValue(row.codigo) || !hasValue(row.descricao)) {
    issues.push(createIssue("invalid-row", `Row ${rowNumber} must include code and description.`, rowNumber, "invalid"));
    status = "invalid";
  }
  if (unit && !validUnits.has(unit)) {
    issues.push(createIssue("invalid-unit", `Row ${rowNumber} has unsupported unit "${unit}".`, rowNumber, "invalid"));
    status = "invalid_unit";
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
    issues.push(createIssue("out-of-region", `Row ${rowNumber} UF "${row.uf}" differs from source/project UF.`, rowNumber));
    if (status === "valid") status = "out_of_region";
  }
  if (!validRegimes.has(regime)) {
    issues.push(createIssue("unknown-regime", `Row ${rowNumber} has unsupported regime "${regime}".`, rowNumber));
    if (status === "valid") status = "requires_review";
  }

  return {
    rowNumber,
    code: String(row.codigo ?? ""),
    description: String(row.descricao ?? ""),
    unit,
    status,
    requiresReview: status !== "valid",
    issues,
  };
}

export function parseSinapiSyncArgs(argv) {
  const args = {
    dryRun: true,
    inputPath: defaultInputPath,
    expectedState: undefined,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") args.dryRun = true;
    else if (value === "--json") args.json = true;
    else if (value === "--input") args.inputPath = path.resolve(argv[++index] ?? "");
    else if (value === "--expected-state") args.expectedState = argv[++index];
    else if (value === "--write" || value === "--write-mode" || value === "--mode=write") {
      throw new Error("Write mode is not implemented in this PR. Run dry-run only.");
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
    "Write mode: unavailable in this PR",
  ].join("\n");
}

async function main() {
  const args = parseSinapiSyncArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/sinapi-sync-monthly.mjs --dry-run [--input file.json] [--expected-state UF] [--json]");
    return;
  }
  if (!args.dryRun) throw new Error("Only dry-run is supported.");

  const input = await readSinapiSyncInput(args.inputPath);
  const result = runSinapiSyncDryRun(input, { expectedState: args.expectedState });
  console.log(args.json ? JSON.stringify(result, null, 2) : formatSinapiDryRunSummary(result));
  if (!result.valid) process.exitCode = 1;
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
