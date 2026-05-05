import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { normalizeBrazilStateName } from "@/lib/locations/brazil";
import type { MaterialCategory, MaterialUnit, Project, Scenario } from "@/types/project";
import { createBudgetAssistantViewModel } from "./view-model";
import type {
  BudgetAssistantQuantityItem,
  BudgetConfidenceLevel,
  BudgetServiceLine,
  CostItem,
  PriceSource,
  ServiceComposition,
} from "./types";

export type BudgetSourceExportStatus = "preliminary" | "reviewed";
export type BudgetSourceRegionalStatus = "city" | "state" | "national" | "manual" | "out_of_region";
export type BudgetSourceReviewStatus = "revisado" | "pendente";
export type BudgetSourcePriceStatus = NonNullable<ServiceComposition["sinapi"]>["priceStatus"];
export type BudgetSourceSinapiRegime = NonNullable<ServiceComposition["sinapi"]>["regime"];

export interface BudgetSourceExport {
  generatedAt: string;
  projectId: string;
  projectName: string;
  scenarioId: string;
  scenarioName: string;
  constructionMethod: {
    id: string;
    name: string;
  };
  location: {
    city: string;
    state: string;
    country: string;
  };
  budgetStatus: BudgetSourceExportStatus;
  budgetStatusLabel: string;
  finalBudget: false;
  technicalNotice: string;
  totals: BudgetSourceExportTotals;
  sources: BudgetSourceExportSource[];
  quantities: BudgetSourceExportQuantity[];
  costItems: BudgetSourceExportCostItem[];
  serviceCompositions: BudgetSourceExportComposition[];
  serviceLines: BudgetSourceExportServiceLine[];
  laborHoursByRole: BudgetSourceExportLaborRole[];
  pendingPriceItems: BudgetSourceExportPendingItem[];
  warnings: string[];
}

export interface BudgetSourceExportTotals {
  materialCostBRL: number;
  laborCostBRL: number;
  equipmentCostBRL: number;
  thirdPartyCostBRL: number;
  otherCostBRL: number;
  wasteCostBRL: number;
  directCostBRL: number;
  bdiBRL: number;
  contingencyBRL: number;
  totalBRL: number;
  totalLaborHours: number;
  unpricedCount: number;
  lowConfidenceCount: number;
  reviewableLineCount: number;
  outOfRegionCompositionCount: number;
  structuralCriticalCount: number;
  pendingSinapiPriceCount: number;
}

export interface BudgetSourceExportSource {
  id: string;
  type: PriceSource["type"];
  title: string;
  supplier: string;
  city: string;
  state: string;
  referenceDate: string;
  reliability: PriceSource["reliability"];
  uploadedFileName?: string;
  notes: string;
}

export interface BudgetSourceExportQuantity {
  id: string;
  category: MaterialCategory;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  requiresPriceSource: boolean;
  notes: string;
}

export interface BudgetSourceExportCostItem {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceCode: string;
  referenceDate: string;
  city: string;
  state: string;
  confidence: BudgetConfidenceLevel;
  requiresReview: boolean;
  category: MaterialCategory;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  unitPriceBRL: number;
  totalBRL: number;
  notes: string;
}

export interface BudgetSourceExportComposition {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceCode: string;
  serviceCode: string;
  referenceDate: string;
  city: string;
  state: string;
  confidence: BudgetConfidenceLevel;
  requiresReview: boolean;
  regionalStatus: BudgetSourceRegionalStatus;
  outOfRegion: boolean;
  structuralCritical: boolean;
  category: MaterialCategory;
  description: string;
  unit: MaterialUnit;
  materialCostBRL: number;
  laborCostBRL: number;
  equipmentCostBRL: number;
  thirdPartyCostBRL: number;
  otherCostBRL: number;
  directUnitCostBRL: number;
  totalLaborHoursPerUnit: number;
  unitPriceBRL: number;
  sinapiCode: string;
  sinapiDescription: string;
  regime: BudgetSourceSinapiRegime;
  priceStatus: BudgetSourcePriceStatus;
  priceStatusLabel: string;
  reviewStatus: BudgetSourceReviewStatus;
  humanReviewRequired: boolean;
  tags: string[];
  notes: string;
}

