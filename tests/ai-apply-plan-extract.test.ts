import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import {
  applyPlanExtractToProject,
  getDefaultPlanExtractSelectedFields,
  getPlanExtractApplicableFields,
  hasActionablePlanExtractFields,
  type PlanExtractSelectedFields,
} from "@/lib/ai/apply-plan-extract";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { createDefaultManualTakeoffState, createManualTakeoffDataFromState } from "@/lib/takeoff/manual-stepper";
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

function projectWithManualTakeoff() {
  const project = cloneProject(defaultProject);
  project.scenarios[0] = {
    ...project.scenarios[0],
    manualTakeoff: createManualTakeoffDataFromState(createDefaultManualTakeoffState({ rooms: [], openings: [] }), "2026-05-08T20:00:00.000Z"),
  };
  return project;
}

describe("AI plan extract application", () => {
  it("preselects only extracted fields that are not low confidence", () => {
    const selected = getDefaultPlanExtractSelectedFields(baseResult);

    expect(selected.projectName).toBe(false);
    expect(selected.city).toBe(true);
    expect(selected.constructionMethod).toBe(false);
    expect(selected.houseDepthM).toBe(true);
  });

  it("preselects construction method only when the method confidence is high", () => {
    const selected = getDefaultPlanExtractSelectedFields({
      ...baseResult,
      fieldConfidence: {
        ...baseResult.fieldConfidence,
        constructionMethod: "high",
      },
    });

    expect(selected.constructionMethod).toBe(true);
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

  it("uses the extracted method for default selections only when the method field is selected", () => {
    const selected = getDefaultPlanExtractSelectedFields(baseResult, "aframe");
    const lowMethodSelected = getDefaultPlanExtractSelectedFields(
      {
        ...baseResult,
        fieldConfidence: {
          ...baseResult.fieldConfidence,
          constructionMethod: "low",
        },
      },
      "aframe"
    );

    expect(selected.constructionMethod).toBe(false);
    expect(selected.houseWidthM).toBeUndefined();
    expect(lowMethodSelected.constructionMethod).toBe(false);
    expect(lowMethodSelected.houseWidthM).toBeUndefined();
    expect(lowMethodSelected.houseDepthM).toBe(true);
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

  it("invalidates persisted manual takeoff when applying extracted geometry", () => {
    const project = projectWithManualTakeoff();

    const updated = applyPlanExtractToProject(project, project.selectedScenarioId, baseResult, {
      houseDepthM: true,
    });

    expect(updated.scenarios[0].manualTakeoff).toBeUndefined();
  });

  it("invalidates persisted manual takeoff when applying extracted method or openings", () => {
    const methodUpdate = applyPlanExtractToProject(projectWithManualTakeoff(), defaultProject.selectedScenarioId, baseResult, { constructionMethod: true });
    expect(methodUpdate.scenarios[0].manualTakeoff).toBeUndefined();

    for (const selectedFields of [{ doorCount: true }, { windowCount: true }]) {
      const project = projectWithManualTakeoff();
      project.scenarios[0] = {
        ...project.scenarios[0],
        constructionMethod: "conventional-masonry",
        methodInputs: {
          ...project.scenarios[0].methodInputs,
          "conventional-masonry": {
            ...getConstructionMethodDefinition("conventional-masonry").getDefaultInputs(),
            doorCount: 1,
            windowCount: 1,
          },
        },
      };
      const updated = applyPlanExtractToProject(project, project.selectedScenarioId, baseResult, selectedFields);
      expect(updated.scenarios[0].manualTakeoff).toBeUndefined();
    }
  });

  it("preserves persisted manual takeoff when selected invalidating fields do not change values", () => {
    const project = projectWithManualTakeoff();
    const currentDepth = project.scenarios[0].aFrame.houseDepth;
    const equalResult: PlanExtractResult = {
      ...baseResult,
      extracted: {
        ...baseResult.extracted,
        houseDepthM: currentDepth,
      },
    };
    const invalidResult: PlanExtractResult = {
      ...baseResult,
      extracted: {
        ...baseResult.extracted,
        houseDepthM: -12,
      },
    };

    const equalUpdate = applyPlanExtractToProject(project, project.selectedScenarioId, equalResult, { houseDepthM: true });
    const invalidUpdate = applyPlanExtractToProject(project, project.selectedScenarioId, invalidResult, { houseDepthM: true });

    expect(equalUpdate.scenarios[0].manualTakeoff).toBeDefined();
    expect(invalidUpdate.scenarios[0].manualTakeoff).toBeDefined();
  });

  it("preserves persisted manual takeoff when applying only location or non-geometric fields", () => {
    const project = projectWithManualTakeoff();

    const updated = applyPlanExtractToProject(project, project.selectedScenarioId, baseResult, {
      projectName: true,
      address: true,
      city: true,
      state: true,
      country: true,
    });

    expect(updated.scenarios[0].manualTakeoff?.rooms).toEqual([]);
    expect(updated.scenarios[0].manualTakeoff?.openings).toEqual([]);
  });

  it("maps dimensions into non-A-frame method inputs after review", () => {
    const project = cloneProject(defaultProject);
    const selected = {
      ...getDefaultPlanExtractSelectedFields(baseResult),
      constructionMethod: true,
    };
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

  it("does not normalize non-Brazil states as Brazilian UF codes", () => {
    const project = cloneProject(defaultProject);
    const result: PlanExtractResult = {
      ...baseResult,
      extracted: {
        ...baseResult.extracted,
        country: "United States",
        state: "PA",
      },
    };

    const updated = applyPlanExtractToProject(project, project.selectedScenarioId, result, {
      country: true,
      state: true,
    });
    const scenario = updated.scenarios[0];

    expect(scenario.location.country).toBe("United States");
    expect(scenario.location.state).toBe("PA");
  });

  it("ignores invalid numeric extracted values before writing method inputs", () => {
    const project = cloneProject(defaultProject);
    const result: PlanExtractResult = {
      ...baseResult,
      extracted: {
        ...baseResult.extracted,
        floors: 0,
        houseDepthM: -12,
        doorCount: -1,
      },
    };

    const updated = applyPlanExtractToProject(project, project.selectedScenarioId, result, {
      ...getDefaultPlanExtractSelectedFields(result),
      constructionMethod: true,
    });
    const masonryInputs = updated.scenarios[0].methodInputs["conventional-masonry"] as Record<string, unknown>;

    expect(masonryInputs.floors).not.toBe(0);
    expect(masonryInputs.depthM).not.toBe(-12);
    expect(masonryInputs.doorCount).not.toBe(-1);
  });

  it("lists only present fields as applicable", () => {
    expect(getPlanExtractApplicableFields(baseResult)).toContain("houseWidthM");
    expect(getPlanExtractApplicableFields(baseResult)).not.toContain("address");
  });

  it("distinguishes reviewable notes from fields that can be applied to the study", () => {
    const assumptionsOnly: PlanExtractResult = {
      ...baseResult,
      extracted: {
        notes: ["A planta parece conter cotas, mas nenhuma medida legível foi extraída."],
      },
      fieldConfidence: {},
      assumptions: ["A imagem parece ser uma planta baixa."],
      missingInformation: ["Informe uma medida de referência."],
      warnings: [],
    };

    expect(hasActionablePlanExtractFields(baseResult)).toBe(true);
    expect(hasActionablePlanExtractFields(assumptionsOnly)).toBe(false);
  });

  it("does not treat invalid numeric extracted values as actionable", () => {
    const zeroTerrainOnly: PlanExtractResult = {
      ...baseResult,
      extracted: {
        terrainWidthM: 0,
        notes: ["Largura ilegível retornou zero."],
      },
      fieldConfidence: {
        terrainWidthM: "low",
      },
      assumptions: [],
      missingInformation: ["Confirmar largura do terreno."],
      warnings: [],
    };
    const zeroOpenings: PlanExtractResult = {
      ...zeroTerrainOnly,
      extracted: {
        doorCount: 0,
        notes: ["Nenhuma porta legível."],
      },
      fieldConfidence: {
        doorCount: "medium",
      },
    };

    expect(hasActionablePlanExtractFields(zeroTerrainOnly)).toBe(false);
    expect(hasActionablePlanExtractFields(zeroOpenings)).toBe(true);
  });

  it("lists only A-frame-applicable dimensions when the target method is A-frame", () => {
    const result: PlanExtractResult = {
      ...baseResult,
      extracted: {
        ...baseResult.extracted,
        constructionMethod: "aframe",
        builtAreaM2: 90,
      },
    };
    const fields = getPlanExtractApplicableFields(result, "aframe");

    expect(fields).toContain("houseDepthM");
    expect(fields).not.toContain("houseWidthM");
    expect(fields).not.toContain("builtAreaM2");
    expect(fields).not.toContain("floors");
  });

  it("lets the caller override extracted method applicability with the method being applied", () => {
    const fields = getPlanExtractApplicableFields(baseResult, "aframe");

    expect(fields).toContain("houseDepthM");
    expect(fields).not.toContain("houseWidthM");
    expect(fields).not.toContain("floors");
  });
});
