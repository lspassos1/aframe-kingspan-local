import type { AppWarning, BudgetItem, BudgetSummary, MaterialLine, Project, Scenario } from "@/types/project";

export type ConstructionMethodId = "aframe" | "conventional-masonry" | "eco-block" | "monolithic-eps";

export type ConstructionMethodComplexity = "low" | "medium" | "high";

export type ConstructionMethodSpeed = "slow" | "medium" | "fast";

export type ConstructionMethodIndustrializationLevel = "low" | "medium" | "high";

export type ConstructionMethodInputs = object;

export interface ConstructionMethodWarning {
  id: string;
  level: "info" | "warning" | "error";
  message: string;
}

export interface ConstructionMethodValidationIssue {
  path: string;
  message: string;
}

export interface ConstructionMethodValidationResult {
  valid: boolean;
  issues: ConstructionMethodValidationIssue[];
}

export interface ConstructionMethodCalculationContext {
  project: Project;
  scenario: Scenario;
}

export type Construction3DLayerType =
  | "terrain"
  | "foundation"
  | "floor"
  | "structure"
  | "walls"
  | "roof"
  | "openings"
  | "services"
  | "finishes"
  | "dimensions"
  | "warnings"
  | "assembly-step";

export type Construction3DVector3 = [number, number, number];

export interface Construction3DBoxPrimitive {
  id: string;
  kind: "box";
  label?: string;
  position: Construction3DVector3;
  size: Construction3DVector3;
  color: string;
  opacity?: number;
  wireframe?: boolean;
}

export type Construction3DPrimitive = Construction3DBoxPrimitive;

export interface Construction3DLayerData {
  primitives: Construction3DPrimitive[];
  notes?: string[];
  openingTotals?: {
    doorCount: number;
    windowCount: number;
  };
}

export interface Construction3DLayer {
  id: string;
  type: Construction3DLayerType;
  label: string;
  visibleByDefault: boolean;
  methodId: ConstructionMethodId;
  data: Construction3DLayerData;
}

export interface ConstructionMethodDefinition<TInputs extends ConstructionMethodInputs = ConstructionMethodInputs> {
  id: ConstructionMethodId;
  name: string;
  shortDescription: string;
  bestFor: string;
  benefits: string[];
  limitations: string[];
  defaultWarnings: ConstructionMethodWarning[];
  complexity: ConstructionMethodComplexity;
  speed: ConstructionMethodSpeed;
  industrializationLevel: ConstructionMethodIndustrializationLevel;
  getDefaultInputs: () => TInputs;
  validateInputs: (inputs: unknown) => ConstructionMethodValidationResult;
  calculateGeometry?: (context: ConstructionMethodCalculationContext) => unknown;
  calculateMaterialList?: (context: ConstructionMethodCalculationContext) => MaterialLine[];
  calculateBudgetItems?: (context: ConstructionMethodCalculationContext) => BudgetItem[];
  calculateBudget?: (context: ConstructionMethodCalculationContext) => BudgetSummary;
  calculateWarnings?: (context: ConstructionMethodCalculationContext) => AppWarning[];
  generate3DLayers?: (context: ConstructionMethodCalculationContext) => Construction3DLayer[];
}

export function validResult(): ConstructionMethodValidationResult {
  return { valid: true, issues: [] };
}

export function validationResult(issues: ConstructionMethodValidationIssue[]): ConstructionMethodValidationResult {
  return { valid: issues.length === 0, issues };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function positiveNumberIssue(inputs: Record<string, unknown>, path: string, message: string): ConstructionMethodValidationIssue | null {
  return typeof inputs[path] === "number" && inputs[path] > 0 ? null : { path, message };
}

export function compactValidationIssues(
  issues: Array<ConstructionMethodValidationIssue | null>
): ConstructionMethodValidationIssue[] {
  return issues.filter((issue): issue is ConstructionMethodValidationIssue => issue !== null);
}