export interface BudgetSourceExportServiceLine {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceCode: string;
  referenceDate: string;
  city: string;
  state: string;
  confidence: BudgetConfidenceLevel;
  requiresReview: boolean;
  regionalStatus: BudgetSourceRegionalStatus;
  outOfRegion: boolean;
  structuralCritical: boolean;
  category: MaterialCategory;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  materialCostBRL: number;
  laborCostBRL: number;
  equipmentCostBRL: number;
  thirdPartyCostBRL: number;
  otherCostBRL: number;
  wasteCostBRL: number;
  directCostBRL: number;
  bdiBRL: number;
  contingencyBRL: number;
  totalBRL: number;
  totalLaborHours: number;
  approvedByUser: boolean;
  unitPriceBRL: number;
  sinapiCode: string;
  sinapiDescription: string;
  regime: BudgetSourceSinapiRegime;
  priceStatus: BudgetSourcePriceStatus;
  priceStatusLabel: string;
  reviewStatus: BudgetSourceReviewStatus;
  humanReviewRequired: boolean;
  notes: string;
}

export interface BudgetSourceExportLaborRole {
  role: string;
  sourceId: string;
  sourceTitle: string;
  referenceDate: string;
  city: string;
  state: string;
  confidence: BudgetConfidenceLevel;
  totalHours: number;
  totalBRL: number;
}

export interface BudgetSourceExportPendingItem {
  id: string;
  category: MaterialCategory;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  notes: string;
}

export function createBudgetSourceExport(project: Project, scenario: Scenario, generatedAt = new Date().toISOString()): BudgetSourceExport {
  const method = getConstructionMethodDefinition(scenario.constructionMethod);
  const viewModel = createBudgetAssistantViewModel(project, scenario);
  const assistant = project.budgetAssistant;
  const sourcesById = new Map([...assistant.costSources, ...assistant.priceSources].map((source) => [source.id, source]));
  const compositionsById = new Map(assistant.serviceCompositions.map((composition) => [composition.id, composition]));
  const serviceLines = assistant.budgetServiceLines.filter(
    (line) => line.scenarioId === scenario.id && line.constructionMethod === scenario.constructionMethod
  );
  const usedCompositionIds = new Set(serviceLines.map((line) => line.compositionId));
  const methodCompositions = assistant.serviceCompositions.filter(
    (composition) => composition.constructionMethod === scenario.constructionMethod && (serviceLines.length === 0 || usedCompositionIds.has(composition.id))
  );
  const sourceIds = new Set([
    ...viewModel.costItems.map((item) => item.sourceId),
    ...methodCompositions.map((composition) => composition.sourceId),
    ...serviceLines.map((line) => line.sourceId),
  ]);
  const sources = [...sourceIds].flatMap((sourceId) => {
    const source = sourcesById.get(sourceId);
    return source ? [toExportSource(source)] : [];
  });
  const compositions = methodCompositions.map((composition) => toExportComposition(composition, scenario, sourcesById));
  const lines = serviceLines.map((line) => toExportServiceLine(line, scenario, sourcesById, compositionsById));
  const costItems = viewModel.costItems.map((item) => toExportCostItem(item, sourcesById));
  const pendingPriceItems = viewModel.pendingPriceItems.map(toPendingItem);
  const totals = createTotals(lines, costItems, compositions, pendingPriceItems, viewModel.lowConfidenceCount);
  const budgetStatus: BudgetSourceExportStatus =
    totals.unpricedCount === 0 && totals.reviewableLineCount === 0 && totals.lowConfidenceCount === 0 ? "reviewed" : "preliminary";

  return {
    generatedAt,
    projectId: project.id,
    projectName: project.name,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    constructionMethod: {
      id: scenario.constructionMethod,
      name: method.name,
    },
    location: {
      city: scenario.location.city,
      state: normalizeBrazilStateName(scenario.location.state) || scenario.location.state,
      country: scenario.location.country,
    },
    budgetStatus,
    budgetStatusLabel: budgetStatus === "reviewed" ? "Orcamento revisado" : "Orcamento preliminar",
    finalBudget: false,
    technicalNotice:
      "Relatorio preliminar. Nao substitui projeto estrutural, projeto arquitetonico, ART/RRT, aprovacao municipal, sondagem, fornecedor ou orcamento formal.",
    totals,
    sources,
    quantities: viewModel.quantityItems.map(toQuantity),
    costItems,
    serviceCompositions: compositions,
    serviceLines: lines,
    laborHoursByRole: createLaborHoursByRole(serviceLines, compositionsById, sourcesById),
    pendingPriceItems,
    warnings: createExportWarnings(totals),
  };
}

