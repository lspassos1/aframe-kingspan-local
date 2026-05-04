import type { MaterialCategory, MaterialUnit, Project, Scenario } from "@/types/project";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { calculateScenarioBudget } from "@/lib/construction-methods/scenario-calculations";
import { normalizeBrazilStateName } from "@/lib/locations/brazil";
import type {
  BudgetAssistantQuantityItem,
  BudgetAssistantViewModel,
  BudgetConfidenceLevel,
  BudgetMatch,
  CostItem,
  CostSource,
  PriceSourceRegionalScope,
  PriceSourceType,
} from "./types";

export interface BudgetAssistantData {
  costSources?: CostSource[];
  costItems?: CostItem[];
  matches?: BudgetMatch[];
}

export interface ManualCostEntryInput {
  quantityItem: BudgetAssistantQuantityItem;
  sourceTitle: string;
  sourceType?: PriceSourceType;
  supplier?: string;
  referenceDate: string;
  unitPrice: number;
  confidence: BudgetConfidenceLevel;
  city: string;
  state: string;
  notes?: string;
}

export interface ManualCostSourceInput {
  title: string;
  type: PriceSourceType;
  supplier: string;
  city: string;
  state: string;
  referenceDate: string;
  notes?: string;
  reliability?: CostSource["reliability"];
}

export interface ManualCostItemInput {
  quantityItem: BudgetAssistantQuantityItem;
  sourceId: string;
  description: string;
  category: MaterialCategory;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
  confidence: BudgetConfidenceLevel;
  notes?: string;
}

export interface BudgetMatchSuggestionInput {
  quantityItems: BudgetAssistantQuantityItem[];
  costItems: CostItem[];
  existingMatches?: BudgetMatch[];
}

export interface RegionalCostSource {
  source: CostSource;
  scope: PriceSourceRegionalScope;
  label: string;
}

export function createBudgetAssistantViewModel(project: Project, scenario: Scenario, data?: BudgetAssistantData): BudgetAssistantViewModel {
  const definition = getConstructionMethodDefinition(scenario.constructionMethod);
  const budget = calculateScenarioBudget(project, scenario);
  const assistantData = data ?? project.budgetAssistant ?? {};
  const quantityItems = budget.items.map<BudgetAssistantQuantityItem>((item) => ({
    id: item.id,
    constructionMethod: scenario.constructionMethod,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    estimatedTotalBRL: item.netTotalBRL,
    requiresPriceSource: item.requiresConfirmation || item.unitPriceBRL === undefined,
    notes: item.notes,
  }));
  const costSources = assistantData.costSources ?? [];
  const applicableCostSources = selectApplicableRegionalCostSources(scenario, costSources);
  const selectedPriceSourceIds = applicableCostSources.map((item) => item.source.id);
  const regionalFallbackWarnings = createRegionalFallbackWarnings(applicableCostSources);
  const quantityIds = new Set(quantityItems.map((item) => item.id));
  const selectedPriceSourceIdSet = new Set(selectedPriceSourceIds);
  const scenarioCostItems = (assistantData.costItems ?? []).filter((item) => item.constructionMethod === scenario.constructionMethod);
  const scenarioCostItemById = new Map(scenarioCostItems.map((item) => [item.id, item]));
  const matches = (assistantData.matches ?? []).filter((match) => {
    if (!quantityIds.has(match.quantityItemId)) return false;
    const costItem = scenarioCostItemById.get(match.costItemId);
    return Boolean(costItem && selectedPriceSourceIdSet.has(costItem.sourceId));
  });
  const matchedCostItemIds = new Set(matches.map((match) => match.costItemId));
  const costItems = scenarioCostItems.filter((item) => matchedCostItemIds.has(item.id));
  const pricedQuantityIds = new Set(matches.filter((match) => match.approvedByUser).map((match) => match.quantityItemId));
  const pendingPriceItems = quantityItems.filter((item) => item.requiresPriceSource && !pricedQuantityIds.has(item.id));
  const lowConfidenceItems = costItems.filter((item) => item.confidence === "low" || item.confidence === "unverified");
  const hasAiSuggestions = matches.some((match) => !match.approvedByUser);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    methodName: definition.name,
    status: hasAiSuggestions ? "ai_assisted" : "preliminary",
    quantityItems,
    costSources,
    applicableCostSources,
    selectedPriceSourceIds,
    regionalFallbackWarnings,
    costItems,
    matches,
    pendingPriceItems,
    lowConfidenceItems,
    unpricedCount: pendingPriceItems.length,
    lowConfidenceCount: lowConfidenceItems.length,
  };
}

