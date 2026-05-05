import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";
import { getConstructionMethodDefinition, type ConstructionMethodId, type ConstructionMethodInputs } from "@/lib/construction-methods";
import type { AFrameInputs, Project, Scenario } from "@/types/project";
import { normalizeBrazilStateName } from "@/lib/locations/brazil";

export type PlanExtractSelectedFields = Partial<Record<keyof PlanExtractResult["extracted"], boolean>>;

const nonAFrameMethodIds: ConstructionMethodId[] = ["conventional-masonry", "eco-block", "monolithic-eps"];
const commonApplicableFields = new Set<keyof PlanExtractResult["extracted"]>([
  "projectName",
  "address",
  "city",
  "state",
  "country",
  "constructionMethod",
  "terrainWidthM",
  "terrainDepthM",
]);
const aFrameApplicableFields = new Set<keyof PlanExtractResult["extracted"]>(["houseDepthM"]);
const rectangularMethodApplicableFields = new Set<keyof PlanExtractResult["extracted"]>([
  "houseWidthM",
  "houseDepthM",
  "floorHeightM",
  "floors",
  "doorCount",
  "windowCount",
]);
const numericFieldConstraints: Partial<Record<keyof PlanExtractResult["extracted"], { min: number; integer?: boolean }>> = {
  terrainWidthM: { min: 0.01 },
  terrainDepthM: { min: 0.01 },
  houseWidthM: { min: 0.01 },
  houseDepthM: { min: 0.01 },
  builtAreaM2: { min: 0.01 },
  floorHeightM: { min: 0.01 },
  floors: { min: 1, integer: true },
  doorCount: { min: 0, integer: true },
  windowCount: { min: 0, integer: true },
};

function fieldSelected(selectedFields: PlanExtractSelectedFields, field: keyof PlanExtractResult["extracted"]) {
  return Boolean(selectedFields[field]);
}

export function getDefaultPlanExtractSelectedFields(result: PlanExtractResult, currentMethod?: ConstructionMethodId): PlanExtractSelectedFields {
  const constructionMethodSelected = (result.fieldConfidence.constructionMethod ?? result.confidence) !== "low";
  const extractedMethod = constructionMethodSelected ? getCompatibleExtractedMethod(result.extracted.constructionMethod) : undefined;
  const effectiveMethod = extractedMethod ?? currentMethod;

  return getPlanExtractApplicableFields(result, effectiveMethod).reduce<PlanExtractSelectedFields>((selected, field) => {
    selected[field] = (result.fieldConfidence[field] ?? result.confidence) !== "low";
    return selected;
  }, {});
}

export function getPlanExtractNumberFieldMin(field: keyof PlanExtractResult["extracted"]) {
  return numericFieldConstraints[field]?.min;
}

export function normalizePlanExtractNumberField(field: keyof PlanExtractResult["extracted"], value: number | undefined) {
  const constraint = numericFieldConstraints[field];
  if (!constraint || typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const normalized = constraint.integer ? Math.round(value) : value;
  return normalized >= constraint.min ? normalized : undefined;
}

function withNumberField<T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  field: keyof PlanExtractResult["extracted"],
  value: number | undefined,
  selected: boolean
) {
  const normalizedValue = normalizePlanExtractNumberField(field, value);
  if (selected && normalizedValue !== undefined) target[key] = normalizedValue as T[keyof T];
}

function applyMethodInputs(scenario: Scenario, result: PlanExtractResult, selectedFields: PlanExtractSelectedFields, constructionMethod: ConstructionMethodId) {
  if (constructionMethod === "aframe") {
    const aFrame: AFrameInputs = { ...scenario.aFrame };
    const houseDepth = normalizePlanExtractNumberField("houseDepthM", result.extracted.houseDepthM);
    if (fieldSelected(selectedFields, "houseDepthM") && houseDepth !== undefined) {
      aFrame.houseDepth = houseDepth;
      aFrame.automaticDepth = false;
    }
    return {
      methodInputs: { ...scenario.methodInputs, aframe: aFrame },
      aFrame,
    };
  }

  const currentInputs = scenario.methodInputs[constructionMethod] ?? getConstructionMethodDefinition(constructionMethod).getDefaultInputs();
  const methodInputs: Record<string, unknown> = { ...(currentInputs as Record<string, unknown>) };
  withNumberField(methodInputs, "widthM", "houseWidthM", result.extracted.houseWidthM, fieldSelected(selectedFields, "houseWidthM"));
  withNumberField(methodInputs, "depthM", "houseDepthM", result.extracted.houseDepthM, fieldSelected(selectedFields, "houseDepthM"));
  withNumberField(methodInputs, "floorHeightM", "floorHeightM", result.extracted.floorHeightM, fieldSelected(selectedFields, "floorHeightM"));
  withNumberField(methodInputs, "floors", "floors", result.extracted.floors, fieldSelected(selectedFields, "floors"));
  withNumberField(methodInputs, "doorCount", "doorCount", result.extracted.doorCount, fieldSelected(selectedFields, "doorCount"));
  withNumberField(methodInputs, "windowCount", "windowCount", result.extracted.windowCount, fieldSelected(selectedFields, "windowCount"));
  return {
    methodInputs: { ...scenario.methodInputs, [constructionMethod]: methodInputs as ConstructionMethodInputs },
    aFrame: scenario.aFrame,
  };
}

