import { defaultProject } from "@/data/defaultProject";
import { createBudgetAssistantViewModel, type BudgetAssistantProjectData, type BudgetMatch, type CostItem, type CostSource } from "@/lib/budget-assistant";
import type { Project } from "@/types/project";

export const productGoldenFlowEnvironments = {
  noAiNoRemoteDb: {
    AI_PLAN_EXTRACT_ENABLED: "false",
    AI_MODE: "free-cloud",
  },
  freeModeNoRemoteDb: {
    AI_PLAN_EXTRACT_ENABLED: "true",
    AI_MODE: "free-cloud",
    AI_PLAN_PRIMARY_PROVIDER: "gemini",
    AI_PLAN_REVIEW_PROVIDER: "openrouter",
    AI_TEXT_PROVIDER: "groq",
    AI_TEXT_FALLBACK_PROVIDER: "cerebras",
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_MODEL: "gemini-test-model",
    OPENROUTER_API_KEY: "test-openrouter-key",
    OPENROUTER_PLAN_REVIEW_MODEL: "openrouter-free-test-model:free",
  },
  freeModeWithRemoteDb: {
    AI_PLAN_EXTRACT_ENABLED: "true",
    AI_MODE: "free-cloud",
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_MODEL: "gemini-test-model",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  },
} as const;

export function createGoldenFlowProject(): Project {
  return JSON.parse(JSON.stringify(defaultProject)) as Project;
}

export function createGoldenFlowNoPriceBaseProject(): Project {
  return withBudgetAssistantData({});
}

export function createGoldenFlowLocalPriceBaseProject(): Project {
  const project = createGoldenFlowProject();
  const scenario = project.scenarios[0];
  const quantityItem = createBudgetAssistantViewModel(project, scenario).pendingPriceItems[0];
  const source = createGoldenSource("golden-local-source", "SINAPI BA 2026-05");
  const costItem = createGoldenCostItem({
    id: "golden-cost-panel",
    sourceId: source.id,
    quantityItem,
    confidence: "medium",
    unitPrice: 138.5,
  });
  const match = createGoldenMatch({
    id: "golden-match-panel",
    quantityItemId: quantityItem.id,
    costItemId: costItem.id,
    confidence: "medium",
    approvedByUser: true,
  });

  return withBudgetAssistantData({
    costSources: [source],
    priceSources: [source],
    costItems: [costItem],
    matches: [match],
  });
}

export function createGoldenFlowReviewRequiredProject(): Project {
  const project = createGoldenFlowProject();
  const scenario = project.scenarios[0];
  const quantityItem = createBudgetAssistantViewModel(project, scenario).pendingPriceItems[0];
  const source = createGoldenSource("golden-review-source", "Cotacao manual revisavel");
  const costItem = createGoldenCostItem({
    id: "golden-cost-review",
    sourceId: source.id,
    quantityItem,
    confidence: "low",
    unitPrice: 96.75,
  });
  const match = createGoldenMatch({
    id: "golden-match-review",
    quantityItemId: quantityItem.id,
    costItemId: costItem.id,
    confidence: "low",
    approvedByUser: true,
  });

  return withBudgetAssistantData({
    costSources: [source],
    priceSources: [source],
    costItems: [costItem],
    matches: [match],
  });
}

function withBudgetAssistantData(data: Partial<BudgetAssistantProjectData>): Project {
  const project = createGoldenFlowProject();

  return {
    ...project,
    budgetAssistant: {
      costSources: data.costSources ?? [],
      costItems: data.costItems ?? [],
      matches: data.matches ?? [],
      priceSources: data.priceSources ?? [],
      serviceCompositions: data.serviceCompositions ?? [],
      budgetQuantities: data.budgetQuantities ?? [],
      budgetServiceLines: data.budgetServiceLines ?? [],
    },
  };
}

function createGoldenSource(id: string, title: string): CostSource {
  return {
    id,
    type: "sinapi",
    title,
    supplier: "CAIXA",
    state: "Bahia",
    city: "Cruz das Almas",
    referenceDate: "2026-05-01",
    reliability: "medium",
    notes: "Fixture sanitizada para fluxos golden; nao representa preco aprovado.",
  };
}

function createGoldenCostItem({
  id,
  sourceId,
  quantityItem,
  confidence,
  unitPrice,
}: {
  id: string;
  sourceId: string;
  quantityItem: ReturnType<typeof createBudgetAssistantViewModel>["pendingPriceItems"][number];
  confidence: CostItem["confidence"];
  unitPrice: number;
}): CostItem {
  return {
    id,
    constructionMethod: quantityItem.constructionMethod,
    category: quantityItem.category,
    description: quantityItem.description,
    quantity: quantityItem.quantity,
    unit: quantityItem.unit,
    unitPrice,
    total: Math.round(quantityItem.quantity * unitPrice * 100) / 100,
    sourceId,
    sourceCode: "GOLDEN-FIXTURE",
    confidence,
    requiresReview: true,
    notes: "Fixture deterministica; requer revisao humana antes de aprovar.",
  };
}

function createGoldenMatch({
  id,
  quantityItemId,
  costItemId,
  confidence,
  approvedByUser,
}: {
  id: string;
  quantityItemId: string;
  costItemId: string;
  confidence: BudgetMatch["confidence"];
  approvedByUser: boolean;
}): BudgetMatch {
  return {
    id,
    quantityItemId,
    costItemId,
    confidence,
    reason: "Fixture golden com fonte revisavel.",
    unitCompatible: true,
    requiresReview: true,
    approvedByUser,
  };
}
