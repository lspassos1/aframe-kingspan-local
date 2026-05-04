import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { getConstructionMethodDefinition, type Construction3DLayer, type Construction3DLayerType, type ConstructionMethodId } from "@/lib/construction-methods";
import { getGeneric3DNumberControls } from "@/lib/construction-methods/generic-3d-controls";
import { getGenericViewerFramingLayers } from "@/lib/construction-methods/generic-viewer-framing";
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

  it("uses method wall thickness equivalents in generic wall layers", () => {
    const baseScenario = defaultProject.scenarios[0];
    const ecoBlockDefinition = getConstructionMethodDefinition("eco-block");
    const epsDefinition = getConstructionMethodDefinition("monolithic-eps");
    const ecoBlockScenario = {
      ...baseScenario,
      constructionMethod: "eco-block" as const,
      methodInputs: {
        ...baseScenario.methodInputs,
        "eco-block": {
          ...ecoBlockDefinition.getDefaultInputs(),
          blockWidthM: 0.2,
        },
      },
    };
    const epsScenario = {
      ...baseScenario,
      constructionMethod: "monolithic-eps" as const,
      methodInputs: {
        ...baseScenario.methodInputs,
        "monolithic-eps": {
          ...epsDefinition.getDefaultInputs(),
          finalWallThicknessM: 0.22,
        },
      },
    };

    const ecoWalls = ecoBlockDefinition.generate3DLayers?.({ project: defaultProject, scenario: ecoBlockScenario }).find((layer) => layer.type === "walls");
    const epsWalls = epsDefinition.generate3DLayers?.({ project: defaultProject, scenario: epsScenario }).find((layer) => layer.type === "walls");

    expect(ecoWalls?.data.primitives.some((primitive) => primitive.size[0] === 0.2 || primitive.size[2] === 0.2)).toBe(true);
    expect(epsWalls?.data.primitives.some((primitive) => primitive.size[0] === 0.22 || primitive.size[2] === 0.22)).toBe(true);
  });

  it("adds a buildable area primitive from terrain setbacks", () => {
    const definition = getConstructionMethodDefinition("conventional-masonry");
    const baseScenario = defaultProject.scenarios[0];
    const scenario = {
      ...baseScenario,
      constructionMethod: "conventional-masonry" as const,
      terrain: {
        ...baseScenario.terrain,
        width: 14,
        depth: 18,
        frontSetback: 3,
        rearSetback: 2,
        leftSetback: 1.5,
        rightSetback: 1,
      },
      methodInputs: {
        ...baseScenario.methodInputs,
        "conventional-masonry": {
          ...definition.getDefaultInputs(),
          widthM: 8,
          depthM: 10,
        },
      },
    };
    const terrain = definition.generate3DLayers?.({ project: defaultProject, scenario }).find((layer) => layer.type === "terrain");
    const buildableArea = terrain?.data.primitives.find((primitive) => primitive.id === "buildable-area");

    expect(buildableArea?.size).toEqual([11.5, 0.04, 13]);
    expect(buildableArea?.wireframe).toBe(true);
  });

  it("keeps buildable area tied to real lot dimensions when the render plane is padded", () => {
    const definition = getConstructionMethodDefinition("conventional-masonry");
    const baseScenario = defaultProject.scenarios[0];
    const scenario = {
      ...baseScenario,
      constructionMethod: "conventional-masonry" as const,
      terrain: {
        ...baseScenario.terrain,
        width: 6,
        depth: 8,
        frontSetback: 1,
        rearSetback: 1,
        leftSetback: 1,
        rightSetback: 1,
      },
      methodInputs: {
        ...baseScenario.methodInputs,
        "conventional-masonry": {
          ...definition.getDefaultInputs(),
          widthM: 10,
          depthM: 14,
        },
      },
    };
    const terrain = definition.generate3DLayers?.({ project: defaultProject, scenario }).find((layer) => layer.type === "terrain");
    const terrainPlane = terrain?.data.primitives.find((primitive) => primitive.id === "terrain-plane");
    const buildableArea = terrain?.data.primitives.find((primitive) => primitive.id === "buildable-area");

    expect(terrainPlane?.size[0]).toBeGreaterThan(6);
    expect(terrainPlane?.size[2]).toBeGreaterThan(8);
    expect(buildableArea?.size).toEqual([4, 0.04, 6]);
  });

  it("exposes A-frame-like dynamic controls for non-A-frame viewers", () => {
    expect(getGeneric3DNumberControls("conventional-masonry", { widthM: 9, depthM: 12, floorHeightM: 3, floors: 2 }).map((control) => control.key)).toEqual([
      "widthM",
      "depthM",
      "floorHeightM",
      "floors",
      "wallThicknessM",
    ]);
    expect(getGeneric3DNumberControls("eco-block", { blockWidthM: 0.18 }).find((control) => control.key === "blockWidthM")?.value).toBe(0.18);
    expect(getGeneric3DNumberControls("monolithic-eps", { epsCoreThicknessM: 0.1 }).find((control) => control.key === "epsCoreThicknessM")?.value).toBe(0.1);
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

      expect(dimensions?.widthM).toBeGreaterThanOrEqual(9);
      expect(dimensions?.depthM).toBeGreaterThanOrEqual(11);
      expect(dimensions?.heightM).toBeGreaterThan(3);
      expect(dimensions?.terrainWidthM).toBeGreaterThanOrEqual(9);
      expect(dimensions?.terrainDepthM).toBeGreaterThanOrEqual(11);
    }
  });

  it("aligns dimension values with the footprint extents used by dimension lines", () => {
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
          wallThicknessM: 0.2,
        },
      },
    };
    const layers = definition.generate3DLayers?.({ project: defaultProject, scenario }) ?? [];
    const dimensions = getGenericConstructionDimensions(layers);

    expect(dimensions?.widthM).toBe(9.2);
    expect(dimensions?.depthM).toBe(11.2);
  });

  it("frames the full dimension source when dimension overlays are visible", () => {
    const activeLayers: Construction3DLayer[] = [{ id: "walls", type: "walls", label: "Paredes", visibleByDefault: true, methodId: "conventional-masonry", data: { primitives: [] } }];
    const dimensionLayers: Construction3DLayer[] = [
      ...activeLayers,
      { id: "terrain", type: "terrain", label: "Terreno", visibleByDefault: false, methodId: "conventional-masonry", data: { primitives: [] } },
    ];

    expect(getGenericViewerFramingLayers(activeLayers, dimensionLayers, true)).toBe(dimensionLayers);
    expect(getGenericViewerFramingLayers(activeLayers, dimensionLayers, false)).toBe(activeLayers);
  });
});
