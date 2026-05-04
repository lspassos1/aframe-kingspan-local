import type { ConstructionMethodId } from "@/lib/construction-methods";
import type { MaterialCategory, MaterialUnit } from "@/types/project";

export type PriceSourceType = "sinapi" | "tcpo" | "supplier_quote" | "manual" | "historical" | "web_reference";

export type BudgetConfidenceLevel = "high" | "medium" | "low" | "unverified";

export type BudgetStatus = "preliminary" | "ai_assisted" | "reviewed" | "final_reviewed";

export interface CostSource {
  id: string;
  type: PriceSourceType;
  title: string;
  supplier: string;
  state: string;
  city: string;
  referenceDate: string;
  uploadedFileName?: string;
  url?: string;
  reliability: Exclude<BudgetConfidenceLevel, "unverified">;
  notes: string;
}

export interface CostItem {
  id: string;
  constructionMethod: ConstructionMethodId;
  category: MaterialCategory;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
  total: number;
  sourceId: string;
  sourceCode: string;
  confidence: BudgetConfidenceLevel;
  requiresReview: boolean;
  notes: string;
}

export interface CostCompositionItem {
  id: string;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
  total: number;
}

export interface CostComposition {
  id: string;
  sourceId: string;
  sourceCode: string;
  description: string;
  unit: MaterialUnit;
  items: CostCompositionItem[];
  labor: number;
  equipment: number;
  material: number;
  totalUnitPrice: number;
  referenceDate: string;
}

export interface BudgetMatch {
  id: string;
  quantityItemId: string;
  costItemId: string;
  confidence: BudgetConfidenceLevel;
  reason: string;
  unitCompatible: boolean;
  requiresReview: boolean;
  approvedByUser: boolean;
}

export interface BudgetAssistantQuantityItem {
  id: string;
  constructionMethod: ConstructionMethodId;
  category: MaterialCategory;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  estimatedTotalBRL: number;
  requiresPriceSource: boolean;
  notes: string;
}

export interface BudgetAssistantViewModel {
  scenarioId: string;
  scenarioName: string;
  methodName: string;
  status: BudgetStatus;
  quantityItems: BudgetAssistantQuantityItem[];
  costSources: CostSource[];
  costItems: CostItem[];
  matches: BudgetMatch[];
  pendingPriceItems: BudgetAssistantQuantityItem[];
  lowConfidenceItems: CostItem[];
  unpricedCount: number;
  lowConfidenceCount: number;
}

export interface BudgetAssistantProjectData {
  costSources: CostSource[];
  costItems: CostItem[];
  matches: BudgetMatch[];
}