export function selectApplicableRegionalCostSources(scenario: Scenario, costSources: CostSource[]): RegionalCostSource[] {
  const classifiedSources = costSources.flatMap((source) => {
    const scope = classifyPriceSourceScope(scenario, source);
    return scope ? [{ source, scope, label: createPriceSourceScopeLabel(source, scope) }] : [];
  });
  const priority: PriceSourceRegionalScope[] = ["city", "state", "national", "manual"];
  const selectedScope = priority.find((scope) => classifiedSources.some((item) => item.scope === scope));

  return selectedScope ? classifiedSources.filter((item) => item.scope === selectedScope) : [];
}

function classifyPriceSourceScope(scenario: Scenario, source: CostSource): PriceSourceRegionalScope | null {
  const scenarioState = normalizeRegionText(normalizeBrazilStateName(scenario.location.state) || scenario.location.state);
  const scenarioCity = normalizeRegionText(scenario.location.city);
  const sourceState = normalizeRegionText(normalizeBrazilStateName(source.state) || source.state);
  const sourceCity = normalizeRegionText(source.city);

  if (source.type === "manual") return "manual";
  if (!sourceState || sourceState === "brasil" || sourceState === "nacional" || sourceCity === "nacional") return "national";
  if (scenarioState && sourceState === scenarioState && scenarioCity && sourceCity === scenarioCity) return "city";
  if (scenarioState && sourceState === scenarioState) return "state";
  return null;
}

function createPriceSourceScopeLabel(source: CostSource, scope: PriceSourceRegionalScope) {
  const sourceState = normalizeBrazilStateName(source.state) || source.state.trim();
  if (scope === "city") return `Cidade: ${source.city}/${sourceState}`;
  if (scope === "state") return `UF: ${sourceState}`;
  if (scope === "national") return "Base nacional";
  return "Fallback manual revisavel";
}

function createRegionalFallbackWarnings(sources: RegionalCostSource[]) {
  const selectedScope = sources[0]?.scope;
  if (!selectedScope || selectedScope === "city") return [];
  if (selectedScope === "state") return ["Sem fonte municipal compativel; usando fonte estadual como fallback."];
  if (selectedScope === "national") return ["Sem fonte municipal/estadual compativel; usando fonte nacional como fallback."];
  return ["Sem fonte regional compativel; usando fonte manual revisavel como fallback."];
}

