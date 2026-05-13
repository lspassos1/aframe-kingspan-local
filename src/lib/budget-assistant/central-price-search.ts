import type { PriceCandidate } from "@/lib/pricing";
import type { BudgetAssistantQuantityItem, BudgetMatch, CostItem, CostSource } from "./types";

export interface CentralPriceCandidateEntry {
  source: CostSource;
  costItem: CostItem;
  match: BudgetMatch;
}

export function createCentralPriceCandidateEntry(input: {
  quantityItem: BudgetAssistantQuantityItem;
  candidate: PriceCandidate;
}): CentralPriceCandidateEntry {
  const source = createCentralPriceSource(input.candidate);
  const costItemId = createCentralPriceCostItemId(input.quantityItem.id, input.candidate.id);
  const total = roundCurrency(input.quantityItem.quantity * input.candidate.directUnitCostBRL);
  const unitCompatible = input.quantityItem.unit === input.candidate.unit;
  const reviewNotes = [
    "Candidato da base central; revisar fonte, unidade, regime e data-base antes de aprovar.",
    input.candidate.pendingReason,
    unitCompatible ? "" : `Unidade divergente: quantitativo em ${input.quantityItem.unit}, candidato em ${input.candidate.unit}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const costItem: CostItem = {
    id: costItemId,
    constructionMethod: input.quantityItem.constructionMethod,
    category: input.candidate.category,
    description: input.candidate.description,
    quantity: input.quantityItem.quantity,
    unit: input.candidate.unit,
    unitPrice: input.candidate.directUnitCostBRL,
    total,
    sourceId: source.id,
    sourceCode: input.candidate.code,
    confidence: input.candidate.confidence,
    requiresReview: true,
    notes: reviewNotes,
  };

  const match: BudgetMatch = {
    id: createCentralPriceMatchId(input.quantityItem.id, input.candidate.id),
    quantityItemId: input.quantityItem.id,
    costItemId,
    confidence: input.candidate.confidence,
    reason: [
      `Candidato da base central: ${input.candidate.sourceTitle}, ${input.candidate.state}, ${input.candidate.referenceMonth}.`,
      unitCompatible ? "Unidade compatível." : "Unidade divergente; revisar conversão antes de aprovar.",
      "Preço pendente de revisão.",
    ].join(" "),
    unitCompatible,
    requiresReview: true,
    approvedByUser: false,
  };

  return { source, costItem, match };
}

export function createCentralPriceSource(candidate: PriceCandidate): CostSource {
  return {
    id: createCentralPriceSourceId(candidate.sourceId),
    type: candidate.sourceType,
    title: candidate.sourceTitle,
    supplier: candidate.supplier,
    state: candidate.state,
    city: candidate.city || "Nacional",
    referenceDate: candidate.referenceMonth,
    reliability: candidate.confidence === "high" || candidate.confidence === "medium" ? candidate.confidence : "low",
    notes: "Fonte candidata da base central; itens criados a partir dela continuam pendentes de revisão.",
  };
}

export function createCentralPriceSourceId(sourceId: string) {
  return `central-source-${sanitizeIdSegment(sourceId)}`;
}

export function createCentralPriceCostItemId(quantityId: string, candidateId: string) {
  return `central-cost-${sanitizeIdSegment(quantityId)}-${sanitizeIdSegment(candidateId)}`;
}

export function createCentralPriceMatchId(quantityId: string, candidateId: string) {
  return `central-match-${sanitizeIdSegment(quantityId)}-${sanitizeIdSegment(candidateId)}`;
}

function sanitizeIdSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
