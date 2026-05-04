import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";
import { getConstructionMethodDefinition, type ConstructionMethodId, type ConstructionMethodInputs } from "@/lib/construction-methods";
import type { AFrameInputs, Project, Scenario } from "@/types/project";
import { normalizeBrazilStateName } from "@/lib/locations/brazil";

export type PlanExtractSelectedFields = Partial<Record<keyof PlanExtractResult["extracted"], boolean>>;

const nonAFrameMethodIds: ConstructionMethodId[] = ["conventional-masonry", "eco-block", "monolithic-eps"];

function fieldSelected(selectedFields: PlanExtractSelectedFields, field: keyof PlanExtractResult["extracted"]) {
  return Boolean(selectedFields[field]);
}

export function getDefaultPlanExtractSelectedFields(result: PlanExtractResult): PlanExtractSelectedFields {
  return Object.keys(result.extracted).reduce<PlanExtractSelectedFields>((selected, key) => {
    const field = key as keyof PlanExtractResult["extracted"];
    selected[field] = (result.fieldConfidence[field] ?? result.confidence) !== "low";
    return selected;
  }, {});
}

function withNumberField<T extends Record<string, unknown>>(target: T, key: keyof T, value: number | undefined, selected: boolean) {
  if (selected && typeof value === "number" && Number.isFinite(value)) {
    target[key] = value as T[keyof T];
  }
}

function applyMethodInputs(scenario: Scenario, result: PlanExtractResult, selectedFields: PlanExtractSelectedFields, constructionMethod: ConstructionMethodId) {
  if (constructionMethod === "aframe") {
    const aFrame: AFrameInputs = { ...scenario.aFrame };
    if (fieldSelected(selectedFields, "houseDepthM") && typeof result.extracted.houseDepthM === "number") {
      aFrame.houseDepth = result.extracted.houseDepthM;
      aFrame.automaticDepth = false;
    }
    return {
      methodInputs: { ...scenario.methodInputs, aframe: aFrame },
      aFrame,
    };
  }

  const currentInputs = scenario.methodInputs[constructionMethod] ?? getConstructionMethodDefinition(constructionMethod).getDefaultInputs();
  const methodInputs: Record<string, unknown> = { ...(currentInputs as Record<string, unknown>) };
  withNumberField(methodInputs, "widthM", result.extracted.houseWidthM, fieldSelected(selectedFields, "houseWidthM"));
  withNumberField(methodInputs, "depthM", result.extracted.houseDepthM, fieldSelected(selectedFields, "houseDepthM"));
  withNumberField(methodInputs, "floorHeightM", result.extracted.floorHeightM, fieldSelected(selectedFields, "floorHeightM"));
  withNumberField(methodInputs, "floors", result.extracted.floors, fieldSelected(selectedFields, "floors"));
  withNumberField(methodInputs, "doorCount", result.extracted.doorCount, fieldSelected(selectedFields, "doorCount"));
  withNumberField(methodInputs, "windowCount", result.extracted.windowCount, fieldSelected(selectedFields, "windowCount"));
  return {
    methodInputs: { ...scenario.methodInputs, [constructionMethod]: methodInputs as ConstructionMethodInputs },
    aFrame: scenario.aFrame,
  };
}

function applyScenarioPlanExtract(scenario: Scenario, result: PlanExtractResult, selectedFields: PlanExtractSelectedFields): Scenario {
  const extractedMethod = fieldSelected(selectedFields, "constructionMethod") ? result.extracted.constructionMethod : undefined;
  const constructionMethod = extractedMethod ?? scenario.constructionMethod;
  const terrain = { ...scenario.terrain };
  withNumberField(terrain, "width", result.extracted.terrainWidthM, fieldSelected(selectedFields, "terrainWidthM"));
  withNumberField(terrain, "depth", result.extracted.terrainDepthM, fieldSelected(selectedFields, "terrainDepthM"));

  const location = {
    ...scenario.location,
    address: fieldSelected(selectedFields, "address") ? result.extracted.address ?? scenario.location.address : scenario.location.address,
    city: fieldSelected(selectedFields, "city") ? result.extracted.city ?? scenario.location.city : scenario.location.city,
    state: fieldSelected(selectedFields, "state") ? normalizeBrazilStateName(result.extracted.state ?? "") || result.extracted.state || scenario.location.state : scenario.location.state,
    country: fieldSelected(selectedFields, "country") ? result.extracted.country ?? scenario.location.country : scenario.location.country,
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

export function getPlanExtractApplicableFields(result: PlanExtractResult) {
  return (Object.keys(result.extracted) as Array<keyof PlanExtractResult["extracted"]>).filter((field) => result.extracted[field] !== undefined);
}

export function isPlanExtractMethodCompatible(method: ConstructionMethodId) {
  return method === "aframe" || nonAFrameMethodIds.includes(method);
}