export function createBudgetSourceWorkbookRows(report: BudgetSourceExport) {
  return {
    summary: [
      {
        Projeto: report.projectName,
        Cenario: report.scenarioName,
        Metodo: report.constructionMethod.name,
        Cidade: report.location.city,
        UF: report.location.state,
        Status: report.budgetStatusLabel,
        "Orcamento final": report.finalBudget ? "sim" : "nao",
        "Custo material": report.totals.materialCostBRL,
        "Custo mao de obra": report.totals.laborCostBRL,
        "Custo equipamento": report.totals.equipmentCostBRL,
        "Custo terceiros": report.totals.thirdPartyCostBRL,
        "Custo outros": report.totals.otherCostBRL,
        BDI: report.totals.bdiBRL,
        Contingencia: report.totals.contingencyBRL,
        Total: report.totals.totalBRL,
        "H/H total": report.totals.totalLaborHours,
        "Itens sem preco": report.totals.unpricedCount,
        "Linhas revisaveis": report.totals.reviewableLineCount,
        "Precos SINAPI pendentes": report.totals.pendingSinapiPriceCount,
      },
    ],
    sources: report.sources.map((source) => ({
      Fonte: source.title,
      Tipo: source.type,
      Fornecedor: source.supplier,
      Cidade: source.city,
      UF: source.state,
      "Data-base": source.referenceDate,
      Confianca: source.reliability,
      Arquivo: source.uploadedFileName ?? "",
      Observacoes: source.notes,
    })),
    compositions: report.serviceCompositions.map((composition) => ({
      Fonte: composition.sourceTitle,
      Codigo: composition.sinapiCode || composition.serviceCode,
      Descricao: composition.description,
      "Descricao SINAPI": composition.sinapiDescription,
      Categoria: composition.category,
      Unidade: composition.unit,
      "Data-base": composition.referenceDate,
      Cidade: composition.city,
      UF: composition.state,
      Regime: composition.regime,
      "Status do preco": composition.priceStatus,
      "Status do preco label": composition.priceStatusLabel,
      Revisao: composition.reviewStatus,
      Confianca: composition.confidence,
      "Requer revisao": composition.requiresReview ? "sim" : "nao",
      "Fora da regiao": composition.outOfRegion ? "sim" : "nao",
      "Critico estrutural": composition.structuralCritical ? "sim" : "nao",
      "Preco unitario": composition.unitPriceBRL,
      Material: composition.materialCostBRL,
      "Mao de obra": composition.laborCostBRL,
      Equipamento: composition.equipmentCostBRL,
      Terceiros: composition.thirdPartyCostBRL,
      Outros: composition.otherCostBRL,
      "Custo direto unitario": composition.directUnitCostBRL,
      "H/H unitario": composition.totalLaborHoursPerUnit,
      Tags: composition.tags.join("; "),
    })),
    serviceLines: report.serviceLines.map((line) => ({
      Fonte: line.sourceTitle,
      Codigo: line.sinapiCode || line.sourceCode,
      Descricao: line.description,
      "Descricao SINAPI": line.sinapiDescription,
      Categoria: line.category,
      Quantidade: line.quantity,
      Unidade: line.unit,
      "Data-base": line.referenceDate,
      Cidade: line.city,
      UF: line.state,
      Regime: line.regime,
      "Status do preco": line.priceStatus,
      "Status do preco label": line.priceStatusLabel,
      Revisao: line.reviewStatus,
      Confianca: line.confidence,
      "Requer revisao": line.requiresReview ? "sim" : "nao",
      "Fora da regiao": line.outOfRegion ? "sim" : "nao",
      "Critico estrutural": line.structuralCritical ? "sim" : "nao",
      "Preco unitario": line.unitPriceBRL,
      Material: line.materialCostBRL,
      "Mao de obra": line.laborCostBRL,
      Equipamento: line.equipmentCostBRL,
      Terceiros: line.thirdPartyCostBRL,
      Outros: line.otherCostBRL,
      Perdas: line.wasteCostBRL,
      Direto: line.directCostBRL,
      BDI: line.bdiBRL,
      Contingencia: line.contingencyBRL,
      Total: line.totalBRL,
      "H/H total": line.totalLaborHours,
    })),
    laborHours: report.laborHoursByRole.map((role) => ({
      Funcao: role.role,
      Fonte: role.sourceTitle,
      "Data-base": role.referenceDate,
      Cidade: role.city,
      UF: role.state,
      Confianca: role.confidence,
      "H/H total": role.totalHours,
      Total: role.totalBRL,
    })),
    pendingItems: report.pendingPriceItems.map((item) => ({
      Descricao: item.description,
      Categoria: item.category,
      Quantidade: item.quantity,
      Unidade: item.unit,
      Observacoes: item.notes,
    })),
  };
}

