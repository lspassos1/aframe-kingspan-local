import { describe, expect, it } from "vitest";
import { calculateDirectServiceBudget } from "@/lib/budget-assistant";
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
  notes: "Fonte tecnica com data-base controlada.",
};

const materialInput: CompositionInput = {
  ...sourceMeta,
  id: "input-block",
  kind: "material",
  description: "Bloco ceramico",
  quantity: 14,
  unit: "un",
  unitPrice: 2.5,
  total: 35,
};

const equipmentInput: CompositionInput = {
  ...sourceMeta,
  id: "input-equipment",
  kind: "equipment",
  description: "Equipamento leve",
  quantity: 1,
  unit: "un",
  unitPrice: 3,
  total: 3,
};

const laborRole: LaborRole = {
  ...sourceMeta,
  id: "labor-bricklayer",
  role: "Pedreiro",
  hourlyCostBRL: 32,
  hoursPerUnit: 0.45,
  totalHours: 0.45,
  total: 14.4,
};

const wasteRule: WasteRule = {
  ...sourceMeta,
  id: "waste-material",
  label: "Perda tecnica de materiais",
  appliesTo: ["material"],
  percent: 5,
};

const quantity: BudgetQuantity = {
  id: "quantity-wall-area",
  scenarioId: "scenario-a",
  constructionMethod: "conventional-masonry",
  category: "civil",
  description: "Area liquida de alvenaria",
  quantity: 120,
  unit: "m2",
  notes: "Quantitativo aprovado para orcamento direto.",
};

const composition: ServiceComposition = {
  ...sourceMeta,
  id: "composition-wall",
  constructionMethod: "conventional-masonry",
  category: "civil",
  serviceCode: sourceMeta.sourceCode,
  description: "Alvenaria de vedacao com bloco ceramico",
  unit: "m2",
  tags: ["alvenaria", "parede"],
  inputs: [materialInput, equipmentInput],
  laborRoles: [laborRole],
  wasteRules: [wasteRule],
  materialCostBRL: 35,
  laborCostBRL: 14.4,
  equipmentCostBRL: 3,
  thirdPartyCostBRL: 2,
  otherCostBRL: 1,
  directUnitCostBRL: 55.4,
  totalLaborHoursPerUnit: 0.45,
};

describe("direct service budget calculation", () => {
  it("separates direct costs, waste, BDI, contingency and labor hours", () => {
    const budget = calculateDirectServiceBudget({
      scenarioId: quantity.scenarioId,
      quantities: [quantity],
      serviceCompositions: [composition],
      links: [{ id: "link-wall", quantityId: quantity.id, compositionId: composition.id, approvedByUser: true }],
      bdiPercent: 20,
      contingencyPercent: 10,
      technicalProjectApproved: true,
    });

    expect(budget.lines).toHaveLength(1);
    expect(budget.lines[0]).toMatchObject({
      materialCostBRL: 4200,
      laborCostBRL: 1728,
      equipmentCostBRL: 360,
      thirdPartyCostBRL: 240,
      otherCostBRL: 120,
      wasteCostBRL: 210,
      directCostBRL: 6858,
      bdiBRL: 1371.6,
      contingencyBRL: 685.8,
      totalBRL: 8915.4,
      totalLaborHours: 54,
      approvedByUser: true,
    });
    expect(budget.directCostBRL).toBe(6858);
    expect(budget.bdiBRL + budget.contingencyBRL).toBeCloseTo(2057.4);
    expect(budget.totalBRL).toBe(8915.4);
  });

  it("skips unapproved links and incompatible units", () => {
    const incompatibleQuantity: BudgetQuantity = { ...quantity, id: "quantity-un", unit: "un" };
    const budget = calculateDirectServiceBudget({
      scenarioId: quantity.scenarioId,
      quantities: [quantity, incompatibleQuantity],
      serviceCompositions: [composition],
      links: [
        { id: "link-pending", quantityId: quantity.id, compositionId: composition.id, approvedByUser: false },
        { id: "link-unit", quantityId: incompatibleQuantity.id, compositionId: composition.id, approvedByUser: true },
      ],
    });

    expect(budget.lines).toHaveLength(0);
    expect(budget.skippedLinks.map((item) => item.reason)).toEqual(["not-approved", "unit-incompatible"]);
  });

  it("keeps structural service lines reviewable until technical project approval", () => {
    const structuralComposition: ServiceComposition = {
      ...composition,
      id: "composition-steel-structure",
      category: "steel",
      tags: ["estrutura-metalica"],
      requiresReview: false,
    };

    const budget = calculateDirectServiceBudget({
      scenarioId: quantity.scenarioId,
      quantities: [quantity],
      serviceCompositions: [structuralComposition],
      links: [{ id: "link-structure", quantityId: quantity.id, compositionId: structuralComposition.id, approvedByUser: true }],
    });

    expect(budget.lines[0].requiresReview).toBe(true);
    expect(budget.lines[0].notes).toContain("revisao tecnica");
  });
});
