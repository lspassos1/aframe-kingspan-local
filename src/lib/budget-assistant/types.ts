import type { ConstructionMethodId } from "@/lib/construction-methods";
import type { MaterialCategory, MaterialUnit } from "@/types/project";

export type PriceSourceType = "sinapi" | "tcpo" | "supplier_quote" | "manual" | "historical" | "web_reference";

export type BudgetConfidenceLevel = "high" | "medium" | "low" | "unverified";

export type BudgetStatus = "preliminary" | "ai_assisted" | "reviewed" | "final_reviewed";

export type PriceSourceRegionalScope = "city" | "state" | "national" | "manual";

export type PriceComponentKind = "material" | "labor" | "equipment" | "third_party" | "other";

export interface PriceSource {
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

export type CostSource = PriceSource;

export interface BudgetSourceMeta {
  sourceId: string;
  sourceCode: string;
  referenceDate: string;
  city: string;
  state: string;
  confidence: BudgetConfidenceLevel;
  requiresReview: boolean;
  notes: string;
}

export interface CompositionInput extends BudgetSourceMeta {
  id: string;
  kind: PriceComponentKind;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
  total: number;
  wasteRuleId?: string;
}

export interface LaborRole extends BudgetSourceMeta {
  id: string;
  role: string;
  hourlyCostBRL: number;
  hoursPerUnit: number;
  totalHours: number;
  total: number;
}

export interface WasteRule extends BudgetSourceMeta {
  id: string;
  label: string;
  appliesTo: PriceComponentKind[];
  percent: number;
}

export interface ServiceComposition extends BudgetSourceMeta {
  id: string;
  constructionMethod: ConstructionMethodId;
  category: MaterialCategory;
  serviceCode: string;
  description: string;
  unit: MaterialUnit;
  tags: string[];
  inputs: CompositionInput[];
  laborRoles: LaborRole[];
  wasteRules: WasteRule[];
  materialCostBRL: number;
  laborCostBRL: number;
  equipmentCostBRL: number;
  thirdPartyCostBRL: number;
  otherCostBRL: number;
  directUnitCostBRL: number;
  totalLaborHoursPerUnit: number;
}

export interface BudgetQuantity {
  id: string;
  scenarioId: string;
  constructionMethod: ConstructionMethodId;
  category: MaterialCategory;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  notes: string;
}

export interface BudgetServiceLine extends BudgetSourceMeta {
  id: string;
  scenarioId: string;
  quantityId: string;
  compositionId: string;
  constructionMethod: ConstructionMethodId;
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
  applicableCostSources: Array<{
    source: CostSource;
    scope: PriceSourceRegionalScope;
    label: string;
  }>;
  selectedPriceSourceIds: string[];
  regionalFallbackWarnings: string[];
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
  priceSources: PriceSource[];
  serviceCompositions: ServiceComposition[];
  budgetQuantities: BudgetQuantity[];
  budgetServiceLines: BudgetServiceLine[];
}