function applyScenarioPlanExtract(scenario: Scenario, result: PlanExtractResult, selectedFields: PlanExtractSelectedFields): Scenario {
  const extractedMethod = fieldSelected(selectedFields, "constructionMethod") ? result.extracted.constructionMethod : undefined;
  const constructionMethod = extractedMethod ?? scenario.constructionMethod;
  const terrain = { ...scenario.terrain };
  withNumberField(terrain, "width", "terrainWidthM", result.extracted.terrainWidthM, fieldSelected(selectedFields, "terrainWidthM"));
  withNumberField(terrain, "depth", "terrainDepthM", result.extracted.terrainDepthM, fieldSelected(selectedFields, "terrainDepthM"));

  const country = fieldSelected(selectedFields, "country") ? result.extracted.country ?? scenario.location.country : scenario.location.country;

  const location = {
    ...scenario.location,
    address: fieldSelected(selectedFields, "address") ? result.extracted.address ?? scenario.location.address : scenario.location.address,
    city: fieldSelected(selectedFields, "city") ? result.extracted.city ?? scenario.location.city : scenario.location.city,
    state: fieldSelected(selectedFields, "state") ? normalizeStateForCountry(result.extracted.state, country, scenario.location.state) : scenario.location.state,
    country,
  };
  const methodUpdate = applyMethodInputs(scenario, result, selectedFields, constructionMethod);

  return {
    ...scenario,
    constructionMethod,
    terrain,
    location,
    methodInputs: methodUpdate.methodInputs,
    aFrame: methodUpdate.aFrame,
  };
}

export function applyPlanExtractToProject(project: Project, scenarioId: string, result: PlanExtractResult, selectedFields: PlanExtractSelectedFields): Project {
  const shouldUpdateProjectName = fieldSelected(selectedFields, "projectName") && typeof result.extracted.projectName === "string" && result.extracted.projectName.trim().length > 0;
  return {
    ...project,
    name: shouldUpdateProjectName ? result.extracted.projectName!.trim() : project.name,
    scenarios: project.scenarios.map((scenario) => (scenario.id === scenarioId ? applyScenarioPlanExtract(scenario, result, selectedFields) : scenario)),
  };
}

export function getPlanExtractApplicableFields(result: PlanExtractResult, currentMethod?: ConstructionMethodId) {
  const method = currentMethod ?? getCompatibleExtractedMethod(result.extracted.constructionMethod);
  return (Object.keys(result.extracted) as Array<keyof PlanExtractResult["extracted"]>).filter((field) => {
    if (result.extracted[field] === undefined) return false;
    if (field === "notes") return false;
    if (commonApplicableFields.has(field)) return true;
    if (method === "aframe") return aFrameApplicableFields.has(field);
    if (method && nonAFrameMethodIds.includes(method)) return rectangularMethodApplicableFields.has(field);
    return aFrameApplicableFields.has(field) || rectangularMethodApplicableFields.has(field);
  });
}

export function isPlanExtractMethodCompatible(method: ConstructionMethodId) {
  return method === "aframe" || nonAFrameMethodIds.includes(method);
}

function getCompatibleExtractedMethod(method: PlanExtractResult["extracted"]["constructionMethod"]) {
  return method && isPlanExtractMethodCompatible(method) ? method : undefined;
}

function normalizeStateForCountry(state: string | undefined, country: string, fallback: string) {
  const nextState = state || fallback;
  if (!isBrazilCountry(country)) return nextState;
  return normalizeBrazilStateName(nextState) || nextState;
}

function isBrazilCountry(country: string | undefined) {
  const normalized = (country ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return normalized === "brasil" || normalized === "brazil" || normalized === "br";
}