function toExportSource(source: PriceSource): BudgetSourceExportSource {
  return {
    id: source.id,
    type: source.type,
    title: source.title,
    supplier: source.supplier,
    city: source.city,
    state: normalizeBrazilStateName(source.state) || source.state,
    referenceDate: source.referenceDate,
    reliability: source.reliability,
    uploadedFileName: source.uploadedFileName,
    notes: source.notes,
  };
}

function toQuantity(item: BudgetAssistantQuantityItem): BudgetSourceExportQuantity {
  return {
    id: item.id,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    requiresPriceSource: item.requiresPriceSource,
    notes: item.notes,
  };
}

function toExportCostItem(item: CostItem, sourcesById: Map<string, PriceSource>): BudgetSourceExportCostItem {
  const source = sourcesById.get(item.sourceId);
  return {
    id: item.id,
    sourceId: item.sourceId,
    sourceTitle: source?.title ?? "Fonte nao encontrada",
    sourceCode: item.sourceCode,
    referenceDate: source?.referenceDate ?? "",
    city: source?.city ?? "",
    state: source ? normalizeBrazilStateName(source.state) || source.state : "",
    confidence: item.confidence,
    requiresReview: item.requiresReview,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceBRL: item.unitPrice,
    totalBRL: item.total,
    notes: item.notes,
  };
}

