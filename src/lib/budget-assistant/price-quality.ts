import type { MaterialUnit } from "@/types/project";
import type { PriceSource, ServiceComposition } from "./types";
import { normalizeBrazilStateName } from "@/lib/locations/brazil";

export type PriceQualityIssueSeverity = "pending" | "invalid";

export type PriceQualityIssueCode =
  | "candidate_requires_review"
  | "direct_cost_below_components"
  | "invalid_unit"
  | "missing_price"
  | "missing_reference"
  | "missing_source_metadata"
  | "negative_labor_hours"
  | "negative_waste"
  | "out_of_region"
  | "requires_review"
  | "unit_incompatible"
  | "unknown_regime"
  | "unrealistic_labor_hours"
  | "unrealistic_waste"
  | "zero_price";

export interface PriceQualityIssue {
  code: PriceQualityIssueCode;
  severity: PriceQualityIssueSeverity;
  message: string;
}

export interface PriceQualityInput {
  source?: Partial<PriceSource>;
  sourceId?: string;
  sourceCode?: string;
  state?: string;
  referenceDate?: string;
  regime?: string;
  priceStatus?: string;
  unit?: string;
  expectedUnit?: MaterialUnit;
  expectedState?: string;
  allowOutOfRegionFallback?: boolean;
  directUnitCostBRL?: number | null;
  materialCostBRL?: number;
  laborCostBRL?: number;
  equipmentCostBRL?: number;
  thirdPartyCostBRL?: number;
  otherCostBRL?: number;
  totalLaborHoursPerUnit?: number | null;
  wastePercent?: number | null;
  laborHoursReviewed?: boolean;
  wasteReviewed?: boolean;
  requiresReview?: boolean;
  candidateApprovedByUser?: boolean;
}

export interface PriceQualityResult {
  status: "usable" | "pending" | "invalid";
  usable: boolean;
  requiresReview: boolean;
  issues: PriceQualityIssue[];
}

export const priceQualityThresholds = {
  maxLaborHoursPerUnit: 80,
  maxWastePercent: 50,
} as const;

const validMaterialUnits = new Set<MaterialUnit>(["un", "m", "m2", "m3", "kg", "package", "lot"]);

export function evaluatePriceQuality(input: PriceQualityInput): PriceQualityResult {
  const issues: PriceQualityIssue[] = [];
  const directCost = input.directUnitCostBRL;
  const unit = input.unit?.trim() ?? "";
  const sourceId = input.sourceId?.trim() || input.source?.id?.trim() || "";
  const sourceCode = input.sourceCode?.trim() || "";
  const sourceTitle = input.source?.title?.trim() || "";
  const sourceState = input.state?.trim() || input.source?.state?.trim() || "";
  const referenceDate = input.referenceDate?.trim() || input.source?.referenceDate?.trim() || "";
  const regime = normalizeRegime(input.regime);
  const sourceType = input.source?.type?.trim() ?? "";
  const priceStatus = input.priceStatus?.trim();

  if (!sourceId || (!sourceCode && !sourceTitle)) {
    issues.push(createIssue("missing_source_metadata", "pending", "Fonte, código ou título da composição precisam estar rastreáveis."));
  }
  if (!sourceState) {
    issues.push(createIssue("missing_source_metadata", "pending", "UF ou região da fonte precisa estar rastreável."));
  }
  if (!referenceDate) {
    issues.push(createIssue("missing_reference", "pending", "Preço sem referência/data-base não pode ser tratado como revisado."));
  }
  if (regime === "unknown" || (sourceType === "sinapi" && !regime)) {
    issues.push(createIssue("unknown_regime", "pending", "Regime desconhecido exige revisão antes de usar o preço."));
  }
  if (priceStatus === "invalid") {
    issues.push(createIssue("direct_cost_below_components", "invalid", "Status de preço inválido não pode ser tratado como revisado."));
  } else if (priceStatus === "invalid_unit") {
    issues.push(createIssue("invalid_unit", "invalid", "Status de unidade inválida bloqueia o preço."));
  } else if (priceStatus === "out_of_region" && !input.allowOutOfRegionFallback) {
    issues.push(createIssue("out_of_region", "pending", "Status fora da região exige fallback aceito explicitamente."));
  } else if (priceStatus === "zeroed") {
    issues.push(createIssue("zero_price", "pending", "Status de preço zerado exige revisão."));
  } else if (priceStatus === "missing") {
    issues.push(createIssue("missing_price", "pending", "Status de preço ausente exige revisão."));
  } else if (priceStatus === "requires_review") {
    issues.push(createIssue("requires_review", "pending", "Status da fonte exige revisão."));
  }
  if (directCost == null || !Number.isFinite(directCost)) {
    issues.push(createIssue("missing_price", "pending", "Preço ausente fica pendente de revisão."));
  } else if (directCost < 0) {
    issues.push(createIssue("missing_price", "invalid", "Preço negativo é inválido."));
  } else if (directCost === 0) {
    issues.push(createIssue("zero_price", "pending", "Preço zero não pode ser considerado revisado."));
  }
  if (!isMaterialUnit(unit)) {
    issues.push(createIssue("invalid_unit", "invalid", "Unidade não suportada pelo orçamento."));
  } else if (input.expectedUnit && unit !== input.expectedUnit) {
    issues.push(createIssue("unit_incompatible", "pending", "Unidade do preço não é compatível com o quantitativo."));
  }

  const expectedState = normalizeStateKey(input.expectedState);
  const normalizedSourceState = normalizeStateKey(sourceState);
  if (expectedState && normalizedSourceState && expectedState !== normalizedSourceState && !input.allowOutOfRegionFallback) {
    issues.push(createIssue("out_of_region", "pending", "Preço fora da UF do projeto só pode entrar como fallback aceito explicitamente."));
  }

  const componentTotal = sumComponents(input);
  if (directCost != null && Number.isFinite(directCost) && directCost + 0.01 < componentTotal) {
    issues.push(createIssue("direct_cost_below_components", "invalid", "Custo direto não pode ser menor que a soma de material, mão de obra e equipamentos."));
  }

  if (input.totalLaborHoursPerUnit != null) {
    if (!Number.isFinite(input.totalLaborHoursPerUnit) || input.totalLaborHoursPerUnit < 0) {
      issues.push(createIssue("negative_labor_hours", "invalid", "H/H negativo ou inválido é incompatível com preço revisado."));
    } else if (input.totalLaborHoursPerUnit > priceQualityThresholds.maxLaborHoursPerUnit && !input.laborHoursReviewed) {
      issues.push(createIssue("unrealistic_labor_hours", "pending", "H/H por unidade acima do limite operacional exige revisão."));
    }
  }

  if (input.wastePercent != null) {
    if (!Number.isFinite(input.wastePercent) || input.wastePercent < 0) {
      issues.push(createIssue("negative_waste", "invalid", "Perda negativa ou inválida não é aceita."));
    } else if (input.wastePercent > priceQualityThresholds.maxWastePercent && !input.wasteReviewed) {
      issues.push(createIssue("unrealistic_waste", "pending", "Perda acima do limite operacional exige justificativa."));
    }
  }

  if (input.requiresReview !== false) {
    issues.push(
      createIssue(
        "requires_review",
        "pending",
        input.requiresReview === true ? "Preço marcado para revisão continua preliminar." : "Status de revisão ausente mantém o preço pendente."
      )
    );
  }
  if (input.candidateApprovedByUser === false) {
    issues.push(createIssue("candidate_requires_review", "pending", "Candidato de preço não é aprovado automaticamente."));
  }

  const hasInvalid = issues.some((issue) => issue.severity === "invalid");
  const status = hasInvalid ? "invalid" : issues.length > 0 ? "pending" : "usable";

  return {
    status,
    usable: status === "usable",
    requiresReview: status !== "usable",
    issues,
  };
}

