import { describe, expect, it } from "vitest";
import {
  applySinapiAiCandidateRanking,
  findSinapiQuantityMatchCandidates,
  rankSinapiQuantityCandidatesWithOpenAi,
  suggestSinapiQuantityMatches,
} from "@/lib/sinapi";
import type {
  BudgetQuantity,
  BudgetSourceMeta,
  CompositionInput,
  LaborRole,
  ServiceComposition,
} from "@/lib/budget-assistant";

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

const quantity: BudgetQuantity = {
  id: "quantity-wall-area",
  scenarioId: "scenario-a",
  constructionMethod: "conventional-masonry",
  category: "civil",
  description: "Area liquida de alvenaria de vedacao",
  quantity: 120,
  unit: "m2",
  notes: "Quantitativo calculado pelo metodo construtivo.",
};

const input: CompositionInput = {
  ...sourceMeta,
  id: "input-block",
  kind: "material",
  description: "Bloco ceramico SINAPI",
  quantity: 1,
  unit: "m2",
  unitPrice: 62,
  total: 62,
};

const labor: LaborRole = {
  ...sourceMeta,
  id: "labor-wall",
  role: "Mao de obra SINAPI",
  hourlyCostBRL: 30,
  hoursPerUnit: 0.45,
  totalHours: 0.45,
  total: 18,
};

