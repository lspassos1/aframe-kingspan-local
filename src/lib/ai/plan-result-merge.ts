import type { PlanExtractConfidence, PlanExtractResult, PlanExtractWarning } from "@/lib/ai/plan-extract-schema";

export type PlanExtractComparableField =
  | "builtAreaM2"
  | "city"
  | "constructionMethod"
  | "doorCount"
  | "floorHeightM"
  | "floors"
  | "houseDepthM"
  | "houseWidthM"
  | "state"
  | "terrainDepthM"
  | "terrainWidthM"
  | "windowCount";

export type PlanExtractComparisonItem = {
  field: PlanExtractComparableField;
  primaryValue: unknown;
  reviewValue: unknown;
  pendingReason?: string;
};

export type PlanExtractComparisonSummary = {
  agreements: PlanExtractComparisonItem[];
  divergences: PlanExtractComparisonItem[];
  unresolved: PlanExtractComparisonItem[];
};

const comparableFields: PlanExtractComparableField[] = [
  "builtAreaM2",
  "city",
  "constructionMethod",
  "doorCount",
  "floorHeightM",
  "floors",
  "houseDepthM",
  "houseWidthM",
  "state",
  "terrainDepthM",
  "terrainWidthM",
  "windowCount",
];

const confidenceRank: Record<PlanExtractConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function normalizeComparableValue(value: unknown) {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number") return Number(value.toFixed(3));
  return value;
}

function valuesAgree(primaryValue: unknown, reviewValue: unknown) {
  return normalizeComparableValue(primaryValue) === normalizeComparableValue(reviewValue);
}

function promoteConfidence(current: PlanExtractConfidence | undefined): PlanExtractConfidence {
  if (!current) return "medium";
  return confidenceRank[current] >= confidenceRank.high ? current : "high";
}

function createDivergenceWarning(field: PlanExtractComparableField): PlanExtractWarning {
  return {
    code: "multi_model_divergence",
    message: `Divergencia entre providers para ${field}. Revisao humana obrigatoria antes de aplicar.`,
    severity: "warning",
    target: field,
  };
}

function createUnresolvedWarning(field: PlanExtractComparableField): PlanExtractWarning {
  return {
    code: "multi_model_unresolved",
    message: `Segunda leitura nao confirmou ${field}. Revisao humana obrigatoria antes de aplicar.`,
    severity: "warning",
    target: field,
  };
}

function appendUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

export function mergePlanExtractionResults(primary: PlanExtractResult, review: PlanExtractResult) {
  const result: PlanExtractResult = {
    ...primary,
    extracted: { ...primary.extracted },
    fieldConfidence: { ...primary.fieldConfidence },
    extractionWarnings: primary.extractionWarnings ? [...primary.extractionWarnings] : undefined,
    missingInformation: [...primary.missingInformation],
    warnings: [...primary.warnings],
  };
  const comparison: PlanExtractComparisonSummary = {
    agreements: [],
    divergences: [],
    unresolved: [],
  };

  for (const field of comparableFields) {
    const primaryValue = primary.extracted[field];
    const reviewValue = review.extracted[field];
    if (primaryValue === undefined && reviewValue === undefined) continue;
    if (primaryValue === undefined || reviewValue === undefined) {
      const pendingReason = `Segunda leitura nao confirmou ${field}; revisar antes de aplicar.`;
      comparison.unresolved.push({
        field,
        primaryValue,
        reviewValue,
        pendingReason,
      });
      result.fieldConfidence[field] = "low";
      result.missingInformation = appendUnique(result.missingInformation, pendingReason);
      result.warnings = appendUnique(result.warnings, pendingReason);
      result.extractionWarnings = [...(result.extractionWarnings ?? []), createUnresolvedWarning(field)];
      continue;
    }

    if (valuesAgree(primaryValue, reviewValue)) {
      comparison.agreements.push({ field, primaryValue, reviewValue });
      result.fieldConfidence[field] = promoteConfidence(result.fieldConfidence[field]);
      continue;
    }

    const pendingReason = `Divergencia multi-modelo em ${field}; revisar antes de aplicar.`;
    comparison.divergences.push({
      field,
      primaryValue,
      reviewValue,
      pendingReason,
    });
    result.fieldConfidence[field] = "low";
    result.missingInformation = appendUnique(result.missingInformation, pendingReason);
    result.warnings = appendUnique(result.warnings, pendingReason);
    result.extractionWarnings = [...(result.extractionWarnings ?? []), createDivergenceWarning(field)];
  }

  return { result, comparison };
}
