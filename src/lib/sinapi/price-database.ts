import JSZip from "jszip";
import * as XLSX from "xlsx";
import { constructionMethodIds, type ConstructionMethodId } from "@/lib/construction-methods";
import type {
  BudgetConfidenceLevel,
  BudgetSourceMeta,
  CompositionInput,
  LaborRole,
  PriceSource,
  ServiceComposition,
} from "@/lib/budget-assistant";
import { normalizeBrazilStateName } from "@/lib/locations/brazil";
import type { MaterialCategory, MaterialUnit } from "@/types/project";

export type SinapiRegime = "onerado" | "nao_desonerado" | "desonerado" | "unknown";

export type SinapiPriceStatus = "valid" | "zeroed" | "missing" | "requires_review" | "invalid_unit" | "out_of_region" | "invalid";

export interface SinapiSource {
  id: string;
  title: string;
  supplier: string;
  state: string;
  city: string;
  referenceDate: string;
  regime: SinapiRegime;
  uploadedFileName?: string;
  reliability: Exclude<BudgetConfidenceLevel, "unverified">;
  notes: string;
}

export interface SinapiSourceInput {
  id?: string;
  title: string;
  supplier?: string;
  state?: string;
  city?: string;
  referenceDate?: string;
  regime?: SinapiRegime | string;
  uploadedFileName?: string;
  reliability?: Exclude<BudgetConfidenceLevel, "unverified">;
  notes?: string;
}

export interface SinapiCompositionInput {
  id: string;
  kind: CompositionInput["kind"];
  description: string;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
  total: number;
}

export interface SinapiComposition {
  id: string;
  sourceId: string;
  code: string;
  description: string;
  constructionMethod: ConstructionMethodId;
  category: MaterialCategory;
  unit: MaterialUnit;
  originalUnit: string;
  tags: string[];
  state: string;
  city: string;
  referenceDate: string;
  regime: SinapiRegime;
  materialCostBRL: number;
  laborCostBRL: number;
  equipmentCostBRL: number;
  thirdPartyCostBRL: number;
  otherCostBRL: number;
  directUnitCostBRL: number;
  totalLaborHoursPerUnit: number;
  priceStatus: SinapiPriceStatus;
  confidence: BudgetConfidenceLevel;
  requiresReview: boolean;
  pendingReason: string;
  inputs: SinapiCompositionInput[];
}

export type SinapiRawRow = Record<string, unknown>;

export type SinapiColumnKey =
  | "code"
  | "description"
  | "unit"
  | "totalUnitPrice"
  | "materialCostBRL"
  | "laborCostBRL"
  | "equipmentCostBRL"
  | "totalLaborHoursPerUnit"
  | "referenceDate"
  | "state"
  | "city"
  | "regime"
  | "stage"
  | "tags"
  | "constructionMethod";

export type SinapiColumnMapping = Partial<Record<SinapiColumnKey, string | string[]>>;

export interface SinapiImportIssue {
  code:
    | "empty-file"
    | "unsupported-file"
    | "missing-code"
    | "missing-description"
    | "invalid-unit"
    | "zeroed-price"
    | "missing-price"
    | "missing-state"
    | "invalid-state"
    | "missing-reference"
    | "unknown-regime"
    | "out-of-region"
    | "invalid-row";
  message: string;
  rowNumber?: number;
  status?: SinapiPriceStatus;
}

export interface SinapiPriceBaseImportInput {
  rows?: SinapiRawRow[];
  fileName?: string;
  data?: string | ArrayBuffer;
  mapping?: SinapiColumnMapping;
  source: SinapiSourceInput;
  defaultConstructionMethod: ConstructionMethodId;
  expectedState?: string;
}

export interface SinapiPriceBaseImportResult {
  source: SinapiSource;
  priceSource: PriceSource;
  compositions: SinapiComposition[];
  serviceCompositions: ServiceComposition[];
  issues: SinapiImportIssue[];
  importedRows: number;
  reviewRows: number;
  statusCounts: Record<SinapiPriceStatus, number>;
}

