import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { calculateMonolithicEpsBudget } from "@/lib/construction-methods/monolithic-eps/budget";
import { calculateMonolithicEpsGeometry } from "@/lib/construction-methods/monolithic-eps/geometry";
import { calculateMonolithicEpsMaterialList } from "@/lib/construction-methods/monolithic-eps/materials";

const definition = getConstructionMethodDefinition("monolithic-eps");
const scenario = {
  ...defaultProject.scenarios[0],
  constructionMethod: "monolithic-eps" as const,
  methodInputs: {
    ...defaultProject.scenarios[0].methodInputs,
    "monolithic-eps": {
      ...definition.getDefaultInputs(),
      widthM: 9,
      depthM: 11,
      floorHeightM: 3,
      panelWidthM: 1.2,
      panelHeightM: 3,
      renderThicknessPerFaceM: 0.03,
      starterBarsEnabled: true,
      openingReinforcementEnabled: true,
    },
  },
};
const context = { project: defaultProject, scenario };

describe("monolithic EPS method", () => {
  it("calculates preliminary panel, render and reinforcement quantities", () => {
    const geometry = calculateMonolithicEpsGeometry(context);

    expect(geometry.builtAreaM2).toBe(99);
    expect(geometry.netPanelAreaM2).toBeGreaterThan(100);
    expect(geometry.panelCount).toBeGreaterThan(30);
    expect(geometry.renderVolumeM3).toBeGreaterThan(6);
    expect(geometry.meshAreaM2).toBeGreaterThan(200);
    expect(geometry.starterBars).toBeGreaterThan(0);
    expect(geometry.warnings.some((warning) => warning.id === "eps-system-validation")).toBe(true);
  });

  it("generates material lines with pending price confirmation", () => {
    const materials = calculateMonolithicEpsMaterialList(context);

    expect(materials.find((line) => line.id === "eps-panels")?.quantity).toBeGreaterThan(30);
    expect(materials.some((line) => line.id === "eps-mesh")).toBe(true);
    expect(materials.every((line) => line.requiresConfirmation)).toBe(true);
    expect(materials.every((line) => line.netTotalBRL === 0)).toBe(true);
  });

  it("exposes budget, warnings and layer stack through the registry", () => {
    const budget = calculateMonolithicEpsBudget(context);
    const layers = definition.generate3DLayers?.(context) ?? [];

    expect(definition.calculateGeometry?.(context)).toEqual(calculateMonolithicEpsGeometry(context));
    expect(definition.calculateMaterialList?.(context)).toEqual(calculateMonolithicEpsMaterialList(context));
    expect(definition.calculateBudget?.(context)).toEqual(budget);
    expect(definition.calculateBudgetItems?.(context)).toEqual(budget.items);
    expect(definition.calculateWarnings?.(context)).toEqual(budget.warnings);
    expect(layers.some((layer) => layer.id === "eps-layer-stack")).toBe(true);
  });
});
