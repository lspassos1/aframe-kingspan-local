import type { ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";
import type { ConventionalMasonryGeometry } from "./types";
import { normalizeConventionalMasonryInputs } from "./inputs";
import { calculateConventionalMasonryWarnings } from "./warnings";

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function calculateConventionalMasonryGeometry({ scenario }: ConstructionMethodCalculationContext): ConventionalMasonryGeometry {
  const inputs = normalizeConventionalMasonryInputs(scenario.methodInputs?.["conventional-masonry"]);
  const builtAreaM2 = inputs.widthM * inputs.depthM * inputs.floors;
  const perimeterM = 2 * (inputs.widthM + inputs.depthM);
  const externalWallGrossAreaM2 = perimeterM * inputs.floorHeightM * inputs.floors;
  const internalWallGrossAreaM2 = inputs.internalWallLengthM * inputs.floorHeightM * inputs.floors;
  const openingsAreaM2 = inputs.doorCount * inputs.doorWidthM * inputs.doorHeightM + inputs.windowCount * inputs.windowWidthM * inputs.windowHeightM;
  const netMasonryAreaM2 = Math.max(0, externalWallGrossAreaM2 + internalWallGrossAreaM2 - openingsAreaM2);
  const blocksPerM2 = inputs.blockType === "ceramic" ? 16 : 12.5;
  const wasteMultiplier = 1 + inputs.wastePercent / 100;
  const internalPlasterAreaM2 = inputs.internalPlaster ? Math.max(0, externalWallGrossAreaM2 + internalWallGrossAreaM2 * 2 - openingsAreaM2) : 0;
  const externalPlasterAreaM2 = inputs.externalPlaster ? Math.max(0, externalWallGrossAreaM2 - openingsAreaM2) : 0;

  return {
    widthM: round(inputs.widthM),
    depthM: round(inputs.depthM),
    floors: inputs.floors,
    floorHeightM: round(inputs.floorHeightM),
    builtAreaM2: round(builtAreaM2),
    perimeterM: round(perimeterM),
    externalWallGrossAreaM2: round(externalWallGrossAreaM2),
    internalWallGrossAreaM2: round(internalWallGrossAreaM2),
    openingsAreaM2: round(openingsAreaM2),
    netMasonryAreaM2: round(netMasonryAreaM2),
    blocksPerM2,
    totalBlocks: Math.ceil(netMasonryAreaM2 * blocksPerM2 * wasteMultiplier),
    layingMortarM3: round(netMasonryAreaM2 * 0.018 * wasteMultiplier, 3),
    internalPlasterAreaM2: round(internalPlasterAreaM2 * wasteMultiplier),
    externalPlasterAreaM2: round(externalPlasterAreaM2 * wasteMultiplier),
    subfloorAreaM2: inputs.subfloor ? round(inputs.widthM * inputs.depthM * inputs.floors * wasteMultiplier) : 0,
    warnings: calculateConventionalMasonryWarnings(),
  };
}
