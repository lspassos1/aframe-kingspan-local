import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { createBudgetSourceExport, createBudgetSourceWorkbookRows } from "@/lib/budget-assistant";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { normalizeProject } from "@/lib/store/project-normalization";
import type {
  BudgetQuantity,
  BudgetServiceLine,
  BudgetSourceMeta,
  CompositionInput,
  LaborRole,
  PriceSource,
  ServiceComposition,
} from "@/lib/budget-assistant";
import type { Project, Scenario } from "@/types/project";

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

const priceSource: PriceSource = {
  id: sourceMeta.sourceId,
  type: "sinapi",
  title: "SINAPI BA maio 2026",
  supplier: "CAIXA/IBGE",
  state: sourceMeta.state,
  city: sourceMeta.city,
  referenceDate: sourceMeta.referenceDate,
  reliability: "high",
  notes: "Fonte importada e revisada.",
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

const laborRole: LaborRole = {
  ...sourceMeta,
  id: "labor-bricklayer",
  role: "Pedreiro",
  hourlyCostBRL: 32,
  hoursPerUnit: 0.45,
  totalHours: 0.45,
  total: 14.4,
};

const serviceComposition: ServiceComposition = {
  ...sourceMeta,
  id: "composition-wall",
  constructionMethod: "conventional-masonry",
  category: "civil",
  serviceCode: sourceMeta.sourceCode,
  description: "Alvenaria de vedacao com bloco ceramico",
  unit: "m2",
  tags: ["alvenaria", "parede"],
  inputs: [materialInput],
  laborRoles: [laborRole],
  wasteRules: [],
  materialCostBRL: 35,
  laborCostBRL: 14.4,
  equipmentCostBRL: 3,
  thirdPartyCostBRL: 2,
  otherCostBRL: 1,
  directUnitCostBRL: 55.4,
  totalLaborHoursPerUnit: 0.45,
  sinapi: {
    sourceId: sourceMeta.sourceId,
    sourceTitle: priceSource.title,
    code: sourceMeta.sourceCode,
    description: "Alvenaria de vedacao com bloco ceramico SINAPI",
    state: sourceMeta.state,
    city: sourceMeta.city,
    referenceDate: sourceMeta.referenceDate,
    regime: "desonerado",
    priceStatus: "valid",
    confidence: "high",
    requiresReview: false,
    pendingReason: "",
    totalLaborHoursPerUnit: 0.45,
  },
};

const budgetQuantity: BudgetQuantity = {
  id: "quantity-wall-area",
  scenarioId: "scenario-export",
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
};

describe("budget source export report", () => {
  it("exports source, date, confidence and separated cost fields", () => {
    const { project, scenario } = createProjectWithBudget();
    const report = createBudgetSourceExport(project, scenario, "2026-05-04T21:00:00.000Z");

    expect(report.finalBudget).toBe(false);
    expect(report.budgetStatusLabel).toBe("Orcamento preliminar");
    expect(report.technicalNotice).toContain("Nao substitui projeto estrutural");
    expect(report.sources[0]).toMatchObject({
      id: priceSource.id,
      title: priceSource.title,
      referenceDate: "2026-05-04",
      city: "Cruz das Almas",
      state: "Bahia",
      reliability: "high",
    });
    expect(report.serviceLines[0]).toMatchObject({
      sourceTitle: priceSource.title,
      sourceCode: sourceMeta.sourceCode,
      referenceDate: "2026-05-04",
      confidence: "high",
      materialCostBRL: 4200,
      laborCostBRL: 1728,
      equipmentCostBRL: 360,
      bdiBRL: 1371.6,
      contingencyBRL: 685.8,
      totalBRL: 8915.4,
      totalLaborHours: 54,
      unitPriceBRL: 55.4,
      sinapiCode: sourceMeta.sourceCode,
      sinapiDescription: "Alvenaria de vedacao com bloco ceramico SINAPI",
      regime: "desonerado",
      priceStatus: "valid",
      priceStatusLabel: "preco valido",
      reviewStatus: "revisado",
      humanReviewRequired: false,
      outOfRegion: false,
      structuralCritical: false,
    });
    expect(report.totals).toMatchObject({
      materialCostBRL: 4200,
      laborCostBRL: 1728,
      equipmentCostBRL: 360,
      bdiBRL: 1371.6,
      contingencyBRL: 685.8,
      totalBRL: 8915.4,
      totalLaborHours: 54,
    });
    expect(report.laborHoursByRole[0]).toMatchObject({
      role: "Pedreiro",
      sourceTitle: priceSource.title,
      referenceDate: "2026-05-04",
      confidence: "high",
      totalHours: 54,
      totalBRL: 1728,
    });
  });

  it("flags out-of-region and structural compositions", () => {
    const { project, scenario } = createProjectWithBudget({
      source: {
        ...priceSource,
        id: "source-sp",
        state: "Sao Paulo",
        city: "Sao Paulo",
      },
      composition: {
        ...serviceComposition,
        sourceId: "source-sp",
        state: "Sao Paulo",
        city: "Sao Paulo",
        category: "steel",
        tags: ["estrutura", "fundacao"],
      },
      line: {
        ...serviceLine,
        sourceId: "source-sp",
        state: "Sao Paulo",
        city: "Sao Paulo",
        category: "steel",
        requiresReview: true,
      },
    });

    const report = createBudgetSourceExport(project, scenario, "2026-05-04T21:00:00.000Z");

    expect(report.budgetStatusLabel).toBe("Orcamento preliminar");
    expect(report.serviceCompositions[0]).toMatchObject({ outOfRegion: true, structuralCritical: true });
    expect(report.serviceLines[0]).toMatchObject({ outOfRegion: true, structuralCritical: true, requiresReview: true });
    expect(report.totals).toMatchObject({
      outOfRegionCompositionCount: 1,
      structuralCriticalCount: 1,
    });
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("nao representa orcamento final"),
        expect.stringContaining("fora da cidade/UF"),
        expect.stringContaining("itens estruturais criticos"),
      ])
    );
  });

  it("creates workbook rows with required source fields", () => {
    const { project, scenario } = createProjectWithBudget();
    const report = createBudgetSourceExport(project, scenario, "2026-05-04T21:00:00.000Z");
    const rows = createBudgetSourceWorkbookRows(report);

    expect(rows.summary[0]).toMatchObject({
      Metodo: "Alvenaria convencional",
      Status: "Orcamento preliminar",
      "Orcamento final": "nao",
      "Custo material": 4200,
      "Custo mao de obra": 1728,
      BDI: 1371.6,
      Contingencia: 685.8,
      "H/H total": 54,
      "Precos SINAPI pendentes": 0,
    });
    expect(rows.serviceLines[0]).toMatchObject({
      Fonte: priceSource.title,
      Codigo: sourceMeta.sourceCode,
      "Data-base": "2026-05-04",
      Cidade: "Cruz das Almas",
      UF: "Bahia",
      Regime: "desonerado",
      "Status do preco": "valid",
      Revisao: "revisado",
      "Preco unitario": 55.4,
      Confianca: "high",
      "Fora da regiao": "nao",
      "Critico estrutural": "nao",
    });
    expect(rows.laborHours[0]).toMatchObject({
      Funcao: "Pedreiro",
      Fonte: priceSource.title,
      "Data-base": "2026-05-04",
      Confianca: "high",
      "H/H total": 54,
    });
  });

  it("marks zeroed SINAPI prices as pending instead of reviewed", () => {
    const zeroedComposition: ServiceComposition = {
      ...serviceComposition,
      directUnitCostBRL: 0,
      materialCostBRL: 0,
      laborCostBRL: 0,
      equipmentCostBRL: 0,
      thirdPartyCostBRL: 0,
      otherCostBRL: 0,
      requiresReview: false,
      sinapi: {
        ...serviceComposition.sinapi,
        priceStatus: "zeroed",
        requiresReview: true,
        pendingReason: "Preco oficial veio zerado.",
      },
    };
    const zeroedLine: BudgetServiceLine = {
      ...serviceLine,
      materialCostBRL: 0,
      laborCostBRL: 0,
      equipmentCostBRL: 0,
      thirdPartyCostBRL: 0,
      otherCostBRL: 0,
      directCostBRL: 0,
      bdiBRL: 0,
      contingencyBRL: 0,
      totalBRL: 0,
      totalLaborHours: 0,
      requiresReview: false,
    };
    const { project, scenario } = createProjectWithBudget({ composition: zeroedComposition, line: zeroedLine });

    const report = createBudgetSourceExport(project, scenario, "2026-05-04T21:00:00.000Z");
    const rows = createBudgetSourceWorkbookRows(report);

    expect(report.serviceLines[0]).toMatchObject({
      priceStatus: "zeroed",
      priceStatusLabel: "preco zerado",
      reviewStatus: "pendente",
      humanReviewRequired: true,
      requiresReview: true,
      unitPriceBRL: 0,
      totalBRL: 0,
    });
    expect(report.totals).toMatchObject({ pendingSinapiPriceCount: 1, reviewableLineCount: 1 });
    expect(report.warnings).toEqual(expect.arrayContaining([expect.stringContaining("precos SINAPI estao pendentes")]));
    expect(rows.serviceLines[0]).toMatchObject({
      "Status do preco": "zeroed",
      "Status do preco label": "preco zerado",
      Revisao: "pendente",
      "Preco unitario": 0,
    });
  });

  it("keeps composition-only reports preliminary when SINAPI prices are pending", () => {
    const zeroedComposition: ServiceComposition = {
      ...serviceComposition,
      directUnitCostBRL: 0,
      materialCostBRL: 0,
      laborCostBRL: 0,
      equipmentCostBRL: 0,
      thirdPartyCostBRL: 0,
      otherCostBRL: 0,
      requiresReview: false,
      sinapi: {
        ...serviceComposition.sinapi,
        priceStatus: "zeroed",
        requiresReview: true,
        pendingReason: "Preco oficial veio zerado.",
      },
    };
    const { project, scenario } = createProjectWithBudget({ composition: zeroedComposition });
    const compositionOnlyProject: Project = {
      ...project,
      budgetAssistant: {
        ...project.budgetAssistant,
        budgetServiceLines: [],
      },
    };

    const report = createBudgetSourceExport(compositionOnlyProject, scenario, "2026-05-04T21:00:00.000Z");

    expect(report.serviceLines).toEqual([]);
    expect(report.serviceCompositions[0]).toMatchObject({
      priceStatus: "zeroed",
      reviewStatus: "pendente",
      humanReviewRequired: true,
      requiresReview: true,
    });
    expect(report.totals).toMatchObject({ pendingSinapiPriceCount: 1, reviewableLineCount: 0 });
    expect(report.budgetStatusLabel).toBe("Orcamento preliminar");
    expect(report.finalBudget).toBe(false);
  });

  it("counts pending SINAPI composition rows even when reviewed service lines exist", () => {
    const pendingComposition: ServiceComposition = {
      ...serviceComposition,
      id: "composition-pending-only",
      serviceCode: "SINAPI-PENDING",
      sourceCode: "SINAPI-PENDING",
      directUnitCostBRL: 0,
      materialCostBRL: 0,
      laborCostBRL: 0,
      equipmentCostBRL: 0,
      thirdPartyCostBRL: 0,
      otherCostBRL: 0,
      requiresReview: false,
      sinapi: {
        ...serviceComposition.sinapi,
        code: "SINAPI-PENDING",
        priceStatus: "missing",
        requiresReview: true,
        pendingReason: "Preco oficial ausente.",
      },
    };
    const { project, scenario } = createProjectWithBudget({ extraCompositions: [pendingComposition] });

    const report = createBudgetSourceExport(project, scenario, "2026-05-04T21:00:00.000Z");

    expect(report.serviceLines).toHaveLength(1);
    expect(report.serviceCompositions).toHaveLength(2);
    expect(report.totals).toMatchObject({ pendingSinapiPriceCount: 1 });
    expect(report.warnings).toEqual(expect.arrayContaining([expect.stringContaining("precos SINAPI estao pendentes")]));
  });

  it("preserves pending SINAPI status when deduplicating line and composition rows", () => {
    const pendingSameCodeComposition: ServiceComposition = {
      ...serviceComposition,
      id: "composition-pending-same-code",
      requiresReview: false,
      sinapi: {
        ...serviceComposition.sinapi,
        priceStatus: "missing",
        requiresReview: true,
        pendingReason: "Preco oficial ausente.",
      },
    };
    const { project, scenario } = createProjectWithBudget({ extraCompositions: [pendingSameCodeComposition] });

    const report = createBudgetSourceExport(project, scenario, "2026-05-04T21:00:00.000Z");

    expect(report.totals).toMatchObject({ pendingSinapiPriceCount: 1 });
    expect(report.budgetStatusLabel).toBe("Orcamento preliminar");
  });

  it("does not count manual review lines as pending SINAPI prices", () => {
    const manualSource: PriceSource = {
      ...priceSource,
      id: "source-manual",
      type: "manual",
      title: "Cotacao manual",
      supplier: "Fornecedor local",
    };
    const manualComposition: ServiceComposition = {
      ...serviceComposition,
      id: "composition-manual",
      sourceId: manualSource.id,
      sourceCode: "MANUAL-001",
      serviceCode: "MANUAL-001",
      sinapi: undefined,
      requiresReview: true,
    };
    const manualLine: BudgetServiceLine = {
      ...serviceLine,
      id: "service-line-manual",
      compositionId: manualComposition.id,
      sourceId: manualSource.id,
      sourceCode: "MANUAL-001",
      sourceTitle: manualSource.title,
      requiresReview: true,
    };
    const { project, scenario } = createProjectWithBudget({
      source: manualSource,
      composition: manualComposition,
      line: manualLine,
    });

    const report = createBudgetSourceExport(project, scenario, "2026-05-04T21:00:00.000Z");

    expect(report.serviceLines[0]).toMatchObject({
      sourceTitle: manualSource.title,
      sinapiCode: "MANUAL-001",
      priceStatus: "valid",
      reviewStatus: "pendente",
      humanReviewRequired: true,
      requiresReview: true,
    });
    expect(report.totals).toMatchObject({ pendingSinapiPriceCount: 0, reviewableLineCount: 1 });
    expect(report.warnings).not.toEqual(expect.arrayContaining([expect.stringContaining("precos SINAPI estao pendentes")]));
  });
});

