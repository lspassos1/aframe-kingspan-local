import type { Scenario } from "@/types/project";
import type { Construction3DLayer, ConstructionMethodId, ConstructionMethodInputs } from "@/lib/construction-methods/types";

interface RectangularLayerOptions {
  wallColor: string;
  roofColor: string;
  foundationColor: string;
  floorColor: string;
}

const defaultOptions: RectangularLayerOptions = {
  wallColor: "#d6d3d1",
  roofColor: "#475569",
  foundationColor: "#9ca3af",
  floorColor: "#d1d5db",
};

function readNumber(inputs: ConstructionMethodInputs | undefined, key: string, fallback: number) {
  const value = inputs && key in inputs ? (inputs as Record<string, unknown>)[key] : undefined;

  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function generateRectangularConstructionLayers(
  methodId: ConstructionMethodId,
  scenario: Scenario,
  inputs: ConstructionMethodInputs | undefined,
  options: Partial<RectangularLayerOptions> = {}
): Construction3DLayer[] {
  const colors = { ...defaultOptions, ...options };
  const widthM = readNumber(inputs, "widthM", 8);
  const depthM = readNumber(inputs, "depthM", 12);
  const floorHeightM = readNumber(inputs, "floorHeightM", 2.8);
  const floors = readNumber(inputs, "floors", 1);
  const wallThicknessM = readNumber(inputs, "wallThicknessM", 0.15);
  const totalHeightM = floorHeightM * floors;
  const terrainWidthM = Math.max(scenario.terrain.width, widthM + 4);
  const terrainDepthM = Math.max(scenario.terrain.depth, depthM + 4);
  const roofOverhangM = 0.35;

  return [
    {
      id: `${methodId}-terrain`,
      type: "terrain",
      label: "Terreno",
      visibleByDefault: true,
      methodId,
      data: {
        primitives: [
          {
            id: "terrain-plane",
            kind: "box",
            position: [0, -0.04, 0],
            size: [terrainWidthM, 0.08, terrainDepthM],
            color: "#e5efe7",
          },
        ],
      },
    },
    {
      id: `${methodId}-foundation`,
      type: "foundation",
      label: "Fundacao/base",
      visibleByDefault: true,
      methodId,
      data: {
        primitives: [
          {
            id: "foundation-base",
            kind: "box",
            position: [0, 0.06, 0],
            size: [widthM + 0.45, 0.2, depthM + 0.45],
            color: colors.foundationColor,
          },
        ],
      },
    },
    {
      id: `${methodId}-floor`,
      type: "floor",
      label: "Piso",
      visibleByDefault: true,
      methodId,
      data: {
        primitives: [
          {
            id: "floor-slab",
            kind: "box",
            position: [0, 0.2, 0],
            size: [widthM, 0.08, depthM],
            color: colors.floorColor,
          },
        ],
      },
    },
    {
      id: `${methodId}-walls`,
      type: "walls",
      label: "Paredes",
      visibleByDefault: true,
      methodId,
      data: {
        primitives: [
          {
            id: "front-wall",
            kind: "box",
            position: [0, totalHeightM / 2 + 0.24, -depthM / 2],
            size: [widthM, totalHeightM, wallThicknessM],
            color: colors.wallColor,
          },
          {
            id: "rear-wall",
            kind: "box",
            position: [0, totalHeightM / 2 + 0.24, depthM / 2],
            size: [widthM, totalHeightM, wallThicknessM],
            color: colors.wallColor,
          },
          {
            id: "left-wall",
            kind: "box",
            position: [-widthM / 2, totalHeightM / 2 + 0.24, 0],
            size: [wallThicknessM, totalHeightM, depthM],
            color: colors.wallColor,
          },
          {
            id: "right-wall",
            kind: "box",
            position: [widthM / 2, totalHeightM / 2 + 0.24, 0],
            size: [wallThicknessM, totalHeightM, depthM],
            color: colors.wallColor,
          },
        ],
      },
    },
    {
      id: `${methodId}-roof`,
      type: "roof",
      label: "Cobertura",
      visibleByDefault: true,
      methodId,
      data: {
        primitives: [
          {
            id: "simple-roof",
            kind: "box",
            position: [0, totalHeightM + 0.38, 0],
            size: [widthM + roofOverhangM * 2, 0.16, depthM + roofOverhangM * 2],
            color: colors.roofColor,
          },
        ],
      },
    },
    {
      id: `${methodId}-openings`,
      type: "openings",
      label: "Aberturas",
      visibleByDefault: true,
      methodId,
      data: {
        primitives: [
          {
            id: "front-door-placeholder",
            kind: "box",
            label: "Porta",
            position: [-widthM * 0.2, 1.25, -depthM / 2 - wallThicknessM / 2],
            size: [0.9, 2.1, 0.05],
            color: "#1f2937",
            opacity: 0.62,
          },
          {
            id: "front-window-placeholder",
            kind: "box",
            label: "Janela",
            position: [widthM * 0.23, 1.55, -depthM / 2 - wallThicknessM / 2],
            size: [1.3, 1, 0.05],
            color: "#38bdf8",
            opacity: 0.58,
          },
        ],
        notes: ["Aberturas simplificadas para leitura volumetrica inicial."],
      },
    },
  ];
}
