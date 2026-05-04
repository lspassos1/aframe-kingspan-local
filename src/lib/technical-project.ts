import { generateAssemblyDrawings } from "@/lib/calculations/drawings";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { calculateScenarioMaterials, generateScenarioTechnicalSummary } from "@/lib/construction-methods/scenario-calculations";
import type { AssemblyDrawing, MaterialLine, Project, Scenario } from "@/types/project";

export interface TechnicalProjectDrawingViewModel {
  mode: "drawings";
  methodName: string;
  drawings: AssemblyDrawing[];
}

export interface TechnicalProjectSummaryViewModel {
  mode: "summary";
  methodName: string;
  status: "preliminary";
  metrics: Array<{ label: string; value: string }>;
  warnings: string[];
  materialLines: MaterialLine[];
}

export type TechnicalProjectViewModel = TechnicalProjectDrawingViewModel | TechnicalProjectSummaryViewModel;

export function getTechnicalProjectViewModel(project: Project, scenario: Scenario): TechnicalProjectViewModel {
  const methodDefinition = getConstructionMethodDefinition(scenario.constructionMethod);

  if (scenario.constructionMethod === "aframe") {
    return {
      mode: "drawings",
      methodName: methodDefinition.name,
      drawings: generateAssemblyDrawings(project, scenario),
    };
  }

  const summary = generateScenarioTechnicalSummary(project, scenario);

  return {
    mode: "summary",
    methodName: summary.methodName,
    status: summary.status,
    metrics: summary.metrics,
    warnings: summary.warnings,
    materialLines: calculateScenarioMaterials(project, scenario),
  };
}
