import { describe, expect, it } from "vitest";
import {
  createBudgetQuantitiesFromQuantitySeeds,
  createQuantitySeedsBudgetPipeline,
} from "@/lib/takeoff/quantity-seeds-budget";
import type {
  BudgetSourceMeta,
  CompositionInput,
  LaborRole,
  ServiceComposition,
} from "@/lib/budget-assistant";
import type { QuantitySeed } from "@/lib/takeoff/quantity-seeds";

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

const materialInput: CompositionInput = {
  ...sourceMeta,
  id: "input-block",
  kind: "material",
  description: "Bloco ceramico",
  quantity: 1,
  unit: "m2",
  unitPrice: 62,
  total: 62,
};

const laborRole: LaborRole = {
  ...sourceMeta,
  id: "labor-wall",
  role: "Pedreiro",
  hourlyCostBRL: 40,
  hoursPerUnit: 0.45,
  totalHours: 0.45,
  total: 18,
};

const reviewedWallSeed: QuantitySeed = {
  id: "wall-net-area",
  scenarioId: "scenario-a",
  constructionMethod: "conventional-masonry",
  category: "walls",
  description: "Area liquida de alvenaria de vedacao",
  quantity: 120,
  unit: "m2",
  source: "user_confirmed",
  confidence: "high",
  requiresReview: false,
  evidence: "Revisado na etapa de quantitativos.",
  notes: "Quantidade confirmada pelo usuario.",
};

