import type { MaterialCategory, MaterialUnit, Project, Scenario } from "@/types/project";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { calculateScenarioBudget } from "@/lib/construction-methods/scenario-calculations";
import type {
  BudgetAssistantQuantityItem,
  BudgetAssistantViewModel,
  BudgetConfidenceLevel,
  BudgetMatch,
  CostItem,
  CostSource,
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
  const quantityIds = new Set(quantityItems.map((item) => item.id));
  const matches = (assistantData.matches ?? []).filter((match) => quantityIds.has(match.quantityItemId));
  const matchedCostItemIds = new Set(matches.map((match) => match.costItemId));
  const costItems = (assistantData.costItems ?? []).filter(
    (item) => item.constructionMethod === scenario.constructionMethod && matchedCostItemIds.has(item.id)
  );
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
    approvedByUser: false,
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
