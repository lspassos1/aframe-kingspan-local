import { calculateBudget } from "@/lib/calculations/budget";
import type { BudgetItem, BudgetSummary } from "@/types/project";
import { createAFrameScenarioForCalculation, type AFrameMethodContext } from "./shared";

export function calculateAFrameMethodBudget({ project, scenario }: AFrameMethodContext): BudgetSummary {
  return calculateBudget(project, createAFrameScenarioForCalculation(scenario));
}

export function calculateAFrameMethodBudgetItems(context: AFrameMethodContext): BudgetItem[] {
  return calculateAFrameMethodBudget(context).items;
}
