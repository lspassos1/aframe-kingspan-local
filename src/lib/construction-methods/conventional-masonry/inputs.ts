import type { ConventionalMasonryInputs } from "./types";

export const defaultConventionalMasonryInputs: ConventionalMasonryInputs = {
  widthM: 8,
  depthM: 12,
  floors: 1,
  floorHeightM: 2.8,
  internalWallLengthM: 20,
  blockType: "ceramic",
  wallThicknessM: 0.14,
  doorCount: 2,
  doorWidthM: 0.8,
  doorHeightM: 2.1,
  windowCount: 4,
  windowWidthM: 1.2,
  windowHeightM: 1,
  foundationType: "placeholder",
  roofType: "simple-roof",
  internalPlaster: true,
  externalPlaster: true,
  subfloor: true,
  basicFinish: false,
  wastePercent: 10,
};

export function normalizeConventionalMasonryInputs(inputs: unknown): ConventionalMasonryInputs {
  const source = typeof inputs === "object" && inputs !== null && !Array.isArray(inputs) ? (inputs as Partial<ConventionalMasonryInputs>) : {};

  return {
    ...defaultConventionalMasonryInputs,
    ...source,
    widthM: positiveNumber(source.widthM, defaultConventionalMasonryInputs.widthM),
    depthM: positiveNumber(source.depthM, defaultConventionalMasonryInputs.depthM),
    floors: Math.max(1, Math.round(positiveNumber(source.floors, defaultConventionalMasonryInputs.floors))),
    floorHeightM: positiveNumber(source.floorHeightM, defaultConventionalMasonryInputs.floorHeightM),
    internalWallLengthM: Math.max(0, source.internalWallLengthM ?? defaultConventionalMasonryInputs.internalWallLengthM),
    wallThicknessM: positiveNumber(source.wallThicknessM, defaultConventionalMasonryInputs.wallThicknessM),
    doorCount: Math.max(0, Math.round(source.doorCount ?? defaultConventionalMasonryInputs.doorCount)),
    doorWidthM: positiveNumber(source.doorWidthM, defaultConventionalMasonryInputs.doorWidthM),
    doorHeightM: positiveNumber(source.doorHeightM, defaultConventionalMasonryInputs.doorHeightM),
    windowCount: Math.max(0, Math.round(source.windowCount ?? defaultConventionalMasonryInputs.windowCount)),
    windowWidthM: positiveNumber(source.windowWidthM, defaultConventionalMasonryInputs.windowWidthM),
    windowHeightM: positiveNumber(source.windowHeightM, defaultConventionalMasonryInputs.windowHeightM),
    wastePercent: Math.max(0, source.wastePercent ?? defaultConventionalMasonryInputs.wastePercent),
  };
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
