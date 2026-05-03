import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { normalizeProject } from "@/lib/store/project-normalization";
import type { AFrameInputs, Project } from "@/types/project";

describe("project serialization and normalization", () => {
  it("round-trips a valid project through JSON without losing core fields", () => {
    const parsed = JSON.parse(JSON.stringify(defaultProject)) as Project;

    expect(parsed.id).toBe(defaultProject.id);
    expect(parsed.name).toBe(defaultProject.name);
    expect(parsed.selectedScenarioId).toBe(defaultProject.selectedScenarioId);
    expect(parsed.scenarios).toHaveLength(defaultProject.scenarios.length);
    expect(parsed.scenarios[0].constructionMethod).toBe("aframe");
    expect(parsed.scenarios[0].methodInputs.aframe).toMatchObject(parsed.scenarios[0].aFrame);
    expect(parsed.panelProducts).toHaveLength(defaultProject.panelProducts.length);
    expect(parsed.materialAssumptions).toMatchObject(defaultProject.materialAssumptions);
    expect(parsed.budgetAssumptions.contingencyPercent).toBe(defaultProject.budgetAssumptions.contingencyPercent);
    expect(parsed.budgetAssumptions.panelInstallationLaborBRLM2).toBe(defaultProject.budgetAssumptions.panelInstallationLaborBRLM2);
    expect(parsed.budgetAssumptions.engineerPlaceholderBRL).toBe(defaultProject.budgetAssumptions.engineerPlaceholderBRL);
    expect(parsed.foundationAssumptions).toMatchObject(defaultProject.foundationAssumptions);
  });

  it("normalizes legacy A-frame mezzanine fields while preserving current defaults", () => {
    const legacyAFrame = {
      ...defaultProject.scenarios[0].aFrame,
      upperFloorMode: undefined,
      upperFloorLevelHeight: undefined,
      upperFloorAreaPercent: undefined,
      mezzanineFloorHeight: 2.6,
      mezzanineDepth: defaultProject.scenarios[0].aFrame.houseDepth / 2,
    } as unknown as AFrameInputs;
    const legacyProject = {
      ...defaultProject,
      scenarios: [
        {
          ...defaultProject.scenarios[0],
          aFrame: legacyAFrame,
        },
      ],
      panelProducts: [],
      accessories: [],
    } as Project;

    const normalized = normalizeProject(legacyProject);
    const normalizedScenario = normalized.scenarios[0];

    expect(normalizedScenario.constructionMethod).toBe("aframe");
    expect(normalizedScenario.methodInputs.aframe).toMatchObject(normalizedScenario.aFrame);
    expect(normalizedScenario.aFrame.upperFloorMode).toBe("full-floor");
    expect(normalizedScenario.aFrame.upperFloorLevelHeight).toBe(2.6);
    expect(normalizedScenario.aFrame.upperFloorAreaPercent).toBe(50);
    expect(normalized.panelProducts).toHaveLength(defaultProject.panelProducts.length);
    expect(normalized.accessories).toHaveLength(defaultProject.accessories.length);
  });

  it("keeps every default scenario method-aware while preserving legacy aFrame inputs", () => {
    for (const scenario of defaultProject.scenarios) {
      expect(scenario.constructionMethod).toBe("aframe");
      expect(scenario.methodInputs.aframe).toMatchObject(scenario.aFrame);
    }
  });
});
