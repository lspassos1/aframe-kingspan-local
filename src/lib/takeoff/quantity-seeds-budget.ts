import type {
  BudgetQuantity,
  BudgetStatus,
  BudgetServiceLine,
  ServiceComposition,
} from "@/lib/budget-assistant";
import {
  calculateDirectServiceBudget,
  type DirectServiceBudgetSkippedLink,
  type DirectServiceBudgetSummary,
} from "@/lib/budget-assistant/service-budget";
import type { ConstructionMethodId } from "@/lib/construction-methods";
import {
  createSinapiQuantityMatch,
  findSinapiQuantityMatchCandidates,
  type SinapiQuantityMatch,
  type SinapiQuantityMatchCandidate,
  type SinapiQuantityMatchLocation,
} from "@/lib/sinapi/quantity-matching";
import { normalizeBrazilStateName } from "@/lib/locations/brazil";
import type { SinapiMatchBlockReason } from "@/lib/sinapi/quantity-matching";
import type { SinapiRegime } from "@/lib/sinapi/price-database";
import type { MaterialCategory, MaterialUnit } from "@/types/project";
import type { QuantitySeed, QuantitySeedCategory, QuantitySeedUnit } from "./quantity-seeds";

export type QuantitySeedBudgetSkipReason =
  | "invalid_quantity"
  | "missing_scenario"
  | "missing_method"
  | "quantity_requires_review"
  | "quantity_pending"
  | "unsupported_unit";

export interface QuantitySeedBudgetSkippedSeed {
  seed: QuantitySeed;
  reason: QuantitySeedBudgetSkipReason;
  message: string;
}

export interface QuantitySeedBudgetBlockedMatch {
  match: SinapiQuantityMatch;
  message: string;
}

export type QuantitySeedBudgetReviewStatus = "needs_review" | "needs_source" | "ready_for_matching" | "blocked" | "priced";

export interface QuantitySeedBudgetReviewItem {
  seedId?: string;
  quantityId?: string;
  serviceLineId?: string;
  compositionId?: string;
  sourceCode?: string;
  description: string;
  quantity: number;
  unit: QuantitySeedUnit | MaterialUnit;
  source?: QuantitySeed["source"];
  confidence?: QuantitySeed["confidence"];
  status: QuantitySeedBudgetReviewStatus;
  pendingReason?: string;
  actionRequired: string;
  candidateCount: number;
}

export interface QuantitySeedBudgetInput {
  seeds: QuantitySeed[];
  serviceCompositions: ServiceComposition[];
  scenarioId?: string;
  constructionMethod?: ConstructionMethodId;
  location?: SinapiQuantityMatchLocation;
  referenceDate?: string;
  regime?: SinapiRegime;
  approvedMatches?: SinapiQuantityMatch[];
  bdiPercent?: number;
  contingencyPercent?: number;
  technicalProjectApproved?: boolean;
}

export interface QuantitySeedBudgetResult {
  status: Extract<BudgetStatus, "preliminary">;
  budgetQuantities: BudgetQuantity[];
  skippedSeeds: QuantitySeedBudgetSkippedSeed[];
  matchCandidates: SinapiQuantityMatchCandidate[];
  suggestedMatches: SinapiQuantityMatch[];
  blockedMatches: QuantitySeedBudgetBlockedMatch[];
  unmatchedQuantities: BudgetQuantity[];
  reviewItems: QuantitySeedBudgetReviewItem[];
  budget: DirectServiceBudgetSummary;
  serviceLines: BudgetServiceLine[];
}

