import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { BudgetQuantity, BudgetSourceMeta, PriceSource, ServiceComposition } from "@/lib/budget-assistant";
import {
  createDisabledRemotePriceDbAdapter,
  createMockRemotePriceDbAdapter,
  createRemotePriceDbAdapter,
  createSupabasePriceAdapter,
  mapSupabasePriceCandidateRow,
  resolvePriceCandidates,
  type SupabasePriceCandidateRow,
} from "@/lib/pricing";

const quantity: BudgetQuantity = {
  id: "quantity-wall",
  scenarioId: "scenario-a",
  constructionMethod: "conventional-masonry",
  category: "civil",
  description: "Alvenaria de vedacao",
  quantity: 120,
  unit: "m2",
  notes: "Quantidade revisavel.",
};

const sourceMeta: BudgetSourceMeta = {
  sourceId: "sinapi-ba-2026-05",
  sourceCode: "SINAPI-87489",
  referenceDate: "2026-05",
  city: "Cruz das Almas",
  state: "Bahia",
  confidence: "high",
  requiresReview: false,
  notes: "Fonte local importada.",
};

const source: PriceSource = {
  id: "sinapi-ba-2026-05",
  type: "sinapi",
  title: "SINAPI BA 2026-05",
  supplier: "CAIXA",
  state: "BA",
  city: "Cruz das Almas",
  referenceDate: "2026-05",
  reliability: "high",
  notes: "Base importada.",
};

describe("remote price candidate resolver", () => {
  it("maps Supabase RPC rows to normalized price candidates without approving them", () => {
    const candidate = mapSupabasePriceCandidateRow(createRemoteRow(), { state: "BA", unit: "m2" });

    expect(candidate).toMatchObject({
      id: "remote-wall",
      sourceId: "source-ba",
      sourceTitle: "SINAPI BA",
      sourceType: "sinapi",
      code: "87489",
      unit: "m2",
      category: "civil",
      constructionMethod: "conventional-masonry",
      tags: ["alvenaria", "parede"],
      directUnitCostBRL: 82.45,
      requiresReview: false,
    });
    expect(candidate.quality).toMatchObject({ status: "pending", usable: false, requiresReview: true });
    expect(candidate.quality.issues.map((issue) => issue.code)).toContain("candidate_requires_review");
  });

  it("queries the public Supabase RPC through anon-read config and maps rows", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([createRemoteRow()]), { status: 200 }));
    const adapter = createSupabasePriceAdapter(
      {
        provider: "supabase",
        supabaseUrl: "https://prices.example.supabase.co/",
        supabaseAnonKey: "anon-read-key",
      },
      { fetcher }
    );

    const result = await adapter.searchCandidates({
      query: "alvenaria",
      state: "BA",
      referenceMonth: "2026-05-01",
      regime: "desonerado",
      unit: "m2",
      category: "civil",
      constructionMethod: "conventional-masonry",
      limit: 5,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://prices.example.supabase.co/rest/v1/rpc/search_price_candidates",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "anon-read-key",
          Authorization: "Bearer anon-read-key",
        }),
        body: JSON.stringify({
          search_query: "alvenaria",
          search_state: "BA",
          search_reference_month: "2026-05-01",
          search_regime: "desonerado",
          search_unit: "m2",
          search_category: "civil",
          search_construction_method: "conventional-masonry",
          search_limit: 5,
        }),
      })
    );
    expect(result).toMatchObject({ configured: true, candidates: [expect.objectContaining({ id: "remote-wall" })] });
  });

  it("keeps project-local approved prices before remote DB candidates", async () => {
    const composition = createComposition();
    const remote = mapSupabasePriceCandidateRow(createRemoteRow({ id: "remote-alternative", code: "90000" }), { state: "BA", unit: "m2" });

    const result = await resolvePriceCandidates({
      quantities: [quantity],
      priceSources: [source],
      serviceCompositions: [composition],
      approvedLinks: [{ id: "approved-link", quantityId: quantity.id, compositionId: composition.id, approvedByUser: true }],
      location: { city: "Cruz das Almas", state: "BA" },
      remoteDb: createMockRemotePriceDbAdapter([remote]),
    });

    expect(result.candidates.map((candidate) => candidate.origin)).toEqual(["project-approved", "remote-db", "manual-entry"]);
    expect(result.candidates[0]).toMatchObject({ priority: 1, approvedByUser: true, compositionId: composition.id });
    expect(result.candidates.find((candidate) => candidate.origin === "remote-db")).toMatchObject({ priority: 3, approvedByUser: false, requiresReview: true });
  });

  it("falls back cleanly when the remote DB is not configured", async () => {
    const result = await resolvePriceCandidates({
      quantities: [quantity],
      serviceCompositions: [createComposition()],
      location: { city: "Cruz das Almas", state: "BA" },
      remoteDb: createDisabledRemotePriceDbAdapter(),
    });

    expect(result.remote).toMatchObject({ configured: false, searched: false, candidates: [] });
    expect(result.manualEntryAvailable).toBe(true);
    expect(result.candidates.map((candidate) => candidate.origin)).toEqual(["project-imported", "manual-entry"]);
  });

  it("keeps remote candidates review-required and never auto-approved", async () => {
    const remote = mapSupabasePriceCandidateRow(createRemoteRow(), { state: "BA", unit: "m2" });

    const result = await resolvePriceCandidates({
      quantities: [quantity],
      serviceCompositions: [],
      location: { city: "Cruz das Almas", state: "BA" },
      remoteDb: createMockRemotePriceDbAdapter([remote]),
    });

    const remoteCandidate = result.candidates.find((candidate) => candidate.origin === "remote-db");
    expect(remoteCandidate).toMatchObject({ approvedByUser: false, requiresReview: true });
    expect(remoteCandidate?.qualityIssues.map((issue) => issue.code)).toContain("candidate_requires_review");
  });

  it("creates a disabled adapter when public read config is missing", async () => {
    const adapter = createRemotePriceDbAdapter({ NEXT_PUBLIC_PRICE_DB_PROVIDER: "supabase" });

    expect(adapter.isConfigured()).toBe(false);
    await expect(adapter.searchCandidates({ query: "porta", state: "BA" })).resolves.toMatchObject({
      configured: false,
      candidates: [],
    });
  });

  it("keeps service-role secrets out of app pricing code", () => {
    const pricingDir = join(process.cwd(), "src/lib/pricing");
    const files = ["price-candidate-types.ts", "remote-price-db.ts", "price-resolver.ts", "supabase-price-adapter.ts"].map((file) =>
      readFileSync(join(pricingDir, file), "utf8")
    );

    expect(files.join("\n")).not.toMatch(/SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|service_role/i);
  });
});