export interface SinapiSearchInput {
  query?: string;
  state?: string;
  referenceDate?: string;
  regime?: SinapiRegime;
  constructionMethod?: ConstructionMethodId;
  category?: MaterialCategory;
  unit?: MaterialUnit;
  tags?: string[];
  limit?: number;
}

export interface SinapiSourceValidationResult {
  valid: boolean;
  source: SinapiSource;
  issues: SinapiImportIssue[];
}

type SinapiSearchScoreInput = Omit<SinapiSearchInput, "tags"> & {
  queryTokens: string[];
  state: string;
  tags: Set<string>;
};

export const defaultSinapiColumnMapping: Required<SinapiColumnMapping> = {
  code: ["codigo", "cod", "composicao", "item"],
  description: ["descricao", "descrição", "servico", "serviço"],
  unit: ["unidade", "un"],
  totalUnitPrice: ["preco_total", "preço_total", "total", "custo_total", "valor"],
  materialCostBRL: ["material", "mat"],
  laborCostBRL: ["mao_obra", "mão_obra", "mo", "labor"],
  equipmentCostBRL: ["equipamento", "equip"],
  totalLaborHoursPerUnit: ["hh", "h/h", "hora_homem"],
  referenceDate: ["data_base", "referencia", "referência", "mes", "mês"],
  state: ["uf", "estado"],
  city: ["cidade", "municipio", "município"],
  regime: ["regime", "desoneracao", "desoneração"],
  stage: ["etapa", "categoria", "grupo"],
  tags: ["tags", "palavras_chave"],
  constructionMethod: ["metodo", "método", "sistema"],
};

const validMaterialUnits = new Set<MaterialUnit>(["un", "m", "m2", "m3", "kg", "package", "lot"]);
const supportedFileExtensions = new Set(["csv", "xlsx", "xls", "json"]);
const allStatuses: SinapiPriceStatus[] = ["valid", "zeroed", "missing", "requires_review", "invalid_unit", "out_of_region", "invalid"];

export async function importSinapiPriceBase(input: SinapiPriceBaseImportInput): Promise<SinapiPriceBaseImportResult> {
  const rows = input.rows ?? (await parseSinapiRowsFromFile(input.fileName ?? input.source.uploadedFileName ?? "sinapi.csv", input.data));
  const source = validateSinapiSource({
    ...input.source,
    uploadedFileName: input.source.uploadedFileName ?? input.fileName,
  }).source;
  const normalized = normalizeSinapiRows(rows, {
    source,
    mapping: input.mapping ?? defaultSinapiColumnMapping,
    defaultConstructionMethod: input.defaultConstructionMethod,
    expectedState: input.expectedState,
  });
  const sourceValidation = validateSinapiSource(source);
  const issues = [...sourceValidation.issues, ...normalized.issues];
  const serviceCompositions = normalized.compositions.map((composition) => mapSinapiCompositionToServiceComposition(composition, source));
  const statusCounts = createStatusCounts(normalized.compositions);

  return {
    source,
    priceSource: mapSinapiSourceToPriceSource(source),
    compositions: normalized.compositions,
    serviceCompositions,
    issues,
    importedRows: normalized.compositions.length,
    reviewRows: normalized.compositions.filter((composition) => composition.requiresReview).length,
    statusCounts,
  };
}

