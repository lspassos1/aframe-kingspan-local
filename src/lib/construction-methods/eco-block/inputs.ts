import type { EcoBlockInputs } from "./types";

export const defaultEcoBlockInputs: EcoBlockInputs = {
  widthM: 8,
  depthM: 12,
  floorHeightM: 2.8,
  blockLengthM: 0.25,
  blockHeightM: 0.125,
  blockWidthM: 0.125,
  blocksPerM2: 64,
  useType: "infill",
  finishType: "exposed",
  groutingEnabled: false,
  verticalRebarEnabled: false,
  horizontalRebarEnabled: false,
  doorCount: 2,
  doorWidthM: 0.8,
  doorHeightM: 2.1,
  windowCount: 4,
  windowWidthM: 1.2,
  windowHeightM: 1,
  baseWaterproofingEnabled: true,
  foundationType: "placeholder",
  specializedLabor: true,
  wastePercent: 10,
};

export function normalizeEcoBlockInputs(inputs: unknown): EcoBlockInputs {
  const source = typeof inputs === "object" && inputs !== null && !Array.isArray(inputs) ? (inputs as Partial<EcoBlockInputs>) : {};

  return {
    ...defaultEcoBlockInputs,
    ...source,
    widthM: positiveNumber(source.widthM, defaultEcoBlockInputs.widthM),
    depthM: positiveNumber(source.depthM, defaultEcoBlockInputs.depthM),
    floorHeightM: positiveNumber(source.floorHeightM, defaultEcoBlockInputs.floorHeightM),
    blockLengthM: positiveNumber(source.blockLengthM, defaultEcoBlockInputs.blockLengthM),
    blockHeightM: positiveNumber(source.blockHeightM, defaultEcoBlockInputs.blockHeightM),
    blockWidthM: positiveNumber(source.blockWidthM, defaultEcoBlockInputs.blockWidthM),
    blocksPerM2: positiveNumber(source.blocksPerM2, defaultEcoBlockInputs.blocksPerM2),
    doorCount: Math.max(0, Math.round(source.doorCount ?? defaultEcoBlockInputs.doorCount)),
    doorWidthM: positiveNumber(source.doorWidthM, defaultEcoBlockInputs.doorWidthM),
    doorHeightM: positiveNumber(source.doorHeightM, defaultEcoBlockInputs.doorHeightM),
    windowCount: Math.max(0, Math.round(source.windowCount ?? defaultEcoBlockInputs.windowCount)),
    windowWidthM: positiveNumber(source.windowWidthM, defaultEcoBlockInputs.windowWidthM),
    windowHeightM: positiveNumber(source.windowHeightM, defaultEcoBlockInputs.windowHeightM),
    wastePercent: Math.max(0, source.wastePercent ?? defaultEcoBlockInputs.wastePercent),
  };
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
