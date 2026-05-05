import * as XLSX from "xlsx";
import type { ConstructionMethodId } from "@/lib/construction-methods";
import type { MaterialCategory, MaterialUnit } from "@/types/project";
import type {
  BudgetConfidenceLevel,
  BudgetSourceMeta,
  CompositionInput,
  LaborRole,
  PriceSource,
  PriceSourceType,
  ServiceComposition,
} from "./types";

export type PriceBaseFileFormat = "csv" | "xlsx" | "json";

export type PriceBaseColumnKey =
  | "sourceCode"
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
  | "stage"
  | "tags"
  | "constructionMethod";

export type PriceBaseColumnMapping = Partial<Record<PriceBaseColumnKey, string>>;

export type PriceBaseRawRow = Record<string, unknown>;

export type PriceBaseImportIssueCode =
  | "empty-file"
  | "required-column-missing"
  | "required-cell-missing"
  | "invalid-unit"
  | "invalid-construction-method"
  | "missing-price"
  | "missing-reference-date"
  | "missing-region";

export interface PriceBaseImportIssue {
  code: PriceBaseImportIssueCode;
  message: string;
  rowNumber?: number;
  columnKey?: PriceBaseColumnKey;
}

export interface ImportedPriceSourceInput {
  id?: string;
  type: PriceSourceType;
  title: string;
  supplier: string;
  state: string;
  city: string;
  referenceDate: string;
  uploadedFileName?: string;
  reliability?: PriceSource["reliability"];
  notes?: string;
}

export interface PriceBaseImportInput {
  rows: PriceBaseRawRow[];
  mapping: PriceBaseColumnMapping;
  source: PriceSource;
  defaultConstructionMethod: ConstructionMethodId;
}

export interface PriceBaseImportResult {
  source: PriceSource;
  serviceCompositions: ServiceComposition[];
  issues: PriceBaseImportIssue[];
  importedRows: number;
  reviewRows: number;
}

export const requiredPriceBaseColumns = ["sourceCode", "description", "unit"] as const satisfies readonly PriceBaseColumnKey[];

export const defaultPriceBaseColumnMapping: Required<PriceBaseColumnMapping> = {
  sourceCode: "codigo",
  description: "descricao",
  unit: "unidade",
  totalUnitPrice: "preco_total",
  materialCostBRL: "material",
  laborCostBRL: "mao_obra",
  equipmentCostBRL: "equipamento",
  totalLaborHoursPerUnit: "hh",
  referenceDate: "data_base",
  state: "uf",
  city: "cidade",
  stage: "etapa",
  tags: "tags",
  constructionMethod: "metodo",
};

export const priceBaseColumnLabels: Record<PriceBaseColumnKey, string> = {
  sourceCode: "Codigo",
  description: "Descricao",
  unit: "Unidade",
  totalUnitPrice: "Preco total",
  materialCostBRL: "Material",
  laborCostBRL: "Mao de obra",
  equipmentCostBRL: "Equipamento",
  totalLaborHoursPerUnit: "H/H",
  referenceDate: "Data-base",
  state: "UF",
  city: "Cidade",
  stage: "Etapa",
  tags: "Tags",
  constructionMethod: "Metodo",
};

const validMaterialUnits = new Set<MaterialUnit>(["un", "m", "m2", "m3", "kg", "package", "lot"]);
const validConstructionMethodIds = new Set<ConstructionMethodId>(["aframe", "conventional-masonry", "eco-block", "monolithic-eps"]);

export function parsePriceBaseCsv(content: string): PriceBaseRawRow[] {
  return readFirstWorksheetRows(XLSX.read(content, { type: "string", raw: true }));
}

export function parsePriceBaseXlsx(data: ArrayBuffer): PriceBaseRawRow[] {
  return readFirstWorksheetRows(XLSX.read(data, { type: "array" }));
}

export function parsePriceBaseJson(content: string): PriceBaseRawRow[] {
  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) return parsed.filter(isRecord);
  if (isRecord(parsed) && Array.isArray(parsed.rows)) return parsed.rows.filter(isRecord);
  return [];
}

export function createImportedPriceSource(input: ImportedPriceSourceInput): PriceSource {
  return {
    id: input.id ?? `price-source-import-${Date.now()}`,
    type: input.type,
    title: input.title.trim(),
    supplier: input.supplier.trim(),
    state: input.state.trim(),
    city: input.city.trim(),
    referenceDate: input.referenceDate,
    uploadedFileName: input.uploadedFileName,
    reliability: input.reliability ?? "low",
    notes: input.notes?.trim() ?? "Base de preco importada pelo usuario; revisar mapeamento e fonte antes de tratar como orcamento revisado.",
  };
}