export function normalizeSinapiRows(
  rows: SinapiRawRow[],
  options: {
    source: SinapiSource;
    mapping?: SinapiColumnMapping;
    defaultConstructionMethod: ConstructionMethodId;
    expectedState?: string;
  }
): { compositions: SinapiComposition[]; issues: SinapiImportIssue[] } {
  const mapping = options.mapping ?? defaultSinapiColumnMapping;
  const issues: SinapiImportIssue[] = [];
  const compositions: SinapiComposition[] = [];
  const expectedState = normalizeBrazilStateName(options.expectedState) || "";

  if (rows.length === 0) {
    return {
      compositions: [],
      issues: [{ code: "empty-file", message: "Arquivo SINAPI sem linhas válidas para importação.", status: "invalid" }],
    };
  }

  rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const code = getMappedText(row, mapping, "code");
    const description = getMappedText(row, mapping, "description");
    const originalUnit = getMappedText(row, mapping, "unit");
    const rowIssues: SinapiImportIssue[] = [];

    if (!code) rowIssues.push({ code: "missing-code", rowNumber, status: "invalid", message: `Linha ${rowNumber}: código ausente.` });
    if (!description) rowIssues.push({ code: "missing-description", rowNumber, status: "invalid", message: `Linha ${rowNumber}: descrição ausente.` });
    if (!code || !description) {
      issues.push(...rowIssues);
      return;
    }

    const unit = normalizeMaterialUnit(originalUnit);
    if (!unit) {
      rowIssues.push({
        code: "invalid-unit",
        rowNumber,
        status: "invalid_unit",
        message: `Linha ${rowNumber}: unidade "${originalUnit || "ausente"}" não é suportada.`,
      });
    }

    const rawState = getMappedText(row, mapping, "state");
    const normalizedRowState = normalizeBrazilStateName(rawState);
    const state = rawState ? normalizedRowState || rawState : options.source.state;
    const normalizedState = normalizeBrazilStateName(state);
    const city = getMappedText(row, mapping, "city") || options.source.city;
    const referenceDate = getMappedText(row, mapping, "referenceDate") || options.source.referenceDate;
    const regime = normalizeSinapiRegime(getMappedText(row, mapping, "regime") || options.source.regime);
    const priceParts = readPriceParts(row, mapping);

    if (!state) {
      rowIssues.push({ code: "missing-state", rowNumber, status: "requires_review", message: `Linha ${rowNumber}: UF ausente.` });
    } else if (!normalizedState) {
      rowIssues.push({ code: "invalid-state", rowNumber, status: "requires_review", message: `Linha ${rowNumber}: UF "${state}" inválida.` });
    }
    if (expectedState && normalizedState && normalizedState !== expectedState) {
      rowIssues.push({
        code: "out-of-region",
        rowNumber,
        status: "out_of_region",
        message: `Linha ${rowNumber}: UF ${state} fora da UF esperada ${expectedState}.`,
      });
    }
    if (!referenceDate) {
      rowIssues.push({ code: "missing-reference", rowNumber, status: "requires_review", message: `Linha ${rowNumber}: referência/data-base ausente.` });
    }
    if (regime === "unknown") {
      rowIssues.push({ code: "unknown-regime", rowNumber, status: "requires_review", message: `Linha ${rowNumber}: regime SINAPI ausente ou desconhecido.` });
    }
    if (priceParts.status === "missing") {
      rowIssues.push({ code: "missing-price", rowNumber, status: "missing", message: `Linha ${rowNumber}: preço vazio ou ausente.` });
    }
    if (priceParts.status === "zeroed") {
      rowIssues.push({ code: "zeroed-price", rowNumber, status: "zeroed", message: `Linha ${rowNumber}: preço zero fica pendente de revisão.` });
    }

    const priceStatus = resolvePriceStatus(rowIssues);
    const requiresReview = priceStatus !== "valid" || options.source.reliability !== "high";
    const confidence: BudgetConfidenceLevel = requiresReview ? "unverified" : "high";
    const compositionUnit = unit ?? "lot";
    const materialCostBRL = priceParts.materialCostBRL;
    const laborCostBRL = priceParts.laborCostBRL;
    const equipmentCostBRL = priceParts.equipmentCostBRL;
    const componentTotal = roundCurrency(materialCostBRL + laborCostBRL + equipmentCostBRL);
    const directUnitCostBRL = priceParts.totalUnitPriceBRL ?? componentTotal;
    const otherCostBRL = roundCurrency(Math.max(0, directUnitCostBRL - componentTotal));
    const category = inferMaterialCategory(getMappedText(row, mapping, "stage"), description);
    const tags = createTags(getMappedText(row, mapping, "stage"), getMappedText(row, mapping, "tags"), description);

    const composition: SinapiComposition = {
      id: createSinapiCompositionId(options.source.id, rowIndex, code),
      sourceId: options.source.id,
      code,
      description,
      constructionMethod: normalizeConstructionMethod(getMappedText(row, mapping, "constructionMethod"), options.defaultConstructionMethod),
      category,
      unit: compositionUnit,
      originalUnit,
      tags,
      state,
      city,
      referenceDate,
      regime,
      materialCostBRL,
      laborCostBRL,
      equipmentCostBRL,
      thirdPartyCostBRL: 0,
      otherCostBRL,
      directUnitCostBRL,
      totalLaborHoursPerUnit: priceParts.totalLaborHoursPerUnit,
      priceStatus,
      confidence,
      requiresReview,
      pendingReason: createPendingReason(rowIssues),
      inputs: createSinapiCompositionInputs({
        code,
        unit: compositionUnit,
        materialCostBRL,
        equipmentCostBRL,
        otherCostBRL,
      }),
    };

    compositions.push(composition);
    issues.push(...rowIssues);
  });

  return { compositions, issues };
}