function createProjectWithBudget(overrides?: {
  source?: PriceSource;
  composition?: ServiceComposition;
  extraCompositions?: ServiceComposition[];
  line?: BudgetServiceLine;
}): { project: Project; scenario: Scenario } {
  const methodDefinition = getConstructionMethodDefinition("conventional-masonry");
  const scenario: Scenario = {
    ...defaultProject.scenarios[0],
    id: "scenario-export",
    name: "Alvenaria",
    constructionMethod: "conventional-masonry",
    methodInputs: {
      ...defaultProject.scenarios[0].methodInputs,
      "conventional-masonry": methodDefinition.getDefaultInputs(),
    },
    location: {
      ...defaultProject.scenarios[0].location,
      city: "Cruz das Almas",
      state: "Bahia",
    },
  };
  const source = overrides?.source ?? priceSource;
  const composition = overrides?.composition ?? serviceComposition;
  const line = overrides?.line ?? serviceLine;
  const extraCompositions = overrides?.extraCompositions ?? [];

  const project = normalizeProject({
    ...defaultProject,
    selectedScenarioId: scenario.id,
    scenarios: [scenario],
    budgetAssistant: {
      ...defaultProject.budgetAssistant,
      costSources: [source],
      priceSources: [source],
      serviceCompositions: [composition, ...extraCompositions],
      budgetQuantities: [budgetQuantity],
      budgetServiceLines: [line],
    },
  });

  return { project, scenario: project.scenarios[0] };
}