function toExportComposition(
  composition: ServiceComposition,
  scenario: Scenario,
  sourcesById: Map<string, PriceSource>
): BudgetSourceExportComposition {
  const source = sourcesById.get(composition.sourceId);
  const regionalStatus = getRegionalStatus(scenario, composition);
  const sinapi = getSinapiExportMetadata(composition);
  const requiresReview = composition.requiresReview || sinapi.priceStatus !== "valid";
  return {
    id: composition.id,
    sourceId: composition.sourceId,
    sourceTitle: source?.title ?? "Fonte nao encontrada",
    sourceCode: composition.sourceCode,
    serviceCode: composition.serviceCode,
    referenceDate: composition.referenceDate,
    city: composition.city,
    state: normalizeBrazilStateName(composition.state) || composition.state,
    confidence: composition.confidence,
    requiresReview,
    regionalStatus,
    outOfRegion: regionalStatus === "out_of_region",
    structuralCritical: isStructuralCritical(composition),
    category: composition.category,
    description: composition.description,
    unit: composition.unit,
    materialCostBRL: composition.materialCostBRL,
    laborCostBRL: composition.laborCostBRL,
    equipmentCostBRL: composition.equipmentCostBRL,
    thirdPartyCostBRL: composition.thirdPartyCostBRL,
    otherCostBRL: composition.otherCostBRL,
    directUnitCostBRL: composition.directUnitCostBRL,
    totalLaborHoursPerUnit: composition.totalLaborHoursPerUnit,
    unitPriceBRL: composition.directUnitCostBRL,
    sinapiCode: sinapi.code,
    sinapiDescription: sinapi.description,
    regime: sinapi.regime,
    priceStatus: sinapi.priceStatus,
    priceStatusLabel: sinapi.priceStatusLabel,
    reviewStatus: getReviewStatus(requiresReview),
    humanReviewRequired: requiresReview,
    tags: composition.tags,
    notes: composition.notes,
  };
}

function toExportServiceLine(
  line: BudgetServiceLine,
  scenario: Scenario,
  sourcesById: Map<string, PriceSource>,
  compositionsById: Map<string, ServiceComposition>
): BudgetSourceExportServiceLine {
  const source = sourcesById.get(line.sourceId);
  const composition = compositionsById.get(line.compositionId);
  const regionalStatus = getRegionalStatus(scenario, line);
  const sinapi = getSinapiExportMetadata(composition, line);
  const requiresReview = line.requiresReview || !line.approvedByUser || sinapi.priceStatus !== "valid";
  return {
    id: line.id,
    sourceId: line.sourceId,
    sourceTitle: source?.title ?? "Fonte nao encontrada",
    sourceCode: line.sourceCode,
    referenceDate: line.referenceDate,
    city: line.city,
    state: normalizeBrazilStateName(line.state) || line.state,
    confidence: line.confidence,
    requiresReview,
    regionalStatus,
    outOfRegion: regionalStatus === "out_of_region",
    structuralCritical: composition ? isStructuralCritical(composition) : line.category === "steel",
    category: line.category,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    materialCostBRL: line.materialCostBRL,
    laborCostBRL: line.laborCostBRL,
    equipmentCostBRL: line.equipmentCostBRL,
    thirdPartyCostBRL: line.thirdPartyCostBRL,
    otherCostBRL: line.otherCostBRL,
    wasteCostBRL: line.wasteCostBRL,
    directCostBRL: line.directCostBRL,
    bdiBRL: line.bdiBRL,
    contingencyBRL: line.contingencyBRL,
    totalBRL: line.totalBRL,
    totalLaborHours: line.totalLaborHours,
    approvedByUser: line.approvedByUser,
    unitPriceBRL: getLineUnitPrice(line, composition),
    sinapiCode: sinapi.code,
    sinapiDescription: sinapi.description,
    regime: sinapi.regime,
    priceStatus: sinapi.priceStatus,
    priceStatusLabel: sinapi.priceStatusLabel,
    reviewStatus: getReviewStatus(requiresReview),
    humanReviewRequired: requiresReview,
    notes: line.notes,
  };
}

function toPendingItem(item: BudgetAssistantQuantityItem): BudgetSourceExportPendingItem {
  return {
    id: item.id,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    notes: item.notes,
  };
}

