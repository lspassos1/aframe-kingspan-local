import type { Scenario } from "@/types/project";
import type { Construction3DLayer, ConstructionMethodId, ConstructionMethodInputs } from "@/lib/construction-methods/types";
import type { ManualOpeningWallSide, ManualTakeoffOpening } from "@/lib/takeoff/manual-stepper";

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
const manualOpeningSides: ManualOpeningWallSide[] = ["front", "rear", "left", "right"];

function readNumber(inputs: ConstructionMethodInputs | undefined, key: string, fallback: number) {
  const value = inputs && key in inputs ? (inputs as Record<string, unknown>)[key] : undefined;

  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function openingWallLength(side: ManualOpeningWallSide, widthM: number, depthM: number) {
  return side === "front" || side === "rear" ? widthM : depthM;
}

function openingPosition(side: ManualOpeningWallSide, alongWallM: number, widthM: number, depthM: number, wallThicknessM: number): [number, number] {
  const faceOffsetM = wallThicknessM / 2 + 0.045;
  switch (side) {
    case "rear":
      return [alongWallM, depthM / 2 + faceOffsetM];
    case "left":
      return [-widthM / 2 - faceOffsetM, alongWallM];
    case "right":
      return [widthM / 2 + faceOffsetM, alongWallM];
    case "front":
    default:
      return [alongWallM, -depthM / 2 - faceOffsetM];
  }
}

function openingSize(side: ManualOpeningWallSide, openingWidthM: number, openingHeightM: number): [number, number, number] {
  return side === "front" || side === "rear" ? [openingWidthM, openingHeightM, 0.06] : [0.06, openingHeightM, openingWidthM];
}

function openingCenterAlongWall(offsetM: number, openingWidthM: number, wallLengthM: number) {
  const halfOpeningM = openingWidthM / 2;
  return clamp(-wallLengthM / 2 + offsetM, -wallLengthM / 2 + halfOpeningM, wallLengthM / 2 - halfOpeningM);
}

function readFiniteNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeOpeningSide(value: unknown): ManualOpeningWallSide {
  return manualOpeningSides.includes(value as ManualOpeningWallSide) ? (value as ManualOpeningWallSide) : "front";
}

function sanitizeOpeningQuantity(value: unknown) {
  return Math.min(12, Math.max(0, Math.round(readFiniteNumber(value, 0))));
}

function countOpeningQuantity(value: unknown) {
  return Math.max(0, Math.round(readFiniteNumber(value, 0)));
}

function getManualOpeningTotals(openings: ManualTakeoffOpening[] | undefined) {
  return (openings ?? []).reduce(
    (totals, opening) => {
      const quantity = countOpeningQuantity(opening.quantity);
      if (opening.kind === "door") return { ...totals, doorCount: totals.doorCount + quantity };
      if (opening.kind === "window") return { ...totals, windowCount: totals.windowCount + quantity };
      return totals;
    },
    { doorCount: 0, windowCount: 0 }
  );
}

function createManualOpeningPrimitives(openings: ManualTakeoffOpening[] | undefined, widthM: number, depthM: number, wallThicknessM: number) {
  if (!openings?.length) return [];

  return openings.flatMap((opening) => {
    const side = sanitizeOpeningSide(opening.wallSide);
    const wallLengthM = openingWallLength(side, widthM, depthM);
    const openingWidthM = clamp(readFiniteNumber(opening.widthM, opening.kind === "door" ? 0.8 : 1.2), 0.1, Math.max(0.1, wallLengthM));
    const openingHeightM = clamp(readFiniteNumber(opening.heightM, opening.kind === "door" ? 2.1 : 1), 0.1, 5);
    const offsetM = clamp(readFiniteNumber(opening.offsetM, 0), 0, wallLengthM);
    const sillHeightM = opening.kind === "window" ? clamp(readFiniteNumber(opening.sillHeightM, 1.1), 0, 3) : 0;
    const renderCount = sanitizeOpeningQuantity(opening.quantity);
    const spacingM = openingWidthM + 0.35;
    return Array.from({ length: renderCount }).map((_, index) => {
      const alongWallM = openingCenterAlongWall(offsetM + index * spacingM, openingWidthM, wallLengthM);
      const [x, z] = openingPosition(side, alongWallM, widthM, depthM, wallThicknessM);
      const baseY = 0.24 + sillHeightM;
      return {
        id: `manual-${opening.kind}-${opening.id}-${index + 1}`,
        kind: "box" as const,
        label: opening.kind === "door" ? "Porta" : "Janela",
        position: [x, baseY + openingHeightM / 2, z] as [number, number, number],
        size: openingSize(side, openingWidthM, openingHeightM),
        color: opening.kind === "door" ? "#1f2937" : "#38bdf8",
        opacity: opening.kind === "door" ? 0.66 : 0.58,
      };
    });
  });
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
  const methodWallThicknessM = readNumber(inputs, "blockWidthM", readNumber(inputs, "finalWallThicknessM", 0.15));
  const wallThicknessM = readNumber(inputs, "wallThicknessM", methodWallThicknessM);
  const totalHeightM = floorHeightM * floors;
  const terrainWidthM = Math.max(scenario.terrain.width, widthM + 4);
  const terrainDepthM = Math.max(scenario.terrain.depth, depthM + 4);
  const roofOverhangM = 0.35;
  const buildableWidthM = Math.max(0.2, scenario.terrain.width - scenario.terrain.leftSetback - scenario.terrain.rightSetback);
  const buildableDepthM = Math.max(0.2, scenario.terrain.depth - scenario.terrain.frontSetback - scenario.terrain.rearSetback);
  const manualOpenings = scenario.manualTakeoff?.openings;
  const hasManualOpeningData = Array.isArray(manualOpenings);
  const manualOpeningPrimitives = createManualOpeningPrimitives(manualOpenings, widthM, depthM, wallThicknessM);
  const openingTotals = hasManualOpeningData ? getManualOpeningTotals(manualOpenings) : { doorCount: 1, windowCount: 1 };
  const openingPrimitives: Construction3DLayer["data"]["primitives"] =
    hasManualOpeningData
      ? manualOpeningPrimitives
      : [
          {
            id: "front-door-placeholder",
            kind: "box" as const,
            label: "Porta",
            position: [-widthM * 0.2, 1.25, -depthM / 2 - wallThicknessM / 2] as [number, number, number],
            size: [0.9, 2.1, 0.05] as [number, number, number],
            color: "#1f2937",
            opacity: 0.62,
          },
          {
            id: "front-window-placeholder",
            kind: "box" as const,
            label: "Janela",
            position: [widthM * 0.23, 1.55, -depthM / 2 - wallThicknessM / 2] as [number, number, number],
            size: [1.3, 1, 0.05] as [number, number, number],
            color: "#38bdf8",
            opacity: 0.58,
          },
        ];
  const openingNotes =
    hasManualOpeningData
      ? [
          manualOpeningPrimitives.length > 0
            ? "Aberturas manuais posicionadas de forma aproximada por parede e afastamento; validar em projeto tecnico."
            : "Aberturas manuais sem unidades renderizaveis; revisar quantidades antes de usar o 3D como referencia.",
          ...(manualOpenings.some((opening) => readFiniteNumber(opening.quantity, 0) > 12) ? ["Render limitado a 12 unidades por grupo para manter o modelo leve."] : []),
        ]
      : ["Aberturas simplificadas para leitura volumetrica inicial."];

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
          {
            id: "buildable-area",
            kind: "box",
            label: "Area implantavel",
            position: [(scenario.terrain.leftSetback - scenario.terrain.rightSetback) / 2, 0.02, (scenario.terrain.frontSetback - scenario.terrain.rearSetback) / 2],
            size: [buildableWidthM, 0.04, buildableDepthM],
            color: "#f59e0b",
            opacity: 0.42,
            wireframe: true,
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
        primitives: openingPrimitives,
        notes: openingNotes,
        openingTotals,
      },
    },
  ];
}
