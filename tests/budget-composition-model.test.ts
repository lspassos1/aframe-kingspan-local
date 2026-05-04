import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { normalizeProject } from "@/lib/store/project-normalization";
import type {
  BudgetQuantity,
  BudgetServiceLine,
  BudgetSourceMeta,
  CompositionInput,
  LaborRole,
  PriceSource,
  ServiceComposition,
  WasteRule,
} from "@/lib/budget-assistant";
import type { Project } from "@/types/project";

const sourceMeta: BudgetSourceMeta = {
  sourceId: "price-source-ba-2026-05",
  sourceCode: "SINAPI-12345",
  referenceDate: "2026-05-04",
  city: "Cruz das Almas",
  state: "Bahia",
  confidence: "high",
  requiresReview: false,
  notes: "Composicao de teste com fonte e data-base explicitas.",
};

const priceSource: PriceSource = {
  id: sourceMeta.sourceId,
  type: "sinapi",
  title: "SINAPI BA maio 2026",
  supplier: "CAIXA/IBGE",
  state: sourceMeta.state,
  city: sourceMeta.city,
  referenceDate: sourceMeta.referenceDate,
  reliability: "high",
  notes: "Base importada e revisada.",
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
  wasteRuleId: "waste-block",
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
  id: "waste-block",
  label: "Perda tecnica de blocos",
  appliesTo: ["material"],
  percent: 5,
};

const serviceComposition: ServiceComposition = {
  ...sourceMeta,
  id: "composition-masonry-wall",
  constructionMethod: "conventional-masonry",
  category: "civil",
  serviceCode: sourceMeta.sourceCode,
  description: "Alvenaria de vedacao com bloco ceramico",
  unit: "m2",
  tags: ["alvenaria", "parede"],
  inputs: [materialInput],
  laborRoles: [laborRole],
  wasteRules: [wasteRule],
  materialCostBRL: 35,
  laborCostBRL: 14.4,
  equipmentCostBRL: 0,
  thirdPartyCostBRL: 0,
  otherCostBRL: 0,
  directUnitCostBRL: 49.4,
  totalLaborHoursPerUnit: 0.45,
};

const budgetQuantity: BudgetQuantity = {
  id: "quantity-wall-area",
  scenarioId: defaultProject.scenarios[0].id,
  constructionMethod: "conventional-masonry",
  category: "civil",
  description: "Area liquida de alvenaria",
  quantity: 120,
  unit: "m2",
  notes: "Quantidade preliminar do metodo construtivo.",
};

const serviceLine: BudgetServiceLine = {
  ...sourceMeta,
  id: "service-line-wall",
  scenarioId: budgetQuantity.scenarioId,
  quantityId: budgetQuantity.id,
  compositionId: serviceComposition.id,
  constructionMethod: "conventional-masonry",
  category: "civil",
  description: serviceComposition.description,
  quantity: budgetQuantity.quantity,
  unit: budgetQuantity.unit,
  materialCostBRL: 4200,
  laborCostBRL: 1728,
  equipmentCostBRL: 0,
  thirdPartyCostBRL: 0,
  otherCostBRL: 0,
  wasteCostBRL: 210,
  directCostBRL: 5928,
  bdiBRL: 1185.6,
  contingencyBRL: 592.8,
  totalBRL: 7706.4,
  totalLaborHours: 54,
  approvedByUser: true,
};

describe("budget composition model", () => {
  it("normalizes legacy budget assistant data with empty technical model collections", () => {
    const legacyProject = {
      ...defaultProject,
      budgetAssistant: {
        costSources: [],
        costItems: [],
        matches: [],
      },
    } as unknown as Project;

    const normalized = normalizeProject(legacyProject);

    expect(normalized.budgetAssistant.priceSources).toEqual([]);
    expect(normalized.budgetAssistant.serviceCompositions).toEqual([]);
    expect(normalized.budgetAssistant.budgetQuantities).toEqual([]);
    expect(normalized.budgetAssistant.budgetServiceLines).toEqual([]);
  });

  it("serializes compositions, quantities and service lines without losing source metadata", () => {
    const project = normalizeProject({
      ...defaultProject,
      budgetAssistant: {
        ...defaultProject.budgetAssistant,
        priceSources: [priceSource],
        serviceCompositions: [serviceComposition],
        budgetQuantities: [budgetQuantity],
        budgetServiceLines: [serviceLine],
      },
    });
    const parsed = JSON.parse(JSON.stringify(project)) as Project;

    expect(parsed.budgetAssistant.priceSources[0]).toMatchObject({
      id: sourceMeta.sourceId,
      referenceDate: sourceMeta.referenceDate,
      city: sourceMeta.city,
      state: sourceMeta.state,
      reliability: "high",
    });
    expect(parsed.budgetAssistant.serviceCompositions[0]).toMatchObject({
      sourceId: sourceMeta.sourceId,
      referenceDate: sourceMeta.referenceDate,
      city: sourceMeta.city,
      state: sourceMeta.state,
      confidence: "high",
      inputs: [expect.objectContaining({ kind: "material", sourceId: sourceMeta.sourceId })],
      laborRoles: [expect.objectContaining({ role: "Pedreiro", totalHours: 0.45 })],
      wasteRules: [expect.objectContaining({ percent: 5, sourceId: sourceMeta.sourceId })],
    });
    expect(parsed.budgetAssistant.budgetServiceLines[0]).toMatchObject({
      directCostBRL: 5928,
      bdiBRL: 1185.6,
      contingencyBRL: 592.8,
      totalBRL: 7706.4,
      approvedByUser: true,
    });
  });
});