export function validateSinapiSource(input: SinapiSourceInput | SinapiSource): SinapiSourceValidationResult {
  const source: SinapiSource = {
    id: input.id ?? `sinapi-source-${Date.now()}`,
    title: input.title.trim(),
    supplier: input.supplier?.trim() || "CAIXA",
    state: normalizeBrazilStateName(input.state) || input.state?.trim() || "",
    city: input.city?.trim() ?? "",
    referenceDate: input.referenceDate?.trim() ?? "",
    regime: normalizeSinapiRegime(input.regime),
    uploadedFileName: input.uploadedFileName,
    reliability: input.reliability ?? "medium",
    notes: input.notes?.trim() ?? "Base SINAPI importada pelo usuário; revisar UF, referência, regime, unidade e preço antes de usar no orçamento.",
  };
  const issues: SinapiImportIssue[] = [];

  if (!source.state) {
    issues.push({ code: "missing-state", status: "requires_review", message: "Fonte SINAPI sem UF definida." });
  } else if (!normalizeBrazilStateName(source.state)) {
    issues.push({ code: "invalid-state", status: "requires_review", message: `Fonte SINAPI com UF inválida: ${source.state}.` });
  }
  if (!source.referenceDate) {
    issues.push({ code: "missing-reference", status: "requires_review", message: "Fonte SINAPI sem referência/data-base." });
  }
  if (source.regime === "unknown") {
    issues.push({ code: "unknown-regime", status: "requires_review", message: "Fonte SINAPI sem regime definido." });
  }

  return {
    valid: issues.length === 0,
    source,
    issues,
  };
}

