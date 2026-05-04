import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { calculateConventionalMasonryBudget } from "@/lib/construction-methods/conventional-masonry/budget";
import { calculateConventionalMasonryGeometry } from "@/lib/construction-methods/conventional-masonry/geometry";
import { calculateConventionalMasonryMaterialList } from "@/lib/construction-methods/conventional-masonry/materials";

const definition = getConstructionMethodDefinition("conventional-masonry");
const scenario = {
  ...defaultProject.scenarios[0],
  constructionMethod: "conventional-masonry" as const,
  methodInputs: {
    ...defaultProject.scenarios[0].methodInputs,
    "conventional-masonry": {
      ...definition.getDefaultInputs(),
      widthM: 9,
      depthM: 11,
      floors: 1,
      floorHeightM: 3,
      internalWallLengthM: 18,
      doorCount: 2,
      windowCount: 4,
      wastePercent: 10,
    },
  },
};
const context = { project: defaultProject, scenario };

describe("conventional masonry method", () => {
  it("calculates preliminary geometry and wall quantities", () => {
    const geometry = calculateConventionalMasonryGeometry(context);

    expect(geometry.builtAreaM2).toBe(99);
    expect(geometry.perimeterM).toBe(40);
    expect(geometry.externalWallGrossAreaM2).toBe(120);
    expect(geometry.internalWallGrossAreaM2).toBe(54);
    expect(geometry.openingsAreaM2).toBeGreaterThan(0);
    expect(geometry.netMasonryAreaM2).toBeGreaterThan(150);
    expect(geometry.totalBlocks).toBeGreaterThan(2500);
    expect(geometry.warnings.some((warning) => warning.id === "masonry-structural-project-required")).toBe(true);
  });

  it("generates material take-off lines without invented prices", () => {
    const materials = calculateConventionalMasonryMaterialList(context);

    expect(materials.find((line) => line.id === "masonry-blocks")?.quantity).toBeGreaterThan(2500);
    expect(materials.find((line) => line.id === "masonry-laying-mortar")?.quantity).toBeGreaterThan(0);
    expect(materials.every((line) => line.requiresConfirmation)).toBe(true);
    expect(materials.every((line) => line.netTotalBRL === 0)).toBe(true);
  });

  it("exposes geometry, materials, budget and warnings through the registry", () => {
    const budget = calculateConventionalMasonryBudget(context);

    expect(definition.calculateGeometry?.(context)).toEqual(calculateConventionalMasonryGeometry(context));
    expect(definition.calculateMaterialList?.(context)).toEqual(calculateConventionalMasonryMaterialList(context));
    expect(definition.calculateBudget?.(context)).toEqual(budget);
    expect(definition.calculateBudgetItems?.(context)).toEqual(budget.items);
    expect(definition.calculateWarnings?.(context)).toEqual(budget.warnings);
    expect(definition.generate3DLayers?.(context).some((layer) => layer.type === "walls")).toBe(true);
  });
});