describe("quantity seeds budget pipeline", () => {
  it("converts reviewed quantity seeds into BudgetQuantity records", () => {
    const result = createBudgetQuantitiesFromQuantitySeeds([reviewedWallSeed]);

    expect(result.skippedSeeds).toEqual([]);
    expect(result.budgetQuantities).toEqual([
      expect.objectContaining({
        id: "budget-quantity-wall-net-area",
        scenarioId: "scenario-a",
        constructionMethod: "conventional-masonry",
        category: "civil",
        description: reviewedWallSeed.description,
        quantity: 120,
        unit: "m2",
      }),
    ]);
    expect(result.budgetQuantities[0].notes).toContain("Origem do quantitativo: user_confirmed.");
  });

  it("keeps pending rule estimates out of the budget until human review", () => {
    const electricalSeed: QuantitySeed = {
      ...reviewedWallSeed,
      id: "electrical-points",
      category: "electrical",
      description: "Pontos eletricos estimados por media",
      quantity: 34,
      unit: "un",
      source: "rule_estimated",
      confidence: "low",
      requiresReview: true,
      pendingReason: "Confirmar se a media por ambiente pode ser usada.",
    };

    const result = createQuantitySeedsBudgetPipeline({
      seeds: [electricalSeed],
      serviceCompositions: [createSinapiComposition({ id: "sinapi-electrical" })],
      scenarioId: "scenario-a",
      constructionMethod: "conventional-masonry",
    });

    expect(result.status).toBe("preliminary");
    expect(result.budgetQuantities).toHaveLength(0);
    expect(result.skippedSeeds).toEqual([
      expect.objectContaining({
        reason: "quantity_pending",
      }),
    ]);
    expect(result.reviewItems).toEqual([
      expect.objectContaining({
        seedId: "electrical-points",
        status: "needs_review",
        actionRequired: "Resolver pendencia do quantitativo.",
      }),
    ]);
    expect(result.serviceLines).toHaveLength(0);
  });

  it("connects reviewed quantities to approved SINAPI matches and calculates preliminary service lines", () => {
    const composition = createSinapiComposition({ id: "sinapi-wall-ba-current" });
    const preview = createQuantitySeedsBudgetPipeline({
      seeds: [reviewedWallSeed],
      serviceCompositions: [composition],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
    });

    const result = createQuantitySeedsBudgetPipeline({
      seeds: [reviewedWallSeed],
      serviceCompositions: [composition],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
      approvedMatches: preview.suggestedMatches.map((match) => ({ ...match, approvedByUser: true })),
      bdiPercent: 20,
    });

    expect(result.suggestedMatches).toHaveLength(1);
    expect(result.blockedMatches).toHaveLength(0);
    expect(result.serviceLines).toEqual([
      expect.objectContaining({
        quantityId: "budget-quantity-wall-net-area",
        compositionId: "sinapi-wall-ba-current",
        sourceId: sourceMeta.sourceId,
        sourceCode: sourceMeta.sourceCode,
        referenceDate: "2026-05",
        state: "Bahia",
        directCostBRL: 9600,
        bdiBRL: 1920,
        totalBRL: 11520,
        totalLaborHours: 54,
        approvedByUser: true,
      }),
    ]);
    expect(result.reviewItems).toEqual([
      expect.objectContaining({
        quantityId: "budget-quantity-wall-net-area",
        serviceLineId: "service-line-sinapi-match-budget-quantity-wall-net-area-sinapi-wall-ba-current",
        status: "priced",
        sourceCode: sourceMeta.sourceCode,
        actionRequired: "Linha preliminar criada com fonte aprovada.",
      }),
    ]);
  });

  it("blocks approved matches with zeroed SINAPI prices or incompatible units", () => {
    const zeroed = createSinapiComposition({
      id: "sinapi-zeroed",
      directUnitCostBRL: 0,
      materialCostBRL: 0,
      laborCostBRL: 0,
      totalLaborHoursPerUnit: 0,
      sinapi: { priceStatus: "zeroed", requiresReview: true, pendingReason: "Preco oficial veio zerado." },
    });
    const unitMismatch = createSinapiComposition({ id: "sinapi-unit-mismatch", unit: "m3" });
    const preview = createQuantitySeedsBudgetPipeline({
      seeds: [reviewedWallSeed],
      serviceCompositions: [zeroed, unitMismatch],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
    });

    const result = createQuantitySeedsBudgetPipeline({
      seeds: [reviewedWallSeed],
      serviceCompositions: [zeroed, unitMismatch],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
      approvedMatches: preview.suggestedMatches.map((match) => ({ ...match, approvedByUser: true })),
    });

    expect(result.serviceLines).toHaveLength(0);
    expect(result.blockedMatches.map((blocked) => blocked.match.approvalBlockedReason)).toEqual(
      expect.arrayContaining(["price_status", "unit_incompatible"])
    );
    expect(result.budget.skippedLinks.map((link) => link.message)).toEqual(
      expect.arrayContaining([
        "Preco SINAPI pendente bloqueia entrada como linha revisada.",
        "Unidade incompativel bloqueia entrada no orcamento.",
      ])
    );
    expect(result.reviewItems).toEqual([
      expect.objectContaining({
        quantityId: "budget-quantity-wall-net-area",
        status: "blocked",
        actionRequired: "Resolver bloqueio antes de gerar linha revisada.",
      }),
    ]);
  });

  it("keeps reviewed quantities without source candidates ready for UI resolution", () => {
    const result = createQuantitySeedsBudgetPipeline({
      seeds: [reviewedWallSeed],
      serviceCompositions: [],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
    });

    expect(result.budgetQuantities).toHaveLength(1);
    expect(result.unmatchedQuantities).toHaveLength(1);
    expect(result.reviewItems).toEqual([
      expect.objectContaining({
        quantityId: "budget-quantity-wall-net-area",
        status: "needs_source",
        candidateCount: 0,
        pendingReason: "Nenhuma composicao SINAPI candidata encontrada.",
        actionRequired: "Importar base ou vincular composicao existente.",
      }),
    ]);
  });

  it("blocks missing price source metadata and technical review before creating service lines", () => {
    const foundationSeed: QuantitySeed = {
      ...reviewedWallSeed,
      id: "foundation-area",
      category: "foundation",
      description: "Fundacao preliminar confirmada",
      source: "user_confirmed",
      confidence: "high",
      requiresReview: false,
    };
    const missingSource = createSinapiComposition({
      id: "sinapi-missing-source",
      sourceId: "",
      sourceCode: "",
      referenceDate: "",
      sinapi: {
        sourceId: "",
        code: "",
        referenceDate: "",
      },
    });
    const technicalComposition = createSinapiComposition({
      id: "sinapi-foundation",
      category: "civil",
      tags: ["fundacao", "concreto"],
    });
    const outOfRegion = createSinapiComposition({
      id: "sinapi-out-of-region",
      city: "Sao Paulo",
      state: "Sao Paulo",
      sinapi: {
        city: "Sao Paulo",
        state: "Sao Paulo",
      },
    });
    const approvedMatches = [
      {
        id: "manual-match-missing-source",
        quantityId: "budget-quantity-wall-net-area",
        compositionId: missingSource.id,
        approvedByUser: true,
        confidence: "high" as const,
        reason: "Aprovado manualmente.",
        pendingReason: "",
        unitCompatible: true,
        requiresReview: false,
      },
      {
        id: "manual-match-region",
        quantityId: "budget-quantity-wall-net-area",
        compositionId: outOfRegion.id,
        approvedByUser: true,
        confidence: "high" as const,
        reason: "Aprovado manualmente.",
        pendingReason: "",
        unitCompatible: true,
        requiresReview: false,
      },
      {
        id: "manual-match-foundation",
        quantityId: "budget-quantity-foundation-area",
        compositionId: technicalComposition.id,
        approvedByUser: true,
        confidence: "high" as const,
        reason: "Aprovado manualmente.",
        pendingReason: "",
        unitCompatible: true,
        requiresReview: false,
      },
    ];

    const result = createQuantitySeedsBudgetPipeline({
      seeds: [reviewedWallSeed, foundationSeed],
      serviceCompositions: [missingSource, outOfRegion, technicalComposition],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
      approvedMatches,
      technicalProjectApproved: false,
    });

    expect(result.serviceLines).toHaveLength(0);
    expect(result.blockedMatches.map((blocked) => blocked.match.approvalBlockedReason)).toEqual(
      expect.arrayContaining(["missing_source", "out_of_region", "technical_review_required"])
    );
    expect(result.reviewItems.map((item) => item.status)).toEqual(expect.arrayContaining(["blocked"]));
    expect(result.budget.skippedLinks.map((link) => link.message)).toEqual(
      expect.arrayContaining([
        "Preco sem fonte, codigo ou data-base nao entra no orcamento revisado.",
        "Fonte fora da UF selecionada permanece pendente.",
        "Fundacao, estrutura ou item tecnico exigem revisao tecnica antes do orcamento revisado.",
      ])
    );
  });
});