function createTotals(
  lines: BudgetSourceExportServiceLine[],
  costItems: BudgetSourceExportCostItem[],
  compositions: BudgetSourceExportComposition[],
  pendingItems: BudgetSourceExportPendingItem[],
  lowConfidenceCount: number
): BudgetSourceExportTotals {
  const costItemTotal = costItems.reduce((sum, item) => sum + item.totalBRL, 0);
  const outOfRegionCompositionCount =
    lines.length > 0 ? lines.filter((line) => line.outOfRegion).length : compositions.filter((composition) => composition.outOfRegion).length;
  const structuralCriticalCount =
    lines.length > 0 ? lines.filter((line) => line.structuralCritical).length : compositions.filter((composition) => composition.structuralCritical).length;
  const sinapiPriceRows = lines.length > 0 ? lines : compositions;
  return {
    materialCostBRL: sumLines(lines, "materialCostBRL"),
    laborCostBRL: sumLines(lines, "laborCostBRL"),
    equipmentCostBRL: sumLines(lines, "equipmentCostBRL"),
    thirdPartyCostBRL: sumLines(lines, "thirdPartyCostBRL"),
    otherCostBRL: sumLines(lines, "otherCostBRL"),
    wasteCostBRL: sumLines(lines, "wasteCostBRL"),
    directCostBRL: sumLines(lines, "directCostBRL"),
    bdiBRL: sumLines(lines, "bdiBRL"),
    contingencyBRL: sumLines(lines, "contingencyBRL"),
    totalBRL: round(sumLines(lines, "totalBRL") + costItemTotal),
    totalLaborHours: sumLines(lines, "totalLaborHours", 4),
    unpricedCount: pendingItems.length,
    lowConfidenceCount,
    reviewableLineCount: lines.filter((line) => line.requiresReview || !line.approvedByUser).length + costItems.filter((item) => item.requiresReview).length,
    outOfRegionCompositionCount,
    structuralCriticalCount,
    pendingSinapiPriceCount: sinapiPriceRows.filter((line) => line.priceStatus !== "valid").length,
  };
}

function createLaborHoursByRole(
  serviceLines: BudgetServiceLine[],
  compositionsById: Map<string, ServiceComposition>,
  sourcesById: Map<string, PriceSource>
): BudgetSourceExportLaborRole[] {
  const rows = new Map<string, BudgetSourceExportLaborRole>();
  for (const line of serviceLines) {
    const composition = compositionsById.get(line.compositionId);
    const source = sourcesById.get(line.sourceId);
    const roles = composition?.laborRoles.length ? composition.laborRoles : [];

    if (roles.length === 0 && line.totalLaborHours > 0) {
      addLaborRole(rows, {
        role: "Nao detalhado",
        sourceId: line.sourceId,
        sourceTitle: source?.title ?? "Fonte nao encontrada",
        referenceDate: line.referenceDate,
        city: line.city,
        state: line.state,
        confidence: line.confidence,
        totalHours: line.totalLaborHours,
        totalBRL: line.laborCostBRL,
      });
      continue;
    }

    for (const role of roles) {
      addLaborRole(rows, {
        role: role.role,
        sourceId: role.sourceId,
        sourceTitle: source?.title ?? "Fonte nao encontrada",
        referenceDate: role.referenceDate,
        city: role.city,
        state: normalizeBrazilStateName(role.state) || role.state,
        confidence: role.confidence,
        totalHours: round(role.hoursPerUnit * line.quantity, 4),
        totalBRL: round(role.total * line.quantity),
      });
    }
  }
  return [...rows.values()];
}

function addLaborRole(rows: Map<string, BudgetSourceExportLaborRole>, row: BudgetSourceExportLaborRole) {
  const key = `${row.role}::${row.sourceId}`;
  const existing = rows.get(key);
  if (!existing) {
    rows.set(key, row);
    return;
  }

  rows.set(key, {
    ...existing,
    totalHours: round(existing.totalHours + row.totalHours, 4),
    totalBRL: round(existing.totalBRL + row.totalBRL),
  });
}

