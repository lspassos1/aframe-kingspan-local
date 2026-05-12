import { describe, expect, it } from "vitest";
import { evaluatePriceQuality, evaluateServiceCompositionPriceQuality, type BudgetSourceMeta, type ServiceComposition } from "@/lib/budget-assistant";
import { importSinapiPriceBase, type SinapiSource } from "@/lib/sinapi";

const source: SinapiSource = {
  id: "sinapi-ba-2026-05",
  title: "SINAPI BA 2026-05",
  supplier: "CAIXA",
  state: "BA",
  city: "",
  referenceDate: "2026-05",
  regime: "desonerado",
  reliability: "high",
  notes: "Base oficial importada pelo usuario.",
};

const sourceMeta: BudgetSourceMeta = {
  sourceId: "sinapi-ba-2026-05",
  sourceCode: "SINAPI-87489",
  referenceDate: "2026-05",
  city: "Cruz das Almas",
  state: "Bahia",
  confidence: "high",
  requiresReview: false,
  notes: "Fonte SINAPI importada e revisada.",
};

describe("price quality contract", () => {
  it("accepts a traceable reviewed price with compatible unit, region, reference, regime and cost breakdown", () => {
    expect(
      evaluatePriceQuality({
        sourceId: "sinapi-ba-2026-05",
        sourceCode: "SINAPI-87489",
        state: "BA",
        referenceDate: "2026-05",
        regime: "desonerado",
        unit: "m2",
        expectedUnit: "m2",
        expectedState: "Bahia",
        directUnitCostBRL: 80,
        materialCostBRL: 45,
        laborCostBRL: 30,
        equipmentCostBRL: 5,
        totalLaborHoursPerUnit: 0.4,
        wastePercent: 5,
        requiresReview: false,
      })
    ).toMatchObject({ status: "usable", usable: true, requiresReview: false, issues: [] });
  });

  it("keeps zero, missing and review-marked prices pending instead of usable", () => {
    const zeroPriceInput = createQualityInput({ directUnitCostBRL: 0, materialCostBRL: 0, laborCostBRL: 0, equipmentCostBRL: 0 });

    expect(evaluatePriceQuality(zeroPriceInput).issues.map((issue) => issue.code)).toContain("zero_price");
    expect(evaluatePriceQuality(createQualityInput({ directUnitCostBRL: undefined })).issues.map((issue) => issue.code)).toContain("missing_price");
    expect(evaluatePriceQuality(createQualityInput({ requiresReview: true })).issues.map((issue) => issue.code)).toContain("requires_review");

    expect(evaluatePriceQuality(zeroPriceInput)).toMatchObject({ status: "pending", usable: false });
  });

  it("blocks invalid units, incompatible units and out-of-region prices unless fallback is explicit", () => {
    expect(evaluatePriceQuality(createQualityInput({ unit: "saco" }))).toMatchObject({ status: "invalid", usable: false });
    expect(evaluatePriceQuality(createQualityInput({ unit: "m3", expectedUnit: "m2" })).issues.map((issue) => issue.code)).toContain("unit_incompatible");
    expect(evaluatePriceQuality(createQualityInput({ state: "Sao Paulo", expectedState: "BA" })).issues.map((issue) => issue.code)).toContain("out_of_region");
    expect(evaluatePriceQuality(createQualityInput({ state: "Sao Paulo", expectedState: "BA", allowOutOfRegionFallback: true }))).toMatchObject({
      status: "usable",
    });
  });

  it("requires source metadata, reference month and known regime", () => {
    const result = evaluatePriceQuality(
      createQualityInput({
        sourceId: "",
        sourceCode: "",
        referenceDate: "",
        regime: "unknown",
      })
    );

    expect(result).toMatchObject({ status: "pending", usable: false });
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["missing_source_metadata", "missing_reference", "unknown_regime"]));
  });

  it("invalidates impossible cost breakdown, negative H/H and negative losses", () => {
    const invalidBreakdown = evaluatePriceQuality(createQualityInput({ directUnitCostBRL: 50, materialCostBRL: 80, laborCostBRL: 20 }));
    const negativeLabor = evaluatePriceQuality(createQualityInput({ totalLaborHoursPerUnit: -0.1 }));
    const negativeWaste = evaluatePriceQuality(createQualityInput({ wastePercent: -1 }));

    expect(invalidBreakdown).toMatchObject({ status: "invalid", usable: false });
    expect(invalidBreakdown.issues.map((issue) => issue.code)).toContain("direct_cost_below_components");
    expect(negativeLabor.issues.map((issue) => issue.code)).toContain("negative_labor_hours");
    expect(negativeWaste.issues.map((issue) => issue.code)).toContain("negative_waste");
  });

  it("keeps unrealistic H/H and waste pending until reviewed", () => {
    const labor = evaluatePriceQuality(createQualityInput({ totalLaborHoursPerUnit: 120 }));
    const waste = evaluatePriceQuality(createQualityInput({ wastePercent: 80 }));

    expect(labor).toMatchObject({ status: "pending", usable: false });
    expect(waste).toMatchObject({ status: "pending", usable: false });
    expect(labor.issues.map((issue) => issue.code)).toContain("unrealistic_labor_hours");
    expect(waste.issues.map((issue) => issue.code)).toContain("unrealistic_waste");
  });

  it("does not treat a price candidate as approved automatically", () => {
    const composition = createServiceComposition();
    const result = evaluateServiceCompositionPriceQuality(composition, {
      candidateApprovedByUser: false,
      expectedState: "BA",
      expectedUnit: "m2",
    });

    expect(result).toMatchObject({ status: "pending", usable: false, requiresReview: true });
    expect(result.issues.map((issue) => issue.code)).toContain("candidate_requires_review");
  });

  it("aligns with current SINAPI importer statuses without live services", async () => {
    const valid = await importSinapiPriceBase({
      rows: [{ codigo: "SINAPI-100", descricao: "Alvenaria validada", unidade: "m2", preco_total: 80, material: 45, mao_obra: 30, equipamento: 5, hh: 0.4, uf: "BA", data_base: "2026-05", regime: "desonerado" }],
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });
    const zeroed = await importSinapiPriceBase({
      rows: [{ codigo: "SINAPI-101", descricao: "Preco zerado", unidade: "m2", preco_total: 0, uf: "BA", data_base: "2026-05", regime: "desonerado" }],
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });
    const outOfRegion = await importSinapiPriceBase({
      rows: [{ codigo: "SINAPI-102", descricao: "Preco fora da UF", unidade: "m2", preco_total: 80, uf: "SP", data_base: "2026-05", regime: "desonerado" }],
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });
    const invalidBreakdown = await importSinapiPriceBase({
      rows: [{ codigo: "SINAPI-103", descricao: "Custo incoerente", unidade: "m2", preco_total: 50, material: 80, mao_obra: 20, uf: "BA", data_base: "2026-05", regime: "desonerado" }],
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });

    expect(evaluateServiceCompositionPriceQuality(valid.serviceCompositions[0], { expectedState: "BA", expectedUnit: "m2" })).toMatchObject({
      status: "usable",
    });
    expect(evaluateServiceCompositionPriceQuality(zeroed.serviceCompositions[0], { expectedState: "BA", expectedUnit: "m2" }).issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["zero_price", "requires_review"])
    );
    expect(evaluateServiceCompositionPriceQuality(outOfRegion.serviceCompositions[0], { expectedState: "BA", expectedUnit: "m2" }).issues.map((issue) => issue.code)).toContain(
      "out_of_region"
    );
    expect(evaluateServiceCompositionPriceQuality(invalidBreakdown.serviceCompositions[0], { expectedState: "BA", expectedUnit: "m2" })).toMatchObject({
      status: "invalid",
    });
  });
});

