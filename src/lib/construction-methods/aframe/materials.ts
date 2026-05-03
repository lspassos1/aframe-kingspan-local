import { calculateMaterialList } from "@/lib/calculations/materials";
import type { MaterialLine } from "@/types/project";
import { createAFrameScenarioForCalculation, type AFrameMethodContext } from "./shared";

export function calculateAFrameMethodMaterialList({ project, scenario }: AFrameMethodContext): MaterialLine[] {
  return calculateMaterialList(project, createAFrameScenarioForCalculation(scenario));
}