export function validatePriceBaseColumnMapping(rows: PriceBaseRawRow[], mapping: PriceBaseColumnMapping): PriceBaseImportIssue[] {
  if (rows.length === 0) {
    return [{ code: "empty-file", message: "Arquivo sem linhas validas para importacao." }];
  }

  const headers = getNormalizedHeaders(rows);
  return requiredPriceBaseColumns.flatMap((columnKey) => {
    const mappedColumn = mapping[columnKey]?.trim();
    if (mappedColumn && headers.has(normalizeHeader(mappedColumn))) return [];

    return [
      {
        code: "required-column-missing",
        columnKey,
        message: `Coluna obrigatoria "${priceBaseColumnLabels[columnKey]}" nao foi encontrada no arquivo.`,
      },
    ];
  });
}

export function importPriceBaseRows(input: PriceBaseImportInput): PriceBaseImportResult {
  const columnIssues = validatePriceBaseColumnMapping(input.rows, input.mapping);
  if (columnIssues.length > 0) {
    return {
      source: input.source,
      serviceCompositions: [],
      issues: columnIssues,
      importedRows: 0,
      reviewRows: 0,
    };
  }

  const issues: PriceBaseImportIssue[] = [];
  const serviceCompositions: ServiceComposition[] = [];

  input.rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const sourceCode = getMappedText(row, input.mapping, "sourceCode");
    const description = getMappedText(row, input.mapping, "description");
    const rawUnit = getMappedText(row, input.mapping, "unit");
    const rowIssues: PriceBaseImportIssue[] = [];

    if (!sourceCode) rowIssues.push(createRequiredCellIssue("sourceCode", rowNumber));
    if (!description) rowIssues.push(createRequiredCellIssue("description", rowNumber));
    if (!rawUnit) rowIssues.push(createRequiredCellIssue("unit", rowNumber));
    if (!sourceCode || !description || !rawUnit) {
      issues.push(...rowIssues);
      return;
    }

    const unit = normalizeMaterialUnit(rawUnit);
    if (!unit) {
      rowIssues.push({
        code: "invalid-unit",
        rowNumber,
        columnKey: "unit",
        message: `Linha ${rowNumber}: unidade "${rawUnit}" nao e suportada; usando verba para revisao.`,
      });
    }

    const rawMethod = getMappedText(row, input.mapping, "constructionMethod");
    const method = normalizeConstructionMethod(rawMethod, input.defaultConstructionMethod);
    if (rawMethod && !isKnownConstructionMethod(rawMethod)) {
      rowIssues.push({
        code: "invalid-construction-method",
        rowNumber,
        columnKey: "constructionMethod",
        message: `Linha ${rowNumber}: metodo construtivo invalido; usando metodo padrao para revisao.`,
      });
    }

    const rowReferenceDate = getMappedText(row, input.mapping, "referenceDate") || input.source.referenceDate;
    const rowState = getMappedText(row, input.mapping, "state") || input.source.state;
    const rowCity = getMappedText(row, input.mapping, "city") || input.source.city;
    if (!rowReferenceDate) {
      rowIssues.push({
        code: "missing-reference-date",
        rowNumber,
        columnKey: "referenceDate",
        message: `Linha ${rowNumber}: data-base ausente; item ficara pendente de revisao.`,
      });
    }
    if (!rowState || !rowCity) {
      rowIssues.push({
        code: "missing-region",
        rowNumber,
        message: `Linha ${rowNumber}: cidade/UF ausentes; item ficara pendente de revisao regional.`,
      });
    }

    const materialCostBRL = parseMoney(getMappedValue(row, input.mapping, "materialCostBRL")) ?? 0;
    const laborCostBRL = parseMoney(getMappedValue(row, input.mapping, "laborCostBRL")) ?? 0;
    const equipmentCostBRL = parseMoney(getMappedValue(row, input.mapping, "equipmentCostBRL")) ?? 0;
    const mappedTotal = parseMoney(getMappedValue(row, input.mapping, "totalUnitPrice"));
    const componentTotal = roundCurrency(materialCostBRL + laborCostBRL + equipmentCostBRL);
    const directUnitCostBRL = roundCurrency(mappedTotal ?? componentTotal);
    const otherCostBRL = roundCurrency(Math.max(0, directUnitCostBRL - componentTotal));
    const totalLaborHoursPerUnit = parseDecimal(getMappedValue(row, input.mapping, "totalLaborHoursPerUnit")) ?? 0;

    if (directUnitCostBRL <= 0) {
      rowIssues.push({
        code: "missing-price",
        rowNumber,
        columnKey: "totalUnitPrice",
        message: `Linha ${rowNumber}: preco total/componentes ausentes; item ficara pendente de revisao.`,
      });
    }

    const stage = getMappedText(row, input.mapping, "stage");
    const category = inferMaterialCategory(stage);
    const tags = createTags(stage, getMappedText(row, input.mapping, "tags"));
    const requiresReview = rowIssues.length > 0 || input.source.reliability !== "high";
    const confidence = requiresReview ? "unverified" : reliabilityToConfidence(input.source.reliability);
    const meta = createSourceMeta({
      source: input.source,
      sourceCode,
      referenceDate: rowReferenceDate,
      city: rowCity,
      state: rowState,
      confidence,
      requiresReview,
      notes: createImportedRowNotes(rowIssues),
    });
    const compositionUnit = unit ?? "lot";

    serviceCompositions.push({
      ...meta,
      id: createImportedCompositionId(input.source.id, rowIndex, sourceCode),
      constructionMethod: method,
      category,
      serviceCode: sourceCode,
      description,
      unit: compositionUnit,
      tags,
      inputs: createCompositionInputs({
        meta,
        unit: compositionUnit,
        materialCostBRL,
        equipmentCostBRL,
        otherCostBRL,
      }),
      laborRoles: createLaborRoles({
        meta,
        unit: compositionUnit,
        laborCostBRL,
        totalLaborHoursPerUnit,
      }),
      wasteRules: [],
      materialCostBRL,
      laborCostBRL,
      equipmentCostBRL,
      thirdPartyCostBRL: 0,
      otherCostBRL,
      directUnitCostBRL,
      totalLaborHoursPerUnit,
    });
    issues.push(...rowIssues);
  });

  return {
    source: input.source,
    serviceCompositions,
    issues,
    importedRows: serviceCompositions.length,
    reviewRows: serviceCompositions.filter((composition) => composition.requiresReview).length,
  };
}

