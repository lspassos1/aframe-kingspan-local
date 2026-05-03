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
