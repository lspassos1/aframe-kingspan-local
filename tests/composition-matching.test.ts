import { describe, expect, it } from "vitest";
import {
  findServiceCompositionCandidates,
  scoreServiceCompositionCandidate,
  suggestBudgetCompositionMatches,
} from "@/lib/budget-assistant";
import type {
  BudgetQuantity,
  BudgetSourceMeta,
  CompositionInput,
  LaborRole,
  ServiceComposition,
  WasteRule,
} from "@/lib/budget-assistant";

const sourceMeta: BudgetSourceMeta = {
  sourceId: "source-sinapi-ba",
  sourceCode: "SINAPI-87489",
  referenceDate: "2026-05-04",
  city: "Cruz das Almas",
  state: "Bahia",
  confidence: "high",
  requiresReview: false,
  notes: "Fonte existente cadastrada pelo usuario.",
};

const quantity: BudgetQuantity = {
  id: "quantity-wall-area",
  scenarioId: "scenario-a",
  constructionMethod: "conventional-masonry",
  category: "civil",
  description: "Area liquida de alvenaria",
  quantity: 120,
  unit: "m2",
  notes: "Quantitativo calculado pelo metodo construtivo.",
};

const input: CompositionInput = {
  ...sourceMeta,
  id: "input-block",
  kind: "material",
  description: "Bloco ceramico",
  quantity: 14,
  unit: "un",
  unitPrice: 2.5,
  total: 35,
};

const labor: LaborRole = {
  ...sourceMeta,
  id: "labor-bricklayer",
  role: "Pedreiro",
  hourlyCostBRL: 32,
  hoursPerUnit: 0.45,
  totalHours: 0.45,
  total: 14.4,
};

const waste: WasteRule = {
  ...sourceMeta,
  id: "waste-block",
  label: "Perda de blocos",
  appliesTo: ["material"],
  percent: 5,
};

const cityComposition = createComposition({
  id: "composition-city-wall",
  description: "Alvenaria de vedacao com bloco ceramico",
  city: "Cruz das Almas",
  state: "BA",
  tags: ["alvenaria", "parede"],
});

const stateComposition = createComposition({
  id: "composition-state-wall",
  description: "Parede em bloco de concreto",
  city: "Salvador",
  state: "BA",
  tags: ["parede"],
});

describe("quantity to composition matching", () => {
  it("selects existing composition candidates by method, region, unit, category and text", () => {
    const candidates = findServiceCompositionCandidates({
      quantities: [quantity],
      serviceCompositions: [
        stateComposition,
        cityComposition,
        createComposition({
          id: "composition-other-method",
          constructionMethod: "eco-block",
          description: "Fiadas de bloco solo cimento",
        }),
      ],
      location: { city: "Cruz das Almas", state: "Bahia" },
      maxCandidatesPerQuantity: 10,
    });

    expect(candidates.map((candidate) => candidate.composition.id)).toEqual(["composition-city-wall", "composition-state-wall"]);
    expect(candidates[0].score.unitCompatible).toBe(true);
    expect(candidates[0].score.regionScore).toBe(0.2);
  });

  it("returns reviewable suggestions without approving or creating prices", () => {
    const matches = suggestBudgetCompositionMatches({
      quantities: [quantity],
      serviceCompositions: [cityComposition],
      location: { city: "Cruz das Almas", state: "Bahia" },
    });

    expect(matches).toEqual([
      expect.objectContaining({
        quantityId: quantity.id,
        compositionId: cityComposition.id,
        approvedByUser: false,
        requiresReview: true,
        unitCompatible: true,
        confidence: "medium",
      }),
    ]);
  });

  it("falls back to the default candidate limit when the configured limit is NaN", () => {
    const candidates = findServiceCompositionCandidates({
      quantities: [quantity],
      serviceCompositions: [cityComposition, stateComposition],
      maxCandidatesPerQuantity: Number.NaN,
    });

    expect(candidates.map((candidate) => candidate.composition.id)).toEqual(["composition-city-wall", "composition-state-wall"]);
  });

  it("marks incompatible units and weak candidates as low confidence", () => {
    const incompatibleComposition = createComposition({
      id: "composition-incompatible",
      unit: "un",
      description: "Alvenaria de vedacao com bloco ceramico",
      tags: ["alvenaria", "parede"],
      city: "Cruz das Almas",
      state: "Bahia",
    });

    const score = scoreServiceCompositionCandidate(quantity, incompatibleComposition);
    const matches = suggestBudgetCompositionMatches({
      quantities: [quantity],
      serviceCompositions: [incompatibleComposition],
      location: { city: "Cruz das Almas", state: "Bahia" },
    });

    expect(score.unitCompatible).toBe(false);
    expect(matches[0]).toMatchObject({
      unitCompatible: false,
      confidence: "low",
      requiresReview: true,
      approvedByUser: false,
    });
    expect(matches[0].reason).toContain("Unidade incompativel");
  });
});

function createComposition(overrides: Partial<ServiceComposition>): ServiceComposition {
  return {
    ...sourceMeta,
    id: "composition",
    constructionMethod: "conventional-masonry",
    category: "civil",
    serviceCode: sourceMeta.sourceCode,
    description: "Alvenaria",
    unit: "m2",
    tags: [],
    inputs: [input],
    laborRoles: [labor],
    wasteRules: [waste],
    materialCostBRL: 35,
    laborCostBRL: 14.4,
    equipmentCostBRL: 0,
    thirdPartyCostBRL: 0,
    otherCostBRL: 0,
    directUnitCostBRL: 49.4,
    totalLaborHoursPerUnit: 0.45,
    ...overrides,
  };
}