export function createBudgetQuantitiesFromQuantitySeeds(
  seeds: QuantitySeed[],
  defaults: { scenarioId?: string; constructionMethod?: ConstructionMethodId } = {}
) {
  const budgetQuantities: BudgetQuantity[] = [];
  const skippedSeeds: QuantitySeedBudgetSkippedSeed[] = [];

  for (const seed of seeds) {
    const skipReason = getSeedSkipReason(seed, defaults);
    if (skipReason) {
      skippedSeeds.push({ seed, reason: skipReason, message: createSeedSkipMessage(seed, skipReason) });
      continue;
    }

    budgetQuantities.push({
      id: `budget-quantity-${seed.id}`,
      scenarioId: seed.scenarioId ?? defaults.scenarioId ?? "",
      constructionMethod: seed.constructionMethod ?? defaults.constructionMethod ?? "aframe",
      category: mapQuantitySeedCategory(seed.category),
      description: seed.description,
      quantity: round(seed.quantity),
      unit: mapQuantitySeedUnit(seed.unit) as MaterialUnit,
      notes: createBudgetQuantityNotes(seed),
    });
  }

  return { budgetQuantities, skippedSeeds };
}

export function createQuantitySeedsBudgetPipeline(input: QuantitySeedBudgetInput): QuantitySeedBudgetResult {
  const { budgetQuantities, skippedSeeds } = createBudgetQuantitiesFromQuantitySeeds(input.seeds, {
    scenarioId: input.scenarioId,
    constructionMethod: input.constructionMethod,
  });
  const scenarioId = input.scenarioId ?? budgetQuantities[0]?.scenarioId ?? "";
  const matchCandidates = findSinapiQuantityMatchCandidates({
    quantities: budgetQuantities,
    serviceCompositions: input.serviceCompositions,
    location: input.location,
    referenceDate: input.referenceDate,
    regime: input.regime,
  });
  const suggestedMatches = matchCandidates.map(createSinapiQuantityMatch);
  const seedByQuantityId = createSeedByQuantityId(input.seeds);
  const quantitiesById = new Map(budgetQuantities.map((quantity) => [quantity.id, quantity]));
  const compositionsById = new Map(input.serviceCompositions.map((composition) => [composition.id, composition]));
  const blockedMatches = getBlockedApprovedMatches(input.approvedMatches ?? [], {
    seedByQuantityId,
    quantitiesById,
    compositionsById,
    location: input.location,
    technicalProjectApproved: Boolean(input.technicalProjectApproved),
  });
  const blockedMatchIds = new Set(blockedMatches.map((blocked) => blocked.match.id));
  const approvedLinks = (input.approvedMatches ?? [])
    .filter((match) => match.approvedByUser)
    .filter((match) => !blockedMatchIds.has(match.id))
    .map((match) => ({
      id: match.id,
      quantityId: match.quantityId,
      compositionId: match.compositionId,
      approvedByUser: true,
    }));
  const budget = calculateDirectServiceBudget({
    scenarioId,
    quantities: budgetQuantities,
    serviceCompositions: input.serviceCompositions,
    links: approvedLinks,
    bdiPercent: input.bdiPercent,
    contingencyPercent: input.contingencyPercent,
    technicalProjectApproved: input.technicalProjectApproved,
  });
  const matchedQuantityIds = new Set(suggestedMatches.map((match) => match.quantityId));
  const budgetWithBlockedLinks = {
    ...budget,
    skippedLinks: [...blockedMatches.map(toSkippedBlockedMatch), ...budget.skippedLinks],
  };

  return {
    status: "preliminary",
    budgetQuantities,
    skippedSeeds,
    matchCandidates,
    suggestedMatches,
    blockedMatches,
    unmatchedQuantities: budgetQuantities.filter((quantity) => !matchedQuantityIds.has(quantity.id)),
    reviewItems: createBudgetReviewItems({
      seeds: input.seeds,
      budgetQuantities,
      skippedSeeds,
      matchCandidates,
      blockedMatches,
      serviceLines: budget.lines,
      seedByQuantityId,
    }),
    budget: budgetWithBlockedLinks,
    serviceLines: budget.lines,
  };
}