function createExportWarnings(totals: BudgetSourceExportTotals) {
  return [
    "Este relatorio nao representa orcamento final sem revisao humana.",
    totals.unpricedCount > 0 ? `${totals.unpricedCount} itens ainda nao possuem fonte de preco revisada.` : "",
    totals.reviewableLineCount > 0 ? `${totals.reviewableLineCount} linhas exigem revisao antes de orcamento revisado.` : "",
    totals.pendingSinapiPriceCount > 0 ? `${totals.pendingSinapiPriceCount} precos SINAPI estao pendentes ou invalidos.` : "",
    totals.outOfRegionCompositionCount > 0 ? `${totals.outOfRegionCompositionCount} composicoes estao fora da cidade/UF do cenario.` : "",
    totals.structuralCriticalCount > 0 ? `${totals.structuralCriticalCount} itens estruturais criticos exigem validacao tecnica.` : "",
  ].filter(Boolean);
}

function getSinapiExportMetadata(composition: ServiceComposition | undefined, line?: BudgetServiceLine) {
  const sinapi = composition?.sinapi;
  const priceStatus: BudgetSourcePriceStatus = sinapi?.priceStatus ?? (composition?.requiresReview || line?.requiresReview ? "requires_review" : "valid");
  return {
    code: sinapi?.code ?? composition?.serviceCode ?? line?.sourceCode ?? "",
    description: sinapi?.description ?? composition?.description ?? line?.description ?? "",
    regime: sinapi?.regime ?? "unknown",
    priceStatus,
    priceStatusLabel: getPriceStatusLabel(priceStatus),
  };
}

function getLineUnitPrice(line: BudgetServiceLine, composition: ServiceComposition | undefined) {
  if (composition) return composition.directUnitCostBRL;
  return line.quantity > 0 ? round(line.directCostBRL / line.quantity) : 0;
}

function getReviewStatus(requiresReview: boolean): BudgetSourceReviewStatus {
  return requiresReview ? "pendente" : "revisado";
}

function getPriceStatusLabel(status: BudgetSourcePriceStatus) {
  if (status === "valid") return "preco valido";
  if (status === "zeroed") return "preco zerado";
  if (status === "missing") return "preco ausente";
  if (status === "requires_review") return "requer revisao";
  if (status === "invalid_unit") return "unidade invalida";
  if (status === "out_of_region") return "fora da UF";
  return "invalido";
}

function getRegionalStatus(scenario: Scenario, source: { city: string; state: string }): BudgetSourceRegionalStatus {
  const scenarioState = normalizeRegion(normalizeBrazilStateName(scenario.location.state) || scenario.location.state);
  const scenarioCity = normalizeRegion(scenario.location.city);
  const sourceState = normalizeRegion(normalizeBrazilStateName(source.state) || source.state);
  const sourceCity = normalizeRegion(source.city);

  if (!sourceState || !sourceCity) return "manual";
  if (sourceState === "brasil" || sourceState === "nacional" || sourceCity === "nacional") return "national";
  if (scenarioState && sourceState === scenarioState && scenarioCity && sourceCity === scenarioCity) return "city";
  if (scenarioState && sourceState === scenarioState) return "state";
  return "out_of_region";
}

function isStructuralCritical(composition: ServiceComposition) {
  if (composition.category === "steel") return true;
  return composition.tags.some((tag) => {
    const normalized = normalizeRegion(tag);
    return ["estrutura", "estrutural", "fundacao", "concreto", "aco"].some((term) => normalized.includes(term));
  });
}

function sumLines(lines: BudgetSourceExportServiceLine[], key: keyof BudgetSourceExportServiceLine, decimals = 2) {
  return round(
    lines.reduce((sum, line) => {
      const value = line[key];
      return typeof value === "number" ? sum + value : sum;
    }, 0),
    decimals
  );
}

function normalizeRegion(value: string | undefined | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