function readFirstWorksheetRows(workbook: XLSX.WorkBook): PriceBaseRawRow[] {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json<PriceBaseRawRow>(worksheet, { defval: "" });
}

function getNormalizedHeaders(rows: PriceBaseRawRow[]) {
  return new Set(rows.flatMap((row) => Object.keys(row).map(normalizeHeader)));
}

function getMappedText(row: PriceBaseRawRow, mapping: PriceBaseColumnMapping, columnKey: PriceBaseColumnKey) {
  const value = getMappedValue(row, mapping, columnKey);
  return value == null ? "" : String(value).trim();
}

function getMappedValue(row: PriceBaseRawRow, mapping: PriceBaseColumnMapping, columnKey: PriceBaseColumnKey) {
  const mappedColumn = mapping[columnKey]?.trim();
  if (!mappedColumn) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, mappedColumn)) return row[mappedColumn];
  const normalizedMappedColumn = normalizeHeader(mappedColumn);
  const actualKey = Object.keys(row).find((key) => normalizeHeader(key) === normalizedMappedColumn);
  return actualKey ? row[actualKey] : undefined;
}

function createRequiredCellIssue(columnKey: PriceBaseColumnKey, rowNumber: number): PriceBaseImportIssue {
  return {
    code: "required-cell-missing",
    rowNumber,
    columnKey,
    message: `Linha ${rowNumber}: campo obrigatorio "${priceBaseColumnLabels[columnKey]}" ausente.`,
  };
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
    pacote: "package",
    pacotes: "package",
    verba: "lot",
    lote: "lot",
    vb: "lot",
  };
  const unit = aliases[normalized] ?? (validMaterialUnits.has(normalized as MaterialUnit) ? (normalized as MaterialUnit) : null);
  return unit;
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
    conventionalmasonry: "conventional-masonry",
    ecoblock: "eco-block",
    blocoecologico: "eco-block",
    solocimento: "eco-block",
    monolithiceps: "monolithic-eps",
    eps: "monolithic-eps",
    paineiseps: "monolithic-eps",
  };
  return aliases[normalized] ?? (validConstructionMethodIds.has(value as ConstructionMethodId) ? (value as ConstructionMethodId) : fallback);
}

function isKnownConstructionMethod(value: string) {
  const normalized = normalizeText(value);
  return (
    [
      "aframe",
      "a-frame",
      "painel",
      "paineis",
      "alvenaria",
      "convencional",
      "conventionalmasonry",
      "ecoblock",
      "blocoecologico",
      "solocimento",
      "monolithiceps",
      "eps",
      "paineiseps",
    ].includes(normalized) || validConstructionMethodIds.has(value as ConstructionMethodId)
  );
}

