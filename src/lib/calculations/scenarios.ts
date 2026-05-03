import type { Project, Scenario } from "@/types/project";
import { calculateBudget } from "./budget";
import { calculateAFrameGeometry } from "./geometry";
import { calculateMaterialList, calculatePanelLayout } from "./materials";
import { estimateSteelStructure } from "./structure";

export interface ScenarioComparisonRow {
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  groundTotalArea: number;
  groundUsefulArea: number;
  mezzanineTotalArea: number;
  mezzanineUsefulArea: number;
  totalPanels: number;
  roofArea: number;
  facadeArea: number;
  steelKg: number;
  panelPackageCostBRL: number;
  steelCostBRL: number;
  totalCostBRL: number;
  fitsTerrain: boolean;
  costPerUsefulM2: number;
}

export function compareScenarios(project: Project): ScenarioComparisonRow[] {
  return project.scenarios.map((scenario) => scenarioComparisonRow(project, scenario));
}

export function scenarioComparisonRow(project: Project, scenario: Scenario): ScenarioComparisonRow {
  const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const layout = calculatePanelLayout(scenario, geometry, panel, project.materialAssumptions.sparePanelCount);
  const budget = calculateBudget(project, scenario);
  const structural = estimateSteelStructure(project, scenario);

  return {
    id: scenario.id,
    name: scenario.name,
    width: geometry.baseWidth,
    depth: geometry.effectiveHouseDepth,
    height: geometry.ridgeHeight,
    groundTotalArea: geometry.groundFloorTotalArea,
    groundUsefulArea: geometry.groundUsefulArea,
    mezzanineTotalArea: geometry.upperFloorTotalArea,
    mezzanineUsefulArea: geometry.upperFloorUsefulArea,
    totalPanels: layout.totalPanels,
    roofArea: geometry.roofInclinedArea,
    facadeArea: geometry.totalFacadeArea,
    steelKg: structural.totalSteelKg,
    panelPackageCostBRL: budget.panelPackageCostBRL,
    steelCostBRL: budget.steelStructureCostBRL,
    totalCostBRL: budget.totalEstimatedCostBRL,
    fitsTerrain: geometry.fitsTerrain,
    costPerUsefulM2: budget.costPerUsefulM2,
  };
}

export function duplicateScenario(source: Scenario): Scenario {
  return {
    ...source,
    id: `scenario-${Date.now()}`,
    name: `${source.name} - copia`,
    terrain: { ...source.terrain },
    location: { ...source.location },
    aFrame: { ...source.aFrame },
    methodInputs: {
      ...source.methodInputs,
      aframe: { ...(source.methodInputs.aframe ?? source.aFrame) },
    },
    pricing: { ...source.pricing },
  };
}

export function materialLinesForScenario(project: Project, scenario: Scenario) {
  return calculateMaterialList(project, scenario);
}