export function evaluateServiceCompositionPriceQuality(
  composition: ServiceComposition,
  options: Pick<
    PriceQualityInput,
    "allowOutOfRegionFallback" | "candidateApprovedByUser" | "expectedState" | "expectedUnit" | "laborHoursReviewed" | "wastePercent" | "wasteReviewed"
  > = {}
): PriceQualityResult {
  return evaluatePriceQuality({
    source: composition.sinapi
      ? {
          id: composition.sinapi.sourceId,
          type: "sinapi",
          title: composition.sinapi.sourceTitle ?? "",
          state: composition.sinapi.state,
          referenceDate: composition.sinapi.referenceDate,
        }
      : undefined,
    sourceId: composition.sourceId,
    sourceCode: composition.sourceCode || composition.serviceCode,
    state: composition.sinapi?.state ?? composition.state,
    referenceDate: composition.sinapi?.referenceDate ?? composition.referenceDate,
    regime: composition.sinapi?.regime,
    unit: composition.unit,
    directUnitCostBRL: composition.directUnitCostBRL,
    materialCostBRL: composition.materialCostBRL,
    laborCostBRL: composition.laborCostBRL,
    equipmentCostBRL: composition.equipmentCostBRL,
    thirdPartyCostBRL: composition.thirdPartyCostBRL,
    otherCostBRL: composition.otherCostBRL,
    totalLaborHoursPerUnit: composition.sinapi?.totalLaborHoursPerUnit ?? composition.totalLaborHoursPerUnit,
    priceStatus: composition.sinapi?.priceStatus,
    requiresReview: resolveReviewStatus(composition),
    ...options,
  });
}

function createIssue(code: PriceQualityIssueCode, severity: PriceQualityIssueSeverity, message: string): PriceQualityIssue {
  return { code, severity, message };
}

function isMaterialUnit(value: string): value is MaterialUnit {
  return validMaterialUnits.has(value as MaterialUnit);
}

function sumComponents(input: PriceQualityInput) {
  return roundCurrency(
    (input.materialCostBRL ?? 0) + (input.laborCostBRL ?? 0) + (input.equipmentCostBRL ?? 0) + (input.thirdPartyCostBRL ?? 0) + (input.otherCostBRL ?? 0)
  );
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeStateKey(value: string | undefined) {
  const normalized = normalizeBrazilStateName(value) || value?.trim() || "";
  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeRegime(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function resolveReviewStatus(composition: ServiceComposition) {
  if (composition.requiresReview === true || composition.sinapi?.requiresReview === true) return true;
  if (composition.requiresReview === false || composition.sinapi?.requiresReview === false) return false;
  return undefined;
}