function getSeedSkipReason(
  seed: QuantitySeed,
  defaults: { scenarioId?: string; constructionMethod?: ConstructionMethodId }
): QuantitySeedBudgetSkipReason | null {
  if (!Number.isFinite(seed.quantity) || seed.quantity <= 0) return "invalid_quantity";
  if (!seed.scenarioId && !defaults.scenarioId) return "missing_scenario";
  if (!seed.constructionMethod && !defaults.constructionMethod) return "missing_method";
  if (!mapQuantitySeedUnit(seed.unit)) return "unsupported_unit";
  if (seed.pendingReason) return "quantity_pending";
  if (seed.requiresReview || seed.source === "rule_estimated") return "quantity_requires_review";
  return null;
}

function createSeedSkipMessage(seed: QuantitySeed, reason: QuantitySeedBudgetSkipReason) {
  if (reason === "invalid_quantity") return `Quantitativo "${seed.description}" possui valor invalido.`;
  if (reason === "missing_scenario") return `Quantitativo "${seed.description}" nao possui cenario definido.`;
  if (reason === "missing_method") return `Quantitativo "${seed.description}" nao possui metodo construtivo definido.`;
  if (reason === "unsupported_unit") return `Unidade "${seed.unit}" ainda nao entra no orcamento direto.`;
  if (reason === "quantity_pending") return `Quantitativo "${seed.description}" tem pendencia: ${seed.pendingReason}`;
  return `Quantitativo "${seed.description}" precisa revisao humana antes do orcamento.`;
}

function mapQuantitySeedCategory(category: QuantitySeedCategory): MaterialCategory {
  if (category === "structure") return "steel";
  if (category === "electrical" || category === "plumbing") return "technical";
  if (category === "openings") return "facade";
  if (category === "external") return "other";
  return "civil";
}

function mapQuantitySeedUnit(unit: QuantitySeedUnit): MaterialUnit | null {
  return unit;
}

