import { evaluatePriceQuality } from "@/lib/budget-assistant";
import type { BudgetConfidenceLevel, PriceSourceType } from "@/lib/budget-assistant";
import type { ConstructionMethodId } from "@/lib/construction-methods";
import type { MaterialCategory, MaterialUnit } from "@/types/project";
import type { PriceCandidate, PriceCandidateItemType, PriceCandidateRegime, PriceCandidateSearchInput, PriceCandidateStatus } from "./price-candidate-types";
import type { RemotePriceDbAdapter, RemotePriceDbConfig } from "./remote-price-db";
import { createDisabledRemotePriceDbAdapter, resolveRemotePriceDbConfig } from "./remote-price-db";

type FetchLike = typeof fetch;

export interface SupabasePriceCandidateRow {
  id: string;
  source_id: string;
  source_title: string;
  supplier: string;
  source_type: string;
  item_type: string;
  code: string;
  description: string;
  unit: string;
  category: string;
  construction_method: string;
  state: string;
  city: string | null;
  reference_month: string;
  regime: string;
  material_cost_brl: number | string | null;
  labor_cost_brl: number | string | null;
  equipment_cost_brl: number | string | null;
  third_party_cost_brl: number | string | null;
  other_cost_brl: number | string | null;
  direct_unit_cost_brl: number | string | null;
  total_labor_hours_per_unit: number | string | null;
  price_status: string;
  confidence: string;
  requires_review: boolean | null;
  pending_reason: string | null;
  tags: string[] | null;
}

export function createRemotePriceDbAdapter(
  env: Record<string, string | undefined> = process.env,
  options: { fetcher?: FetchLike } = {}
): RemotePriceDbAdapter {
  const config = resolveRemotePriceDbConfig(env);
  if (!config) return createDisabledRemotePriceDbAdapter();
  return createSupabasePriceAdapter(config, options);
}

export function createSupabasePriceAdapter(config: RemotePriceDbConfig, options: { fetcher?: FetchLike } = {}): RemotePriceDbAdapter {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = config.supabaseUrl.replace(/\/+$/, "");

  return {
    provider: "supabase",
    isConfigured: () => Boolean(baseUrl && config.supabaseAnonKey),
    searchCandidates: async (input) => {
      if (!baseUrl || !config.supabaseAnonKey) {
        return { configured: false, candidates: [], error: "Remote price database is not configured." };
      }

      const response = await fetcher(`${baseUrl}/rest/v1/rpc/search_price_candidates`, {
        method: "POST",
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toSupabaseSearchPayload(input)),
      });

      if (!response.ok) {
        return {
          configured: true,
          candidates: [],
          error: `Remote price database search failed with status ${response.status}.`,
        };
      }

      const rows = (await response.json()) as SupabasePriceCandidateRow[];
      return {
        configured: true,
        candidates: rows.map((row) => mapSupabasePriceCandidateRow(row, input)),
      };
    },
  };
}

export function mapSupabasePriceCandidateRow(row: SupabasePriceCandidateRow, input: Partial<PriceCandidateSearchInput> = {}): PriceCandidate {
  const candidate: Omit<PriceCandidate, "quality"> = {
    id: row.id,
    sourceId: row.source_id,
    sourceTitle: row.source_title,
    supplier: row.supplier,
    sourceType: toPriceSourceType(row.source_type),
    itemType: toItemType(row.item_type),
    code: row.code,
    description: row.description,
    unit: toMaterialUnit(row.unit),
    category: toMaterialCategory(row.category),
    constructionMethod: toConstructionMethod(row.construction_method),
    state: row.state,
    city: row.city ?? "",
    referenceMonth: row.reference_month,
    regime: toRegime(row.regime),
    directUnitCostBRL: toNumber(row.direct_unit_cost_brl),
    materialCostBRL: toNumber(row.material_cost_brl),
    laborCostBRL: toNumber(row.labor_cost_brl),
    equipmentCostBRL: toNumber(row.equipment_cost_brl),
    thirdPartyCostBRL: toNumber(row.third_party_cost_brl),
    otherCostBRL: toNumber(row.other_cost_brl),
    totalLaborHoursPerUnit: toNumber(row.total_labor_hours_per_unit),
    priceStatus: toPriceStatus(row.price_status),
    confidence: toConfidence(row.confidence),
    requiresReview: row.requires_review !== false,
    pendingReason: row.pending_reason ?? "",
    tags: row.tags ?? [],
  };

  return {
    ...candidate,
    quality: evaluatePriceQuality({
      source: {
        id: candidate.sourceId,
        type: candidate.sourceType,
        title: candidate.sourceTitle,
        supplier: candidate.supplier,
        state: candidate.state,
        city: candidate.city,
        referenceDate: candidate.referenceMonth,
      },
      sourceId: candidate.sourceId,
      sourceCode: candidate.code,
      state: candidate.state,
      referenceDate: candidate.referenceMonth,
      regime: candidate.regime,
      unit: candidate.unit,
      expectedUnit: input.unit,
      expectedState: input.state,
      directUnitCostBRL: candidate.directUnitCostBRL,
      materialCostBRL: candidate.materialCostBRL,
      laborCostBRL: candidate.laborCostBRL,
      equipmentCostBRL: candidate.equipmentCostBRL,
      thirdPartyCostBRL: candidate.thirdPartyCostBRL,
      otherCostBRL: candidate.otherCostBRL,
      totalLaborHoursPerUnit: candidate.totalLaborHoursPerUnit,
      priceStatus: candidate.priceStatus,
      requiresReview: candidate.requiresReview,
      candidateApprovedByUser: false,
    }),
  };
}

function toSupabaseSearchPayload(input: PriceCandidateSearchInput) {
  return {
    search_query: input.query,
    search_state: input.state || null,
    search_reference_month: input.referenceMonth || null,
    search_regime: input.regime || null,
    search_unit: input.unit || null,
    search_category: input.category || null,
    search_construction_method: input.constructionMethod || null,
    search_limit: input.limit ?? 20,
  };
}

function toPriceSourceType(value: string): PriceSourceType {
  if (["sinapi", "tcpo", "supplier_quote", "manual", "historical", "web_reference"].includes(value)) return value as PriceSourceType;
  return "web_reference";
}

function toItemType(value: string): PriceCandidateItemType {
  return value === "input" ? "input" : "composition";
}

function toRegime(value: string): PriceCandidateRegime {
  if (value === "onerado" || value === "nao_desonerado" || value === "desonerado") return value;
  return "unknown";
}

function toPriceStatus(value: string): PriceCandidateStatus {
  if (["valid", "zeroed", "missing", "requires_review", "invalid_unit", "out_of_region", "invalid"].includes(value)) return value as PriceCandidateStatus;
  return "requires_review";
}

function toConfidence(value: string): BudgetConfidenceLevel {
  if (value === "high" || value === "medium" || value === "low" || value === "unverified") return value;
  return "unverified";
}

function toMaterialUnit(value: string): MaterialUnit {
  if (value === "un" || value === "m" || value === "m2" || value === "m3" || value === "kg" || value === "package" || value === "lot") return value;
  return "un";
}

function toMaterialCategory(value: string): MaterialCategory {
  if (["panels", "fasteners", "flashings", "sealants", "facade", "steel", "civil", "labor", "technical", "freight", "contingency", "other"].includes(value)) {
    return value as MaterialCategory;
  }
  return "other";
}

function toConstructionMethod(value: string): ConstructionMethodId {
  if (value === "aframe" || value === "conventional-masonry" || value === "eco-block" || value === "monolithic-eps") return value;
  return "conventional-masonry";
}

function toNumber(value: number | string | null) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
