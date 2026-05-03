import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { calculateBudget } from "@/lib/calculations/budget";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { calculateMaterialList } from "@/lib/calculations/materials";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";

const scenario = defaultProject.scenarios[0];
const aframeMethod = getConstructionMethodDefinition("aframe");
const context = { project: defaultProject, scenario };

describe("A-frame construction method plugin", () => {
  it("exposes the existing geometry calculation through the registry", () => {
    const pluginGeometry = aframeMethod.calculateGeometry?.(context);
    const legacyGeometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);

    expect(pluginGeometry).toEqual(legacyGeometry);
  });

  it("uses methodInputs.aframe when present for transitional scenario compatibility", () => {
    const transitionalScenario = {
      ...scenario,
      methodInputs: {
        ...scenario.methodInputs,
        aframe: {
          ...scenario.aFrame,
          panelLength: 7,
        },
      },
    };
    const pluginGeometry = aframeMethod.calculateGeometry?.({ project: defaultProject, scenario: transitionalScenario });
    const expectedGeometry = calculateAFrameGeometry(transitionalScenario.terrain, transitionalScenario.methodInputs.aframe);

    expect(pluginGeometry).toEqual(expectedGeometry);
  });

  it("returns the same material list as the current A-frame calculation", () => {
    const pluginMaterials = aframeMethod.calculateMaterialList?.(context);
    const legacyMaterials = calculateMaterialList(defaultProject, scenario);

    expect(pluginMaterials).toEqual(legacyMaterials);
  });

  it("returns the same budget summary and items as the current A-frame calculation", () => {
    const pluginBudget = aframeMethod.calculateBudget?.(context);
    const legacyBudget = calculateBudget(defaultProject, scenario);

    expect(pluginBudget).toEqual(legacyBudget);
    expect(aframeMethod.calculateBudgetItems?.(context)).toEqual(legacyBudget.items);
  });

  it("returns the existing A-frame warning set", () => {
    const legacyBudget = calculateBudget(defaultProject, scenario);

    expect(aframeMethod.calculateWarnings?.(context)).toEqual(legacyBudget.warnings);
    expect(aframeMethod.calculateWarnings?.(context).some((warning) => warning.id === "structural-disclaimer")).toBe(true);
  });
});
