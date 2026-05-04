import type { BudgetSummary, MaterialLine, Project, QuotationRequest, Scenario } from "@/types/project";
import { calculateBudget } from "@/lib/calculations/budget";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { calculateMaterialList } from "@/lib/calculations/materials";
import { generateQuotationRequests } from "@/lib/calculations/quotation";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";

const br = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export interface ScenarioTechnicalSummary {
  methodId: string;
  methodName: string;
  status: "preliminary";
  metrics: Array<{ label: string; value: string }>;
  warnings: string[];
}

export function calculateScenarioGeometry(project: Project, scenario: Scenario) {
  const definition = getConstructionMethodDefinition(scenario.constructionMethod);
  return definition.calculateGeometry?.({ project, scenario }) ?? calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
}

export function calculateScenarioMaterials(project: Project, scenario: Scenario): MaterialLine[] {
  const definition = getConstructionMethodDefinition(scenario.constructionMethod);
  return definition.calculateMaterialList?.({ project, scenario }) ?? calculateMaterialList(project, scenario);
}

export function calculateScenarioBudget(project: Project, scenario: Scenario): BudgetSummary {
  const definition = getConstructionMethodDefinition(scenario.constructionMethod);
  return definition.calculateBudget?.({ project, scenario }) ?? calculateBudget(project, scenario);
}

export function generateScenarioQuotationRequests(project: Project, scenario: Scenario): QuotationRequest[] {
  if (scenario.constructionMethod === "aframe") {
    return generateQuotationRequests(project, scenario);
  }

  const definition = getConstructionMethodDefinition(scenario.constructionMethod);
  const materials = calculateScenarioMaterials(project, scenario);
  const budget = calculateScenarioBudget(project, scenario);
  const summary = generateScenarioTechnicalSummary(project, scenario);
  const address = [scenario.location.address, scenario.location.city, scenario.location.state, scenario.location.country].filter(Boolean).join(", ");
  const generatedAt = new Date().toISOString();
  const materialLines = materials.map((line) => `- ${line.quantity} ${line.unit} | ${line.code} | ${line.description}`).join("\n");
  const warningLines = summary.warnings.map((warning) => `- ${warning}`).join("\n");

  return [
    {
      id: `rfq-${definition.id}-materials`,
      title: `Pedido de cotacao - ${definition.name}`,
      supplierCategory: "Fornecedor / executor especializado",
      generatedAt,
      body: `Prezados,\n\nSolicito cotacao preliminar para ${definition.name}.\n\nProjeto: ${project.name}\nLocal: ${
        address || "a confirmar"
      }\nMetodo construtivo: ${definition.name}\nStatus: estimativa preliminar\nTotal preliminar atual: ${br.format(
        budget.totalEstimatedCostBRL
      )} BRL\n\nQuantitativos preliminares:\n${materialLines}\n\nAlertas tecnicos:\n${warningLines}\n\nFavor informar fonte do preco, data, unidade, validade, documentacao tecnica aplicavel, escopo incluso/excluido, prazo e condicoes de pagamento.\n\nObservacao: este pedido nao substitui projeto executivo, calculo estrutural, ART/RRT, aprovacao municipal, sondagem ou validacao tecnica do fornecedor.`,
    },
  ];
}

export function generateScenarioTechnicalSummary(project: Project, scenario: Scenario): ScenarioTechnicalSummary {
  const definition = getConstructionMethodDefinition(scenario.constructionMethod);
  const geometry = calculateScenarioGeometry(project, scenario) as Record<string, unknown>;
  const budget = calculateScenarioBudget(project, scenario);
  const warnings = definition.calculateWarnings?.({ project, scenario }) ?? budget.warnings;
  const metrics = metricRowsForGeometry(geometry);

  return {
    methodId: definition.id,
    methodName: definition.name,
    status: "preliminary",
    metrics,
    warnings: warnings.map((warning) => warning.message),
  };
}

function metricRowsForGeometry(geometry: Record<string, unknown>) {
  const candidates: Array<[string, unknown, string]> = [
    ["Area construida", geometry.builtAreaM2, "m2"],
    ["Area util combinada", geometry.combinedUsefulArea, "m2"],
    ["Area liquida", geometry.netMasonryAreaM2 ?? geometry.netWallAreaM2 ?? geometry.netPanelAreaM2, "m2"],
    ["Largura", geometry.widthM ?? geometry.baseWidth, "m"],
    ["Profundidade", geometry.depthM ?? geometry.effectiveHouseDepth, "m"],
    ["Altura", geometry.floorHeightM ?? geometry.ridgeHeight, "m"],
    ["Paineis/blocos", geometry.panelCount ?? geometry.totalBlocks, "un"],
  ];

  return candidates
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .map(([label, value, unit]) => ({ label, value: `${br.format(value as number)} ${unit}` }));
}
