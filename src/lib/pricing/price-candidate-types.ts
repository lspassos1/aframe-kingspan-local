import type { ConstructionMethodId } from "@/lib/construction-methods";
import type { BudgetConfidenceLevel, PriceQualityIssue, PriceQualityResult, PriceSourceType } from "@/lib/budget-assistant";
import type { MaterialCategory, MaterialUnit } from "@/types/project";

export type RemotePriceDbProvider = "supabase";

export type PriceCandidateOrigin =
  | "project-approved"
  | "project-imported"
  | "remote-db"
  | "manual-entry"
  | "external-api-future"
  | "ai-market-future";

export type PriceCandidateItemType = "composition" | "input";

export type PriceCandidateStatus = "valid" | "zeroed" | "missing" | "requires_review" | "invalid_unit" | "out_of_region" | "invalid";

export type PriceCandidateRegime = "onerado" | "nao_desonerado" | "desonerado" | "unknown";

export interface PriceCandidateSearchInput {
  query: string;
  state: string;
  referenceMonth?: string;
  regime?: PriceCandidateRegime;
  unit?: MaterialUnit;
  category?: MaterialCategory;
  constructionMethod?: ConstructionMethodId;
  limit?: number;
}

export interface PriceCandidate {
  id: string;
  sourceId: string;
  sourceTitle: string;
  supplier: string;
  sourceType: PriceSourceType;
  itemType: PriceCandidateItemType;
  code: string;
  description: string;
  unit: MaterialUnit;
  category: MaterialCategory;
  constructionMethod: ConstructionMethodId;
  state: string;
  city: string;
  referenceMonth: string;
  regime: PriceCandidateRegime;
  directUnitCostBRL: number;
  materialCostBRL: number;
  laborCostBRL: number;
  equipmentCostBRL: number;
  thirdPartyCostBRL: number;
  otherCostBRL: number;
  totalLaborHoursPerUnit: number;
  priceStatus: PriceCandidateStatus;
  confidence: BudgetConfidenceLevel;
  requiresReview: boolean;
  pendingReason: string;
  tags: string[];
  quality: PriceQualityResult;
}

export interface PriceResolutionCandidate {
  id: string;
  priority: number;
  origin: PriceCandidateOrigin;
  label: string;
  quantityId?: string;
  compositionId?: string;
  approvedByUser: boolean;
  requiresReview: boolean;
  unitCompatible?: boolean;
  quality?: PriceQualityResult;
  qualityIssues: PriceQualityIssue[];
  remoteCandidate?: PriceCandidate;
}

export interface PriceResolverResult {
  candidates: PriceResolutionCandidate[];
  remote: {
    configured: boolean;
    searched: boolean;
    candidates: PriceCandidate[];
    error?: string;
  };
  manualEntryAvailable: boolean;
  futureExternalApiAvailable: false;
  futureAiMarketSuggestionAvailable: false;
}