function createQualityInput(overrides: Parameters<typeof evaluatePriceQuality>[0] = {}) {
  return {
    sourceId: "sinapi-ba-2026-05",
    sourceCode: "SINAPI-87489",
    state: "Bahia",
    referenceDate: "2026-05",
    regime: "desonerado",
    unit: "m2",
    expectedUnit: "m2" as const,
    expectedState: "BA",
    directUnitCostBRL: 80,
    materialCostBRL: 45,
    laborCostBRL: 30,
    equipmentCostBRL: 5,
    totalLaborHoursPerUnit: 0.4,
    wastePercent: 5,
    requiresReview: false,
    ...overrides,
  };
}

function createServiceComposition(overrides: Partial<ServiceComposition> = {}): ServiceComposition {
  return {
    ...sourceMeta,
    id: "service-composition-wall",
    constructionMethod: "conventional-masonry",
    category: "civil",
    serviceCode: "SINAPI-87489",
    description: "Alvenaria de vedacao",
    unit: "m2",
    tags: ["alvenaria", "parede"],
    inputs: [],
    laborRoles: [],
    wasteRules: [],
    materialCostBRL: 45,
    laborCostBRL: 30,
    equipmentCostBRL: 5,
    thirdPartyCostBRL: 0,
    otherCostBRL: 0,
    directUnitCostBRL: 80,
    totalLaborHoursPerUnit: 0.4,
    sinapi: {
      sourceId: sourceMeta.sourceId,
      sourceTitle: "SINAPI BA 2026-05",
      code: sourceMeta.sourceCode,
      description: "Alvenaria de vedacao",
      state: "Bahia",
      city: "Cruz das Almas",
      referenceDate: "2026-05",
      regime: "desonerado",
      priceStatus: "valid",
      confidence: "high",
      requiresReview: false,
      pendingReason: "",
      totalLaborHoursPerUnit: 0.4,
    },
    ...overrides,
  };
}