export function searchSinapiCompositions(compositions: SinapiComposition[], input: SinapiSearchInput = {}): SinapiComposition[] {
  const queryTokens = tokenize(input.query ?? "");
  const state = normalizeBrazilStateName(input.state) || "";
  const tags = new Set((input.tags ?? []).map(normalizeText).filter(Boolean));
  const limit = input.limit && input.limit > 0 ? input.limit : compositions.length;

  return compositions
    .map((composition) => ({ composition, score: scoreSinapiComposition(composition, { ...input, queryTokens, state, tags }) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.composition.code.localeCompare(b.composition.code))
    .slice(0, limit)
    .map((item) => item.composition);
}

export function mapSinapiCompositionToServiceComposition(composition: SinapiComposition, source?: SinapiSource): ServiceComposition {
  const requiresReview = composition.requiresReview || composition.priceStatus !== "valid";
  const meta = createSourceMeta(composition, requiresReview);

  return {
    ...meta,
    id: composition.id,
    constructionMethod: composition.constructionMethod,
    category: composition.category,
    serviceCode: composition.code,
    description: composition.description,
    unit: composition.unit,
    tags: createTags(source?.regime ?? composition.regime, composition.tags.join(";"), composition.description),
    inputs: composition.inputs.map((input) => ({
      ...meta,
      ...input,
    })),
    laborRoles: createLaborRoles(composition, meta),
    wasteRules: [],
    materialCostBRL: composition.materialCostBRL,
    laborCostBRL: composition.laborCostBRL,
    equipmentCostBRL: composition.equipmentCostBRL,
    thirdPartyCostBRL: composition.thirdPartyCostBRL,
    otherCostBRL: composition.otherCostBRL,
    directUnitCostBRL: composition.directUnitCostBRL,
    totalLaborHoursPerUnit: composition.totalLaborHoursPerUnit,
    sinapi: {
      sourceId: composition.sourceId,
      sourceTitle: source?.title,
      code: composition.code,
      description: composition.description,
      state: composition.state,
      city: composition.city,
      referenceDate: composition.referenceDate,
      regime: composition.regime,
      priceStatus: composition.priceStatus,
      confidence: composition.confidence,
      requiresReview,
      pendingReason: composition.pendingReason,
      totalLaborHoursPerUnit: composition.totalLaborHoursPerUnit,
    },
  };
}

export async function parseSinapiRowsFromFile(fileName: string, data: string | ArrayBuffer | undefined): Promise<SinapiRawRow[]> {
  if (data === undefined) return [];
  const extension = getFileExtension(fileName);

  if (extension === "zip") return parseSinapiZip(data);
  if (extension === "json") return parseSinapiJson(typeof data === "string" ? data : new TextDecoder().decode(data));
  if (extension === "xlsx" || extension === "xls") return parseSinapiXlsx(toArrayBuffer(data));
  if (extension === "csv") return parseSinapiCsv(typeof data === "string" ? data : new TextDecoder().decode(data));

  throw new Error(`Arquivo SINAPI com extensão .${extension} não suportada.`);
}

function mapSinapiSourceToPriceSource(source: SinapiSource): PriceSource {
  return {
    id: source.id,
    type: "sinapi",
    title: source.title,
    supplier: source.supplier,
    state: source.state,
    city: source.city,
    referenceDate: source.referenceDate,
    uploadedFileName: source.uploadedFileName,
    reliability: source.reliability,
    notes: `${source.notes} Regime SINAPI: ${source.regime}.`,
  };
}

async function parseSinapiZip(data: string | ArrayBuffer): Promise<SinapiRawRow[]> {
  const zip = await JSZip.loadAsync(toArrayBuffer(data));
  const entries = Object.values(zip.files).filter((file) => !file.dir && supportedFileExtensions.has(getFileExtension(file.name)));
  const parsed = await Promise.all(
    entries.map(async (entry) => {
      const extension = getFileExtension(entry.name);
      if (extension === "xlsx" || extension === "xls") return parseSinapiXlsx(await entry.async("arraybuffer"));
      const content = await entry.async("text");
      if (extension === "json") return parseSinapiJson(content);
      return parseSinapiCsv(content);
    })
  );

  return parsed.flat();
}

function parseSinapiCsv(content: string) {
  return readFirstWorksheetRows(XLSX.read(content, { type: "string", raw: true }));
}

function parseSinapiXlsx(data: ArrayBuffer) {
  return readFirstWorksheetRows(XLSX.read(data, { type: "array" }));
}

function parseSinapiJson(content: string) {
  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) return parsed.filter(isRecord);
  if (!isRecord(parsed)) return [];
  if (Array.isArray(parsed.rows)) return parsed.rows.filter(isRecord);
  if (Array.isArray(parsed.compositions)) return parsed.compositions.filter(isRecord);
  if (Array.isArray(parsed.composicoes)) return parsed.composicoes.filter(isRecord);
  return [];
}

function readFirstWorksheetRows(workbook: XLSX.WorkBook): SinapiRawRow[] {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json<SinapiRawRow>(worksheet, { defval: "" });
}

function readPriceParts(row: SinapiRawRow, mapping: SinapiColumnMapping) {
  const materialCostBRL = parseMoney(getMappedValue(row, mapping, "materialCostBRL")) ?? 0;
  const laborCostBRL = parseMoney(getMappedValue(row, mapping, "laborCostBRL")) ?? 0;
  const equipmentCostBRL = parseMoney(getMappedValue(row, mapping, "equipmentCostBRL")) ?? 0;
  const totalUnitPriceBRL = parseMoney(getMappedValue(row, mapping, "totalUnitPrice"));
  const componentTotal = roundCurrency(materialCostBRL + laborCostBRL + equipmentCostBRL);
  const totalLaborHoursPerUnit = parseDecimal(getMappedValue(row, mapping, "totalLaborHoursPerUnit")) ?? 0;

  return {
    materialCostBRL,
    laborCostBRL,
    equipmentCostBRL,
    totalUnitPriceBRL,
    totalLaborHoursPerUnit,
    status: resolveRawPriceStatus(totalUnitPriceBRL, componentTotal),
  };
}

function resolveRawPriceStatus(totalUnitPriceBRL: number | null, componentTotal: number): "valid" | "zeroed" | "missing" {
  if (totalUnitPriceBRL == null && componentTotal <= 0) return "missing";
  const total = totalUnitPriceBRL ?? componentTotal;
  if (total === 0) return "zeroed";
  return total > 0 ? "valid" : "missing";
}

function resolvePriceStatus(issues: SinapiImportIssue[]): SinapiPriceStatus {
  const statuses = issues.map((issue) => issue.status).filter(Boolean) as SinapiPriceStatus[];
  if (statuses.includes("invalid")) return "invalid";
  if (statuses.includes("invalid_unit")) return "invalid_unit";
  if (statuses.includes("out_of_region")) return "out_of_region";
  if (statuses.includes("zeroed")) return "zeroed";
  if (statuses.includes("missing")) return "missing";
  if (statuses.includes("requires_review")) return "requires_review";
  return "valid";
}

function createStatusCounts(compositions: SinapiComposition[]) {
  return Object.fromEntries(allStatuses.map((status) => [status, compositions.filter((composition) => composition.priceStatus === status).length])) as Record<
    SinapiPriceStatus,
    number
  >;
}

function createSourceMeta(composition: SinapiComposition, requiresReview: boolean): BudgetSourceMeta {
  return {
    sourceId: composition.sourceId,
    sourceCode: composition.code,
    referenceDate: composition.referenceDate,
    city: composition.city,
    state: composition.state,
    confidence: requiresReview ? "unverified" : composition.confidence,
    requiresReview,
    notes: `SINAPI ${composition.state || "UF ausente"} ${composition.referenceDate || "sem data-base"} ${composition.regime}. Status: ${
      composition.priceStatus
    }. ${composition.pendingReason}`,
  };
}

function createSinapiCompositionInputs(input: {
  code: string;
  unit: MaterialUnit;
  materialCostBRL: number;
  equipmentCostBRL: number;
  otherCostBRL: number;
}): SinapiCompositionInput[] {
  return [
    createSinapiCompositionInput(input.code, "material", "Material SINAPI importado", input.unit, input.materialCostBRL),
    createSinapiCompositionInput(input.code, "equipment", "Equipamento SINAPI importado", input.unit, input.equipmentCostBRL),
    createSinapiCompositionInput(input.code, "other", "Outros custos SINAPI importados", input.unit, input.otherCostBRL),
  ].filter((item): item is SinapiCompositionInput => Boolean(item));
}

function createSinapiCompositionInput(
  code: string,
  kind: SinapiCompositionInput["kind"],
  description: string,
  unit: MaterialUnit,
  total: number
): SinapiCompositionInput | null {
  if (total <= 0) return null;
  return {
    id: `sinapi-input-${kind}-${slugify(code)}`,
    kind,
    description,
    quantity: 1,
    unit,
    unitPrice: total,
    total,
  };
}

function createLaborRoles(composition: SinapiComposition, meta: BudgetSourceMeta): LaborRole[] {
  if (composition.laborCostBRL <= 0 && composition.totalLaborHoursPerUnit <= 0) return [];
  return [
    {
      ...meta,
      id: `sinapi-labor-${slugify(composition.code)}`,
      role: "Mão de obra SINAPI importada",
      hourlyCostBRL:
        composition.totalLaborHoursPerUnit > 0 ? roundCurrency(composition.laborCostBRL / composition.totalLaborHoursPerUnit) : composition.laborCostBRL,
      hoursPerUnit: composition.totalLaborHoursPerUnit,
      totalHours: composition.totalLaborHoursPerUnit,
      total: composition.laborCostBRL,
    },
  ];
}

function scoreSinapiComposition(composition: SinapiComposition, input: SinapiSearchScoreInput) {
  let score = composition.priceStatus === "valid" ? 20 : 5;
  if (input.state) score += composition.state === input.state ? 20 : composition.priceStatus === "out_of_region" ? -20 : -8;
  if (input.referenceDate) score += composition.referenceDate === input.referenceDate ? 12 : -2;
  if (input.regime) score += composition.regime === input.regime ? 10 : -4;
  if (input.constructionMethod) score += composition.constructionMethod === input.constructionMethod ? 8 : -3;
  if (input.category) score += composition.category === input.category ? 6 : -2;
  if (input.unit) score += composition.unit === input.unit ? 10 : -12;
  if (input.tags.size > 0) {
    const compositionTags = new Set(composition.tags.map(normalizeText));
    score += [...input.tags].filter((tag) => compositionTags.has(tag)).length * 4;
  }
  if (input.queryTokens.length > 0) {
    const haystack = normalizeText(`${composition.code} ${composition.description} ${composition.tags.join(" ")}`);
    const matched = input.queryTokens.filter((token) => haystack.includes(token));
    score += matched.length * 8;
    if (matched.length === 0) return 0;
  }
  return score;
}

function getMappedText(row: SinapiRawRow, mapping: SinapiColumnMapping, columnKey: SinapiColumnKey) {
  const value = getMappedValue(row, mapping, columnKey);
  return value == null ? "" : String(value).trim();
}

function getMappedValue(row: SinapiRawRow, mapping: SinapiColumnMapping, columnKey: SinapiColumnKey) {
  const mappedColumns = toColumnList(mapping[columnKey] ?? defaultSinapiColumnMapping[columnKey]);
  const normalizedColumns = mappedColumns.map(normalizeHeader);
  const actualKey = Object.keys(row).find((key) => normalizedColumns.includes(normalizeHeader(key)));
  return actualKey ? row[actualKey] : undefined;
}

function normalizeMaterialUnit(value: string): MaterialUnit | null {
  const normalized = normalizeText(value).replace(/²/g, "2").replace(/³/g, "3");
  const aliases: Record<string, MaterialUnit> = {
    unidade: "un",
    unidades: "un",
    unid: "un",
    un: "un",
    m: "m",
    metro: "m",
    metros: "m",
    m2: "m2",
    metroquadrado: "m2",
    metrosquadrados: "m2",
    m3: "m3",
    metrocubico: "m3",
    metroscubicos: "m3",
    kg: "kg",
    quilo: "kg",
    quilos: "kg",
    verba: "lot",
    lote: "lot",
    vb: "lot",
  };
  return aliases[normalized] ?? (validMaterialUnits.has(normalized as MaterialUnit) ? (normalized as MaterialUnit) : null);
}

function normalizeConstructionMethod(value: string, fallback: ConstructionMethodId): ConstructionMethodId {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  const aliases: Record<string, ConstructionMethodId> = {
    aframe: "aframe",
    "a-frame": "aframe",
    painel: "aframe",
    paineis: "aframe",
    alvenaria: "conventional-masonry",
    convencional: "conventional-masonry",
    masonry: "conventional-masonry",
    blococeramico: "conventional-masonry",
    ecoblock: "eco-block",
    blocoecologico: "eco-block",
    solocimento: "eco-block",
    eps: "monolithic-eps",
    monolithiceps: "monolithic-eps",
  };
  return aliases[normalized] ?? (constructionMethodIds.includes(value as ConstructionMethodId) ? (value as ConstructionMethodId) : fallback);
}

function normalizeSinapiRegime(value: unknown): SinapiRegime {
  const normalized = normalizeText(String(value ?? ""));
  if (!normalized) return "unknown";
  if (["desonerado", "desonerada"].includes(normalized)) return "desonerado";
  if (["onerado", "onerada"].includes(normalized)) return "onerado";
  if (["naodesonerado", "naodesonerada", "nao-desonerado", "nao_desonerado", "sem_desoneracao", "semdesoneracao"].includes(normalized)) {
    return "nao_desonerado";
  }
  return "unknown";
}

function inferMaterialCategory(stage: string, description: string): MaterialCategory {
  const normalized = normalizeText(`${stage} ${description}`);
  if (["alvenaria", "fundacao", "concreto", "argamassa", "civil", "revestimento", "piso"].some((term) => normalized.includes(term))) return "civil";
  if (["painel", "paineis", "telha", "cobertura"].some((term) => normalized.includes(term))) return "panels";
  if (["aco", "metalica", "estrutura"].some((term) => normalized.includes(term))) return "steel";
  if (["maoobra", "pedreiro", "servente"].some((term) => normalized.includes(term))) return "labor";
  if (["equipamento", "escavadeira", "betoneira"].some((term) => normalized.includes(term))) return "other";
  return "other";
}

function createTags(stage: string, tags: string, description: string) {
  const inferred = tokenize(description).slice(0, 6);
  return [...new Set([stage, ...tags.split(/[;,|]/), ...inferred].map((tag) => tag.trim()).filter(Boolean))];
}

function createPendingReason(issues: SinapiImportIssue[]) {
  if (issues.length === 0) return "Sem pendências automáticas.";
  return issues.map((issue) => issue.message).join(" ");
}

function parseMoney(value: unknown) {
  return parseNumericText(value, { dotThousands: true });
}

function parseDecimal(value: unknown) {
  return parseNumericText(value, { dotThousands: false });
}

function parseNumericText(value: unknown, options: { dotThousands: boolean }) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const clean = text.replace(/R\$/gi, "").replace(/\s/g, "");
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  const hasComma = lastComma >= 0;
  const hasDot = lastDot >= 0;
  const dotGroupsOnly = options.dotThousands && /^\d{1,3}(\.\d{3})+$/.test(clean);
  const decimalComma = hasComma && (!hasDot || lastComma > lastDot);
  const normalized = decimalComma || dotGroupsOnly ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  const number = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function toColumnList(value: string | string[]) {
  return Array.isArray(value) ? value : [value];
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function toArrayBuffer(data: string | ArrayBuffer): ArrayBuffer {
  if (typeof data !== "string") return data;
  const bytes = new TextEncoder().encode(data);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function normalizeHeader(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function createSinapiCompositionId(sourceId: string, rowIndex: number, code: string) {
  return `sinapi-composition-${slugify(sourceId)}-${rowIndex + 1}-${slugify(code)}`;
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isRecord(value: unknown): value is SinapiRawRow {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
