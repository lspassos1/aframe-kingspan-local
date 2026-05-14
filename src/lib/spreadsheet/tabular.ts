export type SpreadsheetRow = Record<string, unknown>;

type ReadSpreadsheetModule = typeof import("read-excel-file/browser");
type WriteSpreadsheetModule = typeof import("write-excel-file/browser");
type SpreadsheetCell = import("write-excel-file/browser").Cell;
type SpreadsheetSheet = import("write-excel-file/browser").Sheet<Blob>;

let readSpreadsheetModule: ReadSpreadsheetModule | null = null;
let readSpreadsheetModulePromise: Promise<ReadSpreadsheetModule> | null = null;
let writeSpreadsheetModule: WriteSpreadsheetModule | null = null;
let writeSpreadsheetModulePromise: Promise<WriteSpreadsheetModule> | null = null;

export function isSpreadsheetLibraryReady() {
  return Boolean(readSpreadsheetModule && writeSpreadsheetModule);
}

export async function prepareSpreadsheetLibrary() {
  await Promise.all([loadReadSpreadsheetModule(), loadWriteSpreadsheetModule()]);
}

export function parseCsvRows(content: string): SpreadsheetRow[] {
  return recordsToRows(parseCsvRecords(content, detectCsvDelimiter(content)));
}

export async function parseXlsxRows(data: ArrayBuffer): Promise<SpreadsheetRow[]> {
  const readWorkbook = (await loadReadSpreadsheetModule()).default;
  const sheets = await readWorkbook(data);
  for (const sheet of sheets) {
    const rows = recordsToRows(sheet.data.map((record) => record.map(normalizeCellValue)));
    if (rows.length > 0) return rows;
  }
  return [];
}

export function rowsToCsv(rows: SpreadsheetRow[]) {
  const headers = getWorkbookHeaders(rows);
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))].map((record) => record.map(escapeCsvCell).join(",")).join("\n");
}

export async function createXlsxBlobPartFromSheets(sheets: Array<{ name: string; rows: SpreadsheetRow[] }>): Promise<BlobPart> {
  const writeSpreadsheet = (await loadWriteSpreadsheetModule()).default;
  const workbookSheets: SpreadsheetSheet[] = sheets.map((sheet) => {
    const headers = getWorkbookHeaders(sheet.rows);
    return {
      sheet: sanitizeWorksheetName(sheet.name),
      data: headers.length === 0 ? [] : [headers.map(toSpreadsheetCell), ...sheet.rows.map((row) => headers.map((header) => toSpreadsheetCell(row[header])))],
    };
  });
  return writeSpreadsheet(workbookSheets).toBlob();
}

async function loadReadSpreadsheetModule(): Promise<ReadSpreadsheetModule> {
  if (readSpreadsheetModule) return readSpreadsheetModule;
  readSpreadsheetModulePromise ??= import("read-excel-file/browser")
    .then((module) => {
      readSpreadsheetModule = module;
      return module;
    })
    .catch((error) => {
      readSpreadsheetModulePromise = null;
      throw error;
    });
  return readSpreadsheetModulePromise;
}

async function loadWriteSpreadsheetModule(): Promise<WriteSpreadsheetModule> {
  if (writeSpreadsheetModule) return writeSpreadsheetModule;
  writeSpreadsheetModulePromise ??= import("write-excel-file/browser")
    .then((module) => {
      writeSpreadsheetModule = module;
      return module;
    })
    .catch((error) => {
      writeSpreadsheetModulePromise = null;
      throw error;
    });
  return writeSpreadsheetModulePromise;
}

function parseCsvRecords(content: string, delimiter: "," | ";") {
  const normalized = content.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      record.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
      continue;
    }
    if (char === "\r") continue;
    cell += char;
  }

  record.push(cell);
  if (record.some((value) => value.trim())) records.push(record);
  return records;
}

function detectCsvDelimiter(content: string): "," | ";" {
  const firstContentLine = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim());
  if (!firstContentLine) return ",";
  return countUnquotedDelimiter(firstContentLine, ";") > countUnquotedDelimiter(firstContentLine, ",") ? ";" : ",";
}

function countUnquotedDelimiter(line: string, delimiter: "," | ";") {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        index += 1;
      } else if (char === '"') {
        quoted = false;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) count += 1;
  }
  return count;
}

function recordsToRows(records: unknown[][]): SpreadsheetRow[] {
  const headers = records[0]?.map((value) => String(value ?? "").trim()) ?? [];
  if (headers.length === 0 || headers.every((header) => !header)) return [];
  return records
    .slice(1)
    .filter((record) => record.some((value) => String(value ?? "").trim()))
    .map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""] as const).filter(([header]) => header)));
}

function normalizeCellValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (!value || typeof value !== "object") return value ?? "";
  if ("error" in value && typeof value.error === "string") return value.error;
  if ("result" in value) return normalizeCellValue(value.result);
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
  }
  return String(value);
}

function getWorkbookHeaders(rows: SpreadsheetRow[]) {
  return Array.from(
    rows.reduce((headers, row) => {
      Object.keys(row).forEach((header) => headers.add(header));
      return headers;
    }, new Set<string>())
  );
}

function escapeCsvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toSpreadsheetCell(value: unknown): SpreadsheetCell {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function sanitizeWorksheetName(name: string) {
  const sanitized = name.replace(/[[\]\\/*?:]/g, " ").trim() || "Sheet";
  return sanitized.slice(0, 31);
}
