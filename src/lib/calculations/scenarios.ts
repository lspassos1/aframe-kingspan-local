import type { Project, Scenario } from "@/types/project";
import { calculateBudget } from "./budget";
import { calculateAFrameGeometry } from "./geometry";
import { calculatePanelLayout } from "./materials";
import { estimateSteelStructure } from "./structure";
import { calculateScenarioBudget, calculateScenarioGeometry, calculateScenarioMaterials } from "@/lib/construction-methods/scenario-calculations";

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
  if (scenario.constructionMethod !== "aframe") {
    const geometry = calculateScenarioGeometry(project, scenario) as Record<string, unknown>;
    const budget = calculateScenarioBudget(project, scenario);
    const materials = calculateScenarioMaterials(project, scenario);
    const width = numberMetric(geometry.widthM ?? geometry.baseWidth);
    const depth = numberMetric(geometry.depthM ?? geometry.effectiveHouseDepth);
    const height = numberMetric(geometry.floorHeightM ?? geometry.ridgeHeight);
    const builtArea = numberMetric(geometry.builtAreaM2 ?? geometry.netWallAreaM2 ?? geometry.netPanelAreaM2);
    const unitCount = numberMetric(geometry.totalBlocks ?? geometry.panelCount);

    return {
      id: scenario.id,
      name: scenario.name,
      width,
      depth,
      height,
      groundTotalArea: builtArea,
      groundUsefulArea: builtArea,
      mezzanineTotalArea: 0,
      mezzanineUsefulArea: 0,
      totalPanels: unitCount || materials.length,
      roofArea: 0,
      facadeArea: numberMetric(geometry.grossWallAreaM2 ?? geometry.grossPanelAreaM2),
      steelKg: numberMetric(geometry.verticalSteelKg ?? 0) + numberMetric(geometry.horizontalSteelKg ?? 0),
      panelPackageCostBRL: budget.panelPackageCostBRL,
      steelCostBRL: budget.steelStructureCostBRL,
      totalCostBRL: budget.totalEstimatedCostBRL,
      fitsTerrain: true,
      costPerUsefulM2: budget.costPerUsefulM2,
    };
  }

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
  return calculateScenarioMaterials(project, scenario);
}

function numberMetric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
