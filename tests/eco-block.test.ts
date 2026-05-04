import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { calculateEcoBlockBudget } from "@/lib/construction-methods/eco-block/budget";
import { calculateEcoBlockGeometry } from "@/lib/construction-methods/eco-block/geometry";
import { calculateEcoBlockMaterialList } from "@/lib/construction-methods/eco-block/materials";

const definition = getConstructionMethodDefinition("eco-block");
const scenario = {
  ...defaultProject.scenarios[0],
  constructionMethod: "eco-block" as const,
  methodInputs: {
    ...defaultProject.scenarios[0].methodInputs,
    "eco-block": {
      ...definition.getDefaultInputs(),
      widthM: 9,
      depthM: 11,
      floorHeightM: 3,
      blocksPerM2: 64,
      groutingEnabled: true,
      horizontalRebarEnabled: true,
      finishType: "plastered",
    },
  },
};
const context = { project: defaultProject, scenario };

describe("eco-block method", () => {
  it("calculates preliminary block quantities without assuming structure by default", () => {
    const geometry = calculateEcoBlockGeometry(context);

    expect(geometry.builtAreaM2).toBe(99);
    expect(geometry.netWallAreaM2).toBeGreaterThan(100);
    expect(geometry.totalBlocks).toBeGreaterThan(7000);
    expect(geometry.specialBlocks).toBeGreaterThan(0);
    expect(geometry.groutM3).toBeGreaterThan(0);
    expect(geometry.horizontalSteelKg).toBeGreaterThan(0);
    expect(geometry.warnings.some((warning) => warning.id === "eco-block-no-structural-assumption")).toBe(true);
  });

  it("generates material lines with pending price confirmation", () => {
    const materials = calculateEcoBlockMaterialList(context);

    expect(materials.find((line) => line.id === "eco-blocks")?.quantity).toBeGreaterThan(7000);
    expect(materials.some((line) => line.id === "eco-grout")).toBe(true);
    expect(materials.every((line) => line.requiresConfirmation)).toBe(true);
    expect(materials.every((line) => line.netTotalBRL === 0)).toBe(true);
  });

  it("exposes budget, warnings and assembly layers through the registry", () => {
    const budget = calculateEcoBlockBudget(context);
    const layers = definition.generate3DLayers?.(context) ?? [];

    expect(definition.calculateGeometry?.(context)).toEqual(calculateEcoBlockGeometry(context));
    expect(definition.calculateMaterialList?.(context)).toEqual(calculateEcoBlockMaterialList(context));
    expect(definition.calculateBudget?.(context)).toEqual(budget);
    expect(definition.calculateBudgetItems?.(context)).toEqual(budget.items);
    expect(definition.calculateWarnings?.(context)).toEqual(budget.warnings);
    expect(layers.some((layer) => layer.id === "eco-block-courses")).toBe(true);
  });
});