function createSinapiComposition(
  overrides: Partial<ServiceComposition> & { sinapi?: Partial<NonNullable<ServiceComposition["sinapi"]>> }
): ServiceComposition {
  const composition = createComposition(overrides);
  return {
    ...composition,
    sinapi: {
      sourceId: composition.sourceId,
      sourceTitle: "SINAPI BA 2026-05",
      code: composition.serviceCode,
      description: composition.description,
      state: composition.state,
      city: composition.city,
      referenceDate: composition.referenceDate,
      regime: "desonerado",
      priceStatus: "valid",
      confidence: composition.confidence,
      requiresReview: composition.requiresReview,
      pendingReason: "Sem pendencias automaticas.",
      totalLaborHoursPerUnit: composition.totalLaborHoursPerUnit,
      ...overrides.sinapi,
    },
  };
}

function createComposition(overrides: Partial<ServiceComposition>): ServiceComposition {
  return {
    ...sourceMeta,
    id: "sinapi-composition",
    constructionMethod: "conventional-masonry",
    category: "civil",
    serviceCode: sourceMeta.sourceCode,
    description: "Alvenaria de vedacao com bloco ceramico",
    unit: "m2",
    tags: ["alvenaria", "vedacao", "parede"],
    inputs: [materialInput],
    laborRoles: [laborRole],
    wasteRules: [],
    materialCostBRL: 62,
    laborCostBRL: 18,
    equipmentCostBRL: 0,
    thirdPartyCostBRL: 0,
    otherCostBRL: 0,
    directUnitCostBRL: 80,
    totalLaborHoursPerUnit: 0.45,
    ...overrides,
  };
}