function createBudgetQuantityNotes(seed: QuantitySeed) {
  return [
    seed.notes,
    `Origem do quantitativo: ${seed.source}.`,
    `Confianca: ${seed.confidence}.`,
    seed.evidence ? `Evidencia: ${seed.evidence}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getBlockedApprovedMatches(
  matches: SinapiQuantityMatch[],
  context: {
    seedByQuantityId: Map<string, QuantitySeed>;
    quantitiesById: Map<string, BudgetQuantity>;
    compositionsById: Map<string, ServiceComposition>;
    location?: SinapiQuantityMatchLocation;
    technicalProjectApproved: boolean;
  }
) {
  return matches.flatMap((match) => {
    if (!match.approvedByUser) return [];
    const blocked = createApprovedMatchBlock(match, context);
    return blocked ? [blocked] : [];
  });
}

function createApprovedMatchBlock(
  match: SinapiQuantityMatch,
  context: {
    seedByQuantityId: Map<string, QuantitySeed>;
    quantitiesById: Map<string, BudgetQuantity>;
    compositionsById: Map<string, ServiceComposition>;
    location?: SinapiQuantityMatchLocation;
    technicalProjectApproved: boolean;
  }
): QuantitySeedBudgetBlockedMatch | null {
  const composition = context.compositionsById.get(match.compositionId);
  const quantity = context.quantitiesById.get(match.quantityId);
  const seed = context.seedByQuantityId.get(match.quantityId);
  const reason =
    match.approvalBlockedReason ??
    (!match.unitCompatible ? "unit_incompatible" : undefined) ??
    getCompositionBlockReason(composition, seed, context.location, context.technicalProjectApproved);

  if (!reason) return null;
  const blockedMatch: SinapiQuantityMatch = {
    ...match,
    approvalBlockedReason: reason,
    unitCompatible: reason === "unit_incompatible" ? false : match.unitCompatible,
    pendingReason: [match.pendingReason, createSyntheticPendingReason(reason, composition, quantity)].filter(Boolean).join(" "),
  };

  return {
    match: blockedMatch,
    message: createBlockedMatchMessage(blockedMatch),
  };
}

function getCompositionBlockReason(
  composition: ServiceComposition | undefined,
  seed: QuantitySeed | undefined,
  location: SinapiQuantityMatchLocation | undefined,
  technicalProjectApproved: boolean
): SinapiMatchBlockReason | undefined {
  if (!composition) return undefined;
  if (!composition.sourceId || !composition.sourceCode || !composition.referenceDate) return "missing_source";
  if (!composition.sinapi) return "missing_sinapi_metadata";
  if (isOutOfRegion(composition, location)) return "out_of_region";
  if (composition.sinapi && composition.sinapi.priceStatus !== "valid") return "price_status";
  if (composition.requiresReview) return "composition_requires_review";
  if (!technicalProjectApproved && (seed?.category === "foundation" || seed?.category === "structure" || isTechnicalComposition(composition))) {
    return "technical_review_required";
  }
  return undefined;
}

function isOutOfRegion(composition: ServiceComposition, location: SinapiQuantityMatchLocation | undefined) {
  const projectState = normalizeState(location?.state);
  const sourceState = normalizeState(composition.sinapi?.state ?? composition.state);
  return Boolean(projectState && sourceState && projectState !== sourceState);
}

function createBlockedMatchMessage(match: SinapiQuantityMatch) {
  if (match.approvalBlockedReason === "unit_incompatible" || !match.unitCompatible) {
    return "Unidade incompativel bloqueia entrada no orcamento.";
  }
  if (match.approvalBlockedReason === "price_status") {
    return "Preco SINAPI pendente bloqueia entrada como linha revisada.";
  }
  if (match.approvalBlockedReason === "out_of_region") {
    return "Fonte fora da UF selecionada permanece pendente.";
  }
  if (match.approvalBlockedReason === "method_uncertain") {
    return "Metodo construtivo incerto permanece pendente.";
  }
  if (match.approvalBlockedReason === "missing_source") {
    return "Preco sem fonte, codigo ou data-base nao entra no orcamento revisado.";
  }
  if (match.approvalBlockedReason === "composition_requires_review") {
    return "Composicao exige revisao humana antes de virar linha revisada.";
  }
  if (match.approvalBlockedReason === "technical_review_required") {
    return "Fundacao, estrutura ou item tecnico exigem revisao tecnica antes do orcamento revisado.";
  }
  return "Vinculo SINAPI permanece pendente.";
}

function toSkippedBlockedMatch(blocked: QuantitySeedBudgetBlockedMatch): DirectServiceBudgetSkippedLink {
  return {
    link: {
      id: blocked.match.id,
      quantityId: blocked.match.quantityId,
      compositionId: blocked.match.compositionId,
      approvedByUser: blocked.match.approvedByUser,
    },
    reason: blocked.match.unitCompatible ? "approval-blocked" : "unit-incompatible",
    message: blocked.message,
  };
}

function createSeedByQuantityId(seeds: QuantitySeed[]) {
  return new Map(seeds.map((seed) => [`budget-quantity-${seed.id}`, seed]));
}

function createBudgetReviewItems(input: {
  seeds: QuantitySeed[];
  budgetQuantities: BudgetQuantity[];
  skippedSeeds: QuantitySeedBudgetSkippedSeed[];
  matchCandidates: SinapiQuantityMatchCandidate[];
  blockedMatches: QuantitySeedBudgetBlockedMatch[];
  serviceLines: BudgetServiceLine[];
  seedByQuantityId: Map<string, QuantitySeed>;
}): QuantitySeedBudgetReviewItem[] {
  const candidateCountByQuantityId = new Map<string, number>();
  for (const candidate of input.matchCandidates) {
    candidateCountByQuantityId.set(candidate.quantity.id, (candidateCountByQuantityId.get(candidate.quantity.id) ?? 0) + 1);
  }
  const blockedByQuantityId = new Map(input.blockedMatches.map((blocked) => [blocked.match.quantityId, blocked]));
  const lineByQuantityId = new Map(input.serviceLines.map((line) => [line.quantityId, line]));

  const skippedItems = input.skippedSeeds.map((skipped): QuantitySeedBudgetReviewItem => ({
    seedId: skipped.seed.id,
    description: skipped.seed.description,
    quantity: skipped.seed.quantity,
    unit: skipped.seed.unit,
    source: skipped.seed.source,
    confidence: skipped.seed.confidence,
    status: "needs_review",
    pendingReason: skipped.message,
    actionRequired: skipped.reason === "quantity_pending" ? "Resolver pendencia do quantitativo." : "Revisar e confirmar quantitativo.",
    candidateCount: 0,
  }));

  const quantityItems = input.budgetQuantities.map((quantity): QuantitySeedBudgetReviewItem => {
    const seed = input.seedByQuantityId.get(quantity.id);
    const line = lineByQuantityId.get(quantity.id);
    const blocked = blockedByQuantityId.get(quantity.id);
    const candidateCount = candidateCountByQuantityId.get(quantity.id) ?? 0;
    if (line) {
      return {
        seedId: seed?.id,
        quantityId: quantity.id,
        serviceLineId: line.id,
        compositionId: line.compositionId,
        sourceCode: line.sourceCode,
        description: quantity.description,
        quantity: quantity.quantity,
        unit: quantity.unit,
        source: seed?.source,
        confidence: seed?.confidence,
        status: "priced",
        actionRequired: "Linha preliminar criada com fonte aprovada.",
        candidateCount,
      };
    }
    if (blocked) {
      return {
        seedId: seed?.id,
        quantityId: quantity.id,
        compositionId: blocked.match.compositionId,
        description: quantity.description,
        quantity: quantity.quantity,
        unit: quantity.unit,
        source: seed?.source,
        confidence: seed?.confidence,
        status: "blocked",
        pendingReason: blocked.message,
        actionRequired: "Resolver bloqueio antes de gerar linha revisada.",
        candidateCount,
      };
    }
    if (candidateCount === 0) {
      return {
        seedId: seed?.id,
        quantityId: quantity.id,
        description: quantity.description,
        quantity: quantity.quantity,
        unit: quantity.unit,
        source: seed?.source,
        confidence: seed?.confidence,
        status: "needs_source",
        pendingReason: "Nenhuma composicao SINAPI candidata encontrada.",
        actionRequired: "Importar base ou vincular composicao existente.",
        candidateCount,
      };
    }
    return {
      seedId: seed?.id,
      quantityId: quantity.id,
      description: quantity.description,
      quantity: quantity.quantity,
      unit: quantity.unit,
      source: seed?.source,
      confidence: seed?.confidence,
      status: "ready_for_matching",
      pendingReason: "Aguardando aprovacao humana do vinculo.",
      actionRequired: "Escolher e aprovar uma composicao candidata.",
      candidateCount,
    };
  });

  return [...skippedItems, ...quantityItems];
}

function isTechnicalComposition(composition: ServiceComposition) {
  if (composition.category === "steel" || composition.category === "technical") return true;
  return composition.tags.some((tag) => {
    const normalized = normalizeText(tag);
    return ["estrutura", "estrutural", "fundacao", "fundacao", "concreto", "aco"].some((term) => normalized.includes(term));
  });
}

function createSyntheticPendingReason(
  reason: SinapiMatchBlockReason,
  composition: ServiceComposition | undefined,
  quantity: BudgetQuantity | undefined
) {
  if (reason === "missing_source") return "Composicao sem fonte/codigo/data-base revisavel.";
  if (reason === "composition_requires_review") return "Composicao marcada para revisao.";
  if (reason === "technical_review_required") return "Revisao tecnica exigida para item tecnico.";
  if (reason === "price_status") return `Status de preco ${composition?.sinapi?.priceStatus ?? "ausente"}.`;
  if (reason === "unit_incompatible") return `Unidade ${quantity?.unit ?? "?"} incompativel com ${composition?.unit ?? "?"}.`;
  return "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeState(value: string | undefined | null) {
  return normalizeText(normalizeBrazilStateName(value) || value || "");
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