function inferMaterialCategory(stage: string): MaterialCategory {
  const normalized = normalizeText(stage);
  if (!normalized) return "other";
  if (["painel", "paineis", "cobertura", "telha"].some((term) => normalized.includes(term))) return "panels";
  if (["fixacao", "parafuso"].some((term) => normalized.includes(term))) return "fasteners";
  if (["arremate", "rufo", "cumeeira"].some((term) => normalized.includes(term))) return "flashings";
  if (["vedacao", "selante", "fita"].some((term) => normalized.includes(term))) return "sealants";
  if (["fachada", "vidro", "porta", "janela"].some((term) => normalized.includes(term))) return "facade";
  if (["estrutura", "aco", "metalica"].some((term) => normalized.includes(term))) return "steel";
  if (["alvenaria", "fundacao", "concreto", "argamassa", "civil"].some((term) => normalized.includes(term))) return "civil";
  if (["maoobra", "labor", "servico"].some((term) => normalized.includes(term))) return "labor";
  if (["projeto", "tecnico", "art", "rrt"].some((term) => normalized.includes(term))) return "technical";
  if (["frete", "transporte"].some((term) => normalized.includes(term))) return "freight";
  if (["contingencia", "bdi"].some((term) => normalized.includes(term))) return "contingency";
  return "other";
}

function createTags(stage: string, tags: string) {
  return [...new Set([stage, ...tags.split(/[;,|]/)].map((tag) => tag.trim()).filter(Boolean))];
}

function createSourceMeta(input: {
  source: PriceSource;
  sourceCode: string;
  referenceDate: string;
  city: string;
  state: string;
  confidence: BudgetConfidenceLevel;
  requiresReview: boolean;
  notes: string;
}): BudgetSourceMeta {
  return {
    sourceId: input.source.id,
    sourceCode: input.sourceCode,
    referenceDate: input.referenceDate,
    city: input.city,
    state: input.state,
    confidence: input.confidence,
    requiresReview: input.requiresReview,
    notes: input.notes,
  };
}

function createCompositionInputs(input: {
  meta: BudgetSourceMeta;
  unit: MaterialUnit;
  materialCostBRL: number;
  equipmentCostBRL: number;
  otherCostBRL: number;
}): CompositionInput[] {
  return [
    createCompositionInput(input.meta, "material", "Material importado", input.unit, input.materialCostBRL),
    createCompositionInput(input.meta, "equipment", "Equipamento importado", input.unit, input.equipmentCostBRL),
    createCompositionInput(input.meta, "other", "Outros custos importados", input.unit, input.otherCostBRL),
  ].filter((item): item is CompositionInput => Boolean(item));
}

function createCompositionInput(
  meta: BudgetSourceMeta,
  kind: CompositionInput["kind"],
  description: string,
  unit: MaterialUnit,
  total: number
): CompositionInput | null {
  if (total <= 0) return null;
  return {
    ...meta,
    id: `input-${kind}-${slugify(meta.sourceCode)}`,
    kind,
    description,
    quantity: 1,
    unit,
    unitPrice: total,
    total,
  };
}

function createLaborRoles(input: {
  meta: BudgetSourceMeta;
  unit: MaterialUnit;
  laborCostBRL: number;
  totalLaborHoursPerUnit: number;
}): LaborRole[] {
  if (input.laborCostBRL <= 0 && input.totalLaborHoursPerUnit <= 0) return [];
  return [
    {
      ...input.meta,
      id: `labor-${slugify(input.meta.sourceCode)}`,
      role: "Mao de obra importada",
      hourlyCostBRL: input.totalLaborHoursPerUnit > 0 ? roundCurrency(input.laborCostBRL / input.totalLaborHoursPerUnit) : input.laborCostBRL,
      hoursPerUnit: input.totalLaborHoursPerUnit,
      totalHours: input.totalLaborHoursPerUnit,
      total: input.laborCostBRL,
    },
  ];
}

function createImportedRowNotes(issues: PriceBaseImportIssue[]) {
  const base = "Composicao importada de base de preco controlada pelo usuario.";
  if (issues.length === 0) return base;
  return `${base} Pendencias: ${issues.map((issue) => issue.message).join(" ")}`;
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

function reliabilityToConfidence(reliability: PriceSource["reliability"]): BudgetConfidenceLevel {
  if (reliability === "high") return "high";
  if (reliability === "medium") return "medium";
  return "low";
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

function createImportedCompositionId(sourceId: string, rowIndex: number, sourceCode: string) {
  return `service-composition-${slugify(sourceId)}-${rowIndex + 1}-${slugify(sourceCode)}`;
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isRecord(value: unknown): value is PriceBaseRawRow {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
