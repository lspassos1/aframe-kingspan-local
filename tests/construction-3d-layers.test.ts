import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { getConstructionMethodDefinition, type Construction3DLayerType, type ConstructionMethodId } from "@/lib/construction-methods";
import { getGenericConstructionDimensions } from "@/lib/construction-methods/three-dimensions";

const genericMethodIds: ConstructionMethodId[] = ["conventional-masonry", "eco-block", "monolithic-eps"];
const requiredLayerTypes: Construction3DLayerType[] = ["terrain", "foundation", "floor", "walls", "roof", "openings"];

describe("generic construction 3D layers", () => {
  it("keeps A-frame on the current dedicated viewer path", () => {
    expect(getConstructionMethodDefinition("aframe").generate3DLayers).toBeUndefined();
  });

  it("generates simple visible layers for non-A-frame methods", () => {
    const baseScenario = defaultProject.scenarios[0];

    for (const methodId of genericMethodIds) {
      const definition = getConstructionMethodDefinition(methodId);
      const scenario = {
        ...baseScenario,
        constructionMethod: methodId,
        methodInputs: {
          ...baseScenario.methodInputs,
          [methodId]: {
            ...definition.getDefaultInputs(),
            widthM: 10,
            depthM: 14,
            floorHeightM: 3,
          },
        },
      };
      const layers = definition.generate3DLayers?.({ project: defaultProject, scenario }) ?? [];

      expect(layers.map((layer) => layer.type)).toEqual(expect.arrayContaining(requiredLayerTypes));
      expect(layers.every((layer) => layer.methodId === methodId)).toBe(true);
      expect(layers.every((layer) => layer.visibleByDefault)).toBe(true);
      expect(layers.every((layer) => layer.data.primitives.length > 0)).toBe(true);
    }
  });

  it("uses method dimensions when building wall primitives", () => {
    const definition = getConstructionMethodDefinition("conventional-masonry");
    const baseScenario = defaultProject.scenarios[0];
    const scenario = {
      ...baseScenario,
      constructionMethod: "conventional-masonry" as const,
      methodInputs: {
        ...baseScenario.methodInputs,
        "conventional-masonry": {
          ...definition.getDefaultInputs(),
          widthM: 9,
          depthM: 11,
          floorHeightM: 3.2,
        },
      },
    };
    const walls = definition.generate3DLayers?.({ project: defaultProject, scenario }).find((layer) => layer.type === "walls");

    expect(walls?.data.primitives.some((primitive) => primitive.size[0] === 9)).toBe(true);
    expect(walls?.data.primitives.some((primitive) => primitive.size[2] === 11)).toBe(true);
    expect(walls?.data.primitives.every((primitive) => primitive.size[1] === 3.2)).toBe(true);
  });

  it("derives visible dimensions for non-A-frame methods", () => {
    const baseScenario = defaultProject.scenarios[0];

    for (const methodId of genericMethodIds) {
      const definition = getConstructionMethodDefinition(methodId);
      const scenario = {
        ...baseScenario,
        constructionMethod: methodId,
        methodInputs: {
          ...baseScenario.methodInputs,
          [methodId]: {
            ...definition.getDefaultInputs(),
            widthM: 9,
            depthM: 11,
            floorHeightM: 3,
          },
        },
      };
      const layers = definition.generate3DLayers?.({ project: defaultProject, scenario }) ?? [];
      const dimensions = getGenericConstructionDimensions(layers);

      expect(dimensions?.widthM).toBe(9);
      expect(dimensions?.depthM).toBe(11);
      expect(dimensions?.heightM).toBeGreaterThan(3);
      expect(dimensions?.terrainWidthM).toBeGreaterThanOrEqual(9);
      expect(dimensions?.terrainDepthM).toBeGreaterThanOrEqual(11);
    }
  });
});
