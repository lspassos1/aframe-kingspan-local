import type { Project, Scenario } from "@/types/project";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { calculateScenarioBudget } from "@/lib/construction-methods/scenario-calculations";
import type {
  BudgetAssistantQuantityItem,
  BudgetAssistantViewModel,
  BudgetConfidenceLevel,
  BudgetMatch,
  CostItem,
  CostSource,
} from "./types";

export interface BudgetAssistantData {
  costSources?: CostSource[];
  costItems?: CostItem[];
  matches?: BudgetMatch[];
}

export interface ManualCostEntryInput {
  quantityItem: BudgetAssistantQuantityItem;
  sourceTitle: string;
  referenceDate: string;
  unitPrice: number;
  confidence: BudgetConfidenceLevel;
  city: string;
  state: string;
  notes?: string;
}

export function createBudgetAssistantViewModel(project: Project, scenario: Scenario, data: BudgetAssistantData = {}): BudgetAssistantViewModel {
  const definition = getConstructionMethodDefinition(scenario.constructionMethod);
  const budget = calculateScenarioBudget(project, scenario);
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
  const costSources = data.costSources ?? [];
  const costItems = data.costItems ?? [];
  const matches = data.matches ?? [];
  const pricedQuantityIds = new Set(matches.map((match) => match.quantityItemId));
  const pendingPriceItems = quantityItems.filter((item) => item.requiresPriceSource && !pricedQuantityIds.has(item.id));
  const lowConfidenceItems = costItems.filter((item) => item.confidence === "low" || item.confidence === "unverified");

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    methodName: definition.name,
    status: "preliminary",
    quantityItems,
    costSources,
    costItems,
    matches,
    pendingPriceItems,
    lowConfidenceItems,
    unpricedCount: pendingPriceItems.length,
    lowConfidenceCount: lowConfidenceItems.length,
  };
}

export function createManualCostEntry(input: ManualCostEntryInput) {
  const suffix = `${input.quantityItem.id}-${Date.now()}`;
  const source: CostSource = {
    id: `manual-source-${suffix}`,
    type: "manual",
    title: input.sourceTitle.trim(),
    state: input.state.trim(),
    city: input.city.trim(),
    referenceDate: input.referenceDate,
    reliability: reliabilityForConfidence(input.confidence),
    notes: input.notes?.trim() ?? "",
  };
  const total = roundCurrency(input.quantityItem.quantity * input.unitPrice);
  const costItem: CostItem = {
    id: `manual-cost-${suffix}`,
    constructionMethod: input.quantityItem.constructionMethod,
    category: input.quantityItem.category,
    description: input.quantityItem.description,
    quantity: input.quantityItem.quantity,
    unit: input.quantityItem.unit,
    unitPrice: input.unitPrice,
    total,
    sourceId: source.id,
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
    unitCompatible: true,
    requiresReview: true,
    approvedByUser: false,
  };

  return { source, costItem, match };
}

function reliabilityForConfidence(confidence: BudgetConfidenceLevel): CostSource["reliability"] {
  if (confidence === "high" || confidence === "medium") return confidence;
  return "low";
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