describe("SINAPI quantity matching", () => {
  it("orders deterministic candidates by method, unit, UF, reference, regime, tags and text", () => {
    const best = createSinapiComposition({
      id: "sinapi-wall-ba-current",
      description: "Alvenaria de vedacao com bloco ceramico",
      tags: ["alvenaria", "vedacao", "parede"],
    });
    const weaker = createSinapiComposition({
      id: "sinapi-wall-ba-old-regime",
      description: "Alvenaria em bloco de concreto",
      referenceDate: "2026-04",
      regime: "onerado",
      tags: ["alvenaria"],
    });
    const notSinapi = createComposition({ id: "manual-wall", description: "Alvenaria manual", sinapi: undefined });

    const candidates = findSinapiQuantityMatchCandidates({
      quantities: [quantity],
      serviceCompositions: [weaker, notSinapi, best],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
    });

    expect(candidates.map((candidate) => candidate.composition.id)).toEqual(["sinapi-wall-ba-current", "sinapi-wall-ba-old-regime"]);
    expect(candidates[0]).toMatchObject({
      confidence: "high",
      approvalBlockedReason: undefined,
      score: {
        methodCompatible: true,
        unitCompatible: true,
        stateCompatible: true,
        referenceCompatible: true,
        regimeCompatible: true,
        priceUsable: true,
      },
    });
  });

  it("creates reviewable SINAPI links without approving or creating prices", () => {
    const composition = createSinapiComposition({ id: "sinapi-wall-ba-current" });

    const matches = suggestSinapiQuantityMatches({
      quantities: [quantity],
      serviceCompositions: [composition],
      location: { city: "Cruz das Almas", state: "Bahia" },
      referenceDate: "2026-05",
      regime: "desonerado",
    });

    expect(matches).toEqual([
      expect.objectContaining({
        id: `sinapi-match-${quantity.id}-${composition.id}`,
        quantityId: quantity.id,
        compositionId: composition.id,
        approvedByUser: false,
        requiresReview: true,
        unitCompatible: true,
        approvalBlockedReason: undefined,
      }),
    ]);
  });

  it("keeps incompatible units, zeroed prices, out-of-region sources and uncertain methods pending", () => {
    const unitMismatch = createSinapiComposition({ id: "sinapi-unit-mismatch", unit: "m3" });
    const zeroed = createSinapiComposition({
      id: "sinapi-zeroed",
      directUnitCostBRL: 0,
      requiresReview: true,
      confidence: "unverified",
      sinapi: { priceStatus: "zeroed", requiresReview: true, pendingReason: "Preco zero." },
    });
    const outOfRegion = createSinapiComposition({
      id: "sinapi-out-of-region",
      state: "Sao Paulo",
      city: "Sao Paulo",
      requiresReview: true,
      sinapi: { state: "Sao Paulo", priceStatus: "out_of_region", requiresReview: true, pendingReason: "UF fora do projeto." },
    });
    const methodMismatch = createSinapiComposition({
      id: "sinapi-method-mismatch",
      constructionMethod: "eco-block",
      sinapi: { pendingReason: "Metodo importado diferente." },
    });

    const matches = suggestSinapiQuantityMatches({
      quantities: [quantity],
      serviceCompositions: [unitMismatch, zeroed, outOfRegion, methodMismatch],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
      maxCandidatesPerQuantity: 10,
    });

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ compositionId: "sinapi-unit-mismatch", approvalBlockedReason: "unit_incompatible", approvedByUser: false }),
        expect.objectContaining({ compositionId: "sinapi-zeroed", approvalBlockedReason: "price_status", approvedByUser: false }),
        expect.objectContaining({ compositionId: "sinapi-out-of-region", approvalBlockedReason: "out_of_region", approvedByUser: false }),
        expect.objectContaining({ compositionId: "sinapi-method-mismatch", approvalBlockedReason: "method_uncertain", approvedByUser: false }),
      ])
    );
  });

  it("does not mark locationless matches as out of region", () => {
    const composition = createSinapiComposition({ id: "sinapi-locationless" });

    const candidates = findSinapiQuantityMatchCandidates({
      quantities: [quantity],
      serviceCompositions: [composition],
      referenceDate: "2026-05",
      regime: "desonerado",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      approvalBlockedReason: undefined,
      score: {
        stateComparable: false,
        stateCompatible: false,
      },
    });
    expect(candidates[0].reason).toContain("UF do projeto ausente");
  });

  it("lets mocked AI reorder only existing candidate IDs and rejects invented IDs", () => {
    const first = createSinapiComposition({ id: "sinapi-first", description: "Alvenaria de vedacao" });
    const second = createSinapiComposition({ id: "sinapi-second", description: "Alvenaria com bloco ceramico aparente" });
    const candidates = findSinapiQuantityMatchCandidates({
      quantities: [quantity],
      serviceCompositions: [first, second],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
    });

    const reranked = applySinapiAiCandidateRanking(candidates, {
      candidates: [
        { id: "sinapi-invented", confidence: "high", reason: "ID criado pela IA.", pending: "Rejeitar." },
        { id: "sinapi-second", confidence: "high", reason: "Descricao mais aderente.", pending: "" },
      ],
    });

    expect(reranked.rejectedIds).toEqual(["sinapi-invented"]);
    expect(reranked.candidates.map((candidate) => candidate.composition.id)).toEqual(["sinapi-second", "sinapi-first"]);
    expect(reranked.candidates[0].reason).toContain("OpenAI: Descricao mais aderente.");
    expect(reranked.candidates[0].requiresReview).toBe(true);
  });

  it("uses unique candidate IDs when the same composition matches multiple quantities", () => {
    const shared = createSinapiComposition({ id: "sinapi-shared", description: "Alvenaria de vedacao" });
    const secondQuantity: BudgetQuantity = {
      ...quantity,
      id: "quantity-second-wall-area",
      description: "Area de parede em alvenaria ceramica",
    };
    const candidates = findSinapiQuantityMatchCandidates({
      quantities: [quantity, secondQuantity],
      serviceCompositions: [shared],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
    });
    const secondCandidate = candidates.find((candidate) => candidate.quantity.id === secondQuantity.id);

    expect(candidates.map((candidate) => candidate.candidateId)).toEqual([
      `${quantity.id}::sinapi-shared`,
      `${secondQuantity.id}::sinapi-shared`,
    ]);
    expect(secondCandidate).toBeDefined();

    const reranked = applySinapiAiCandidateRanking(candidates, {
      candidates: [
        { id: "sinapi-shared", confidence: "high", reason: "ID ambiguo.", pending: "Rejeitar." },
        { id: secondCandidate?.candidateId, confidence: "medium", reason: "Mais aderente.", pending: "Revisar." },
      ],
    });

    expect(reranked.rejectedIds).toEqual(["sinapi-shared"]);
    expect(reranked.candidates[0].candidateId).toBe(secondCandidate?.candidateId);
    expect(reranked.candidates).toHaveLength(2);
  });

  it("calls OpenAI with existing IDs and applies the validated JSON response", async () => {
    const candidates = findSinapiQuantityMatchCandidates({
      quantities: [quantity],
      serviceCompositions: [
        createSinapiComposition({ id: "sinapi-first", description: "Alvenaria de vedacao" }),
        createSinapiComposition({ id: "sinapi-second", description: "Alvenaria com bloco ceramico" }),
      ],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
    });
    const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { model: string; messages: Array<{ content: string }> };
      expect(init?.headers).toMatchObject({ Authorization: "Bearer openai-test-key" });
      expect(body.model).toBe("gpt-4o-mini");
      expect(body.messages[1].content).toContain(`${quantity.id}::sinapi-first`);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                candidates: [{ id: "sinapi-second", confidence: "medium", reason: "Melhor descricao.", pending: "Revisar vinculo." }],
              }),
            },
          },
        ],
      });
    };

    const result = await rankSinapiQuantityCandidatesWithOpenAi(candidates, {
      apiKey: "openai-test-key",
      model: "gpt-4o-mini",
      fetcher,
    });

    expect(result.rejectedIds).toEqual([]);
    expect(result.decisions).toEqual([expect.objectContaining({ id: "sinapi-second", confidence: "medium" })]);
    expect(result.candidates[0].composition.id).toBe("sinapi-second");
  });

  it("rejects invalid OpenAI JSON with a clear error", async () => {
    const candidates = findSinapiQuantityMatchCandidates({
      quantities: [quantity],
      serviceCompositions: [createSinapiComposition({ id: "sinapi-first", description: "Alvenaria de vedacao" })],
      location: { city: "Cruz das Almas", state: "BA" },
      referenceDate: "2026-05",
      regime: "desonerado",
    });
    const fetcher = async () =>
      Response.json({
        choices: [{ message: { content: "{invalid" } }],
      });

    await expect(
      rankSinapiQuantityCandidatesWithOpenAi(candidates, {
        apiKey: "openai-test-key",
        model: "gpt-4o-mini",
        fetcher,
      })
    ).rejects.toThrow("OpenAI retornou JSON invalido para ranking SINAPI.");
  });
});

function createSinapiComposition(overrides: Partial<ServiceComposition> & { sinapi?: Partial<NonNullable<ServiceComposition["sinapi"]>> }): ServiceComposition {
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
    serviceCode: "SINAPI-87489",
    description: "Alvenaria de vedacao com bloco ceramico",
    unit: "m2",
    tags: ["alvenaria", "vedacao", "parede"],
    inputs: [input],
    laborRoles: [labor],
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