function createRemoteRow(overrides: Partial<SupabasePriceCandidateRow> = {}): SupabasePriceCandidateRow {
  return {
    id: "remote-wall",
    source_id: "source-ba",
    source_title: "SINAPI BA",
    supplier: "CAIXA",
    source_type: "sinapi",
    item_type: "composition",
    code: "87489",
    description: "Alvenaria de vedacao com bloco ceramico",
    unit: "m2",
    category: "civil",
    construction_method: "conventional-masonry",
    state: "BA",
    city: "Cruz das Almas",
    reference_month: "2026-05",
    regime: "desonerado",
    material_cost_brl: "48.25",
    labor_cost_brl: "30.20",
    equipment_cost_brl: "4.00",
    third_party_cost_brl: "0",
    other_cost_brl: "0",
    direct_unit_cost_brl: "82.45",
    total_labor_hours_per_unit: "0.45",
    price_status: "valid",
    confidence: "high",
    requires_review: false,
    pending_reason: "",
    tags: ["alvenaria", "parede"],
    ...overrides,
  };
}

function createComposition(overrides: Partial<ServiceComposition> = {}): ServiceComposition {
  return {
    ...sourceMeta,
    id: "local-composition",
    constructionMethod: "conventional-masonry",
    category: "civil",
    serviceCode: "SINAPI-87489",
    description: "Alvenaria de vedacao com bloco ceramico",
    unit: "m2",
    tags: ["alvenaria", "parede"],
    inputs: [],
    laborRoles: [],
    wasteRules: [],
    materialCostBRL: 48,
    laborCostBRL: 30,
    equipmentCostBRL: 4,
    thirdPartyCostBRL: 0,
    otherCostBRL: 0,
    directUnitCostBRL: 82,
    totalLaborHoursPerUnit: 0.45,
    sinapi: {
      sourceId: sourceMeta.sourceId,
      sourceTitle: "SINAPI BA 2026-05",
      code: "SINAPI-87489",
      description: "Alvenaria de vedacao com bloco ceramico",
      state: "BA",
      city: "Cruz das Almas",
      referenceDate: "2026-05",
      regime: "desonerado",
      priceStatus: "valid",
      confidence: "high",
      requiresReview: false,
      pendingReason: "",
      totalLaborHoursPerUnit: 0.45,
    },
    ...overrides,
  };
}
