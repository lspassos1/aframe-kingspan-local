import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import {
  applyPlanExtractToProject,
  getDefaultPlanExtractSelectedFields,
  getPlanExtractApplicableFields,
  type PlanExtractSelectedFields,
} from "@/lib/ai/apply-plan-extract";
import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";
import type { Project } from "@/types/project";

const baseResult: PlanExtractResult = {
  version: "1.0",
  summary: "Planta retangular com cotas principais.",
  confidence: "medium",
  extracted: {
    projectName: "Casa Retangular",
    city: "Cruz das Almas",
    state: "BA",
    constructionMethod: "conventional-masonry",
    terrainWidthM: 16,
    terrainDepthM: 24,
    houseWidthM: 9,
    houseDepthM: 11,
    floorHeightM: 3,
    floors: 2,
    doorCount: 3,
    windowCount: 6,
    notes: ["Cotas preliminares"],
  },
  fieldConfidence: {
    projectName: "low",
    city: "high",
    state: "high",
    constructionMethod: "medium",
    houseWidthM: "medium",
    houseDepthM: "medium",
  },
  assumptions: [],
  missingInformation: [],
  warnings: [],
};

function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}

describe("AI plan extract application", () => {
  it("preselects only extracted fields that are not low confidence", () => {
    const selected = getDefaultPlanExtractSelectedFields(baseResult);

    expect(selected.projectName).toBe(false);
    expect(selected.city).toBe(true);
    expect(selected.constructionMethod).toBe(true);
    expect(selected.houseDepthM).toBe(true);
  });

  it("falls back to overall confidence when field confidence is missing", () => {
    const selected = getDefaultPlanExtractSelectedFields({
      ...baseResult,
      confidence: "low",
      fieldConfidence: {
        city: "high",
      },
    });

    expect(selected.city).toBe(true);
    expect(selected.terrainWidthM).toBe(false);
    expect(selected.houseDepthM).toBe(false);
  });

  it("keeps unselected project data untouched", () => {
    const project = cloneProject(defaultProject);
    const selected: PlanExtractSelectedFields = {
      projectName: false,
      city: true,
      state: false,
      constructionMethod: false,
      terrainWidthM: true,
    };

    const updated = applyPlanExtractToProject(project, project.selectedScenarioId, baseResult, selected);
    const scenario = updated.scenarios[0];

    expect(updated.name).toBe(project.name);
    expect(scenario.location.city).toBe("Cruz das Almas");
    expect(scenario.location.state).toBe(project.scenarios[0].location.state);
    expect(scenario.constructionMethod).toBe("aframe");
    expect(scenario.terrain.width).toBe(16);
    expect(scenario.terrain.depth).toBe(project.scenarios[0].terrain.depth);
  });

  it("maps dimensions into non-A-frame method inputs after review", () => {
    const project = cloneProject(defaultProject);
    const selected = getDefaultPlanExtractSelectedFields(baseResult);
    const updated = applyPlanExtractToProject(project, project.selectedScenarioId, baseResult, selected);
    const scenario = updated.scenarios[0];
    const masonryInputs = scenario.methodInputs["conventional-masonry"] as Record<string, unknown>;

    expect(updated.name).toBe(project.name);
    expect(scenario.constructionMethod).toBe("conventional-masonry");
    expect(scenario.location.state).toBe("Bahia");
    expect(scenario.terrain.width).toBe(16);
    expect(scenario.terrain.depth).toBe(24);
    expect(masonryInputs.widthM).toBe(9);
    expect(masonryInputs.depthM).toBe(11);
    expect(masonryInputs.floorHeightM).toBe(3);
    expect(masonryInputs.floors).toBe(2);
    expect(masonryInputs.doorCount).toBe(3);
    expect(masonryInputs.windowCount).toBe(6);
    expect(scenario.aFrame).toMatchObject(project.scenarios[0].aFrame);
  });

  it("applies only safe A-frame fields from an extracted plan", () => {
    const project = cloneProject(defaultProject);
    const result: PlanExtractResult = {
      ...baseResult,
      extracted: {
        ...baseResult.extracted,
        constructionMethod: "aframe",
        houseWidthM: 20,
        houseDepthM: 13.5,
      },
    };

    const updated = applyPlanExtractToProject(project, project.selectedScenarioId, result, {
      constructionMethod: true,
      houseWidthM: true,
      houseDepthM: true,
    });
    const scenario = updated.scenarios[0];

    expect(scenario.constructionMethod).toBe("aframe");
    expect(scenario.aFrame.houseDepth).toBe(13.5);
    expect(scenario.aFrame.automaticDepth).toBe(false);
    expect(scenario.aFrame.panelLength).toBe(project.scenarios[0].aFrame.panelLength);
    expect(scenario.methodInputs.aframe).toMatchObject(scenario.aFrame);
  });

  it("lists only present fields as applicable", () => {
    expect(getPlanExtractApplicableFields(baseResult)).toContain("houseWidthM");
    expect(getPlanExtractApplicableFields(baseResult)).not.toContain("address");
  });
});