function normalizeRegionText(value: string | undefined | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function suggestBudgetMatches(input: BudgetMatchSuggestionInput): BudgetMatch[] {
  const existingMatches = input.existingMatches ?? [];
  const matchedQuantityIds = new Set(existingMatches.map((match) => match.quantityItemId));
  const suggestions: BudgetMatch[] = [];

  for (const quantityItem of input.quantityItems) {
    if (matchedQuantityIds.has(quantityItem.id)) continue;

    const candidates = input.costItems
      .filter((costItem) => costItem.constructionMethod === quantityItem.constructionMethod)
      .map((costItem) => ({ costItem, score: scoreCostMatch(quantityItem, costItem) }))
      .filter((candidate) => candidate.score.total >= 0.25)
      .sort((a, b) => b.score.total - a.score.total);
    const best = candidates[0];
    if (!best) continue;

    suggestions.push(createBudgetMatchSuggestion(quantityItem, best.costItem, best.score));
  }

  return suggestions;
}

export function createBudgetMatchSuggestion(
  quantityItem: BudgetAssistantQuantityItem,
  costItem: CostItem,
  score = scoreCostMatch(quantityItem, costItem)
): BudgetMatch {
  const confidence = confidenceFromScore(score.total);
  const reasons = [
    score.unitCompatible ? "Unidade compativel." : `Unidade divergente: quantitativo em ${quantityItem.unit}, preco em ${costItem.unit}.`,
    score.categoryCompatible ? "Categoria compativel." : "Categoria diferente; revisar antes de aprovar.",
    score.textOverlap > 0 ? `Descricao com ${Math.round(score.textOverlap * 100)}% de semelhanca por termos.` : "Descricao exige revisao manual.",
  ];

  return {
    id: `ai-match-${quantityItem.id}-${costItem.id}`,
    quantityItemId: quantityItem.id,
    costItemId: costItem.id,
    confidence,
    reason: reasons.join(" "),
    unitCompatible: score.unitCompatible,
    requiresReview: true,
    approvedByUser: false,
  };
}

export function createManualCostSource(input: ManualCostSourceInput): CostSource {
  return {
    id: `manual-source-${Date.now()}`,
    type: input.type,
    title: input.title.trim(),
    supplier: input.supplier.trim(),
    state: input.state.trim(),
    city: input.city.trim(),
    referenceDate: input.referenceDate,
    reliability: input.reliability ?? "low",
    notes: input.notes?.trim() ?? "",
  };
}

export function createManualCostItem(input: ManualCostItemInput) {
  const suffix = `${input.quantityItem.id}-${Date.now()}`;
  const total = roundCurrency(input.quantity * input.unitPrice);
  const costItem: CostItem = {
    id: `manual-cost-${suffix}`,
    constructionMethod: input.quantityItem.constructionMethod,
    category: input.category,
    description: input.description.trim(),
    quantity: input.quantity,
    unit: input.unit,
    unitPrice: input.unitPrice,
    total,
    sourceId: input.sourceId,
    sourceCode: "MANUAL",
    confidence: input.confidence,
    requiresReview: true,
    notes: input.notes?.trim() ?? "Preco manual informado pelo usuario; revisar fonte antes de tratar como orcamento revisado.",
  };
  const match: BudgetMatch = {
    id: `manual-match-${suffix}`,
    quantityItemId: input.quantityItem.id,
    costItemId: costItem.id,
    confidence: input.confidence,
    reason: "Preco manual vinculado ao quantitativo selecionado.",
    unitCompatible: input.unit === input.quantityItem.unit,
    requiresReview: true,
    approvedByUser: true,
  };

  return { costItem, match };
}

export function createManualCostEntry(input: ManualCostEntryInput) {
  const source = createManualCostSource({
    title: input.sourceTitle.trim(),
    type: input.sourceType ?? "manual",
    supplier: input.supplier ?? input.sourceTitle,
    state: input.state,
    city: input.city,
    referenceDate: input.referenceDate,
    reliability: reliabilityForConfidence(input.confidence),
    notes: input.notes,
  });
  const entry = createManualCostItem({
    quantityItem: input.quantityItem,
    sourceId: source.id,
    description: input.quantityItem.description,
    category: input.quantityItem.category,
    quantity: input.quantityItem.quantity,
    unit: input.quantityItem.unit,
    unitPrice: input.unitPrice,
    confidence: input.confidence,
    notes: input.notes,
  });

  return { source, ...entry };
}

function reliabilityForConfidence(confidence: BudgetConfidenceLevel): CostSource["reliability"] {
  if (confidence === "high" || confidence === "medium") return confidence;
  return "low";
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function scoreCostMatch(quantityItem: BudgetAssistantQuantityItem, costItem: CostItem) {
  const unitCompatible = quantityItem.unit === costItem.unit;
  const categoryCompatible = quantityItem.category === costItem.category;
  const textOverlap = tokenOverlap(quantityItem.description, costItem.description);
  const confidenceWeight = costItem.confidence === "high" ? 1 : costItem.confidence === "medium" ? 0.7 : costItem.confidence === "low" ? 0.35 : 0;
  const total =
    (unitCompatible ? 0.35 : 0) +
    (categoryCompatible ? 0.25 : 0) +
    textOverlap * 0.3 +
    confidenceWeight * 0.1;

  return {
    total,
    unitCompatible,
    categoryCompatible,
    textOverlap,
  };
}

function confidenceFromScore(score: number): BudgetConfidenceLevel {
  if (score >= 0.75) return "high";
  if (score >= 0.55) return "medium";
  if (score >= 0.35) return "low";
  return "unverified";
}

function tokenOverlap(left: string, right: string) {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let matches = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) matches += 1;
  });
  return matches / Math.max(leftTokens.size, rightTokens.size);
}

function tokens(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}
