import type { ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";
import type { EcoBlockGeometry } from "./types";
import { normalizeEcoBlockInputs } from "./inputs";
import { calculateEcoBlockWarnings } from "./warnings";

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function calculateEcoBlockGeometry({ scenario }: ConstructionMethodCalculationContext): EcoBlockGeometry {
  const inputs = normalizeEcoBlockInputs(scenario.methodInputs?.["eco-block"]);
  const perimeterM = 2 * (inputs.widthM + inputs.depthM);
  const builtAreaM2 = inputs.widthM * inputs.depthM;
  const grossWallAreaM2 = perimeterM * inputs.floorHeightM;
  const openingsAreaM2 = inputs.doorCount * inputs.doorWidthM * inputs.doorHeightM + inputs.windowCount * inputs.windowWidthM * inputs.windowHeightM;
  const netWallAreaM2 = Math.max(0, grossWallAreaM2 - openingsAreaM2);
  const wasteMultiplier = 1 + inputs.wastePercent / 100;
  const reinforcementEnabled = inputs.groutingEnabled || inputs.verticalRebarEnabled || inputs.horizontalRebarEnabled;
  const specialBlockRate = reinforcementEnabled ? 0.12 : 0.06;
  const verticalBars = inputs.verticalRebarEnabled ? Math.ceil(perimeterM / 1.2) : 0;
  const horizontalRows = inputs.horizontalRebarEnabled ? Math.max(1, Math.ceil(inputs.floorHeightM / 0.8)) : 0;

  return {
    widthM: round(inputs.widthM),
    depthM: round(inputs.depthM),
    floorHeightM: round(inputs.floorHeightM),
    perimeterM: round(perimeterM),
    builtAreaM2: round(builtAreaM2),
    grossWallAreaM2: round(grossWallAreaM2),
    openingsAreaM2: round(openingsAreaM2),
    netWallAreaM2: round(netWallAreaM2),
    totalBlocks: Math.ceil(netWallAreaM2 * inputs.blocksPerM2 * wasteMultiplier),
    specialBlocks: Math.ceil(netWallAreaM2 * inputs.blocksPerM2 * specialBlockRate * wasteMultiplier),
    adhesiveMortarKg: round(netWallAreaM2 * 3.2 * wasteMultiplier),
    groutM3: inputs.groutingEnabled ? round(netWallAreaM2 * inputs.blockWidthM * 0.08 * wasteMultiplier, 3) : 0,
    verticalSteelKg: inputs.verticalRebarEnabled ? round(verticalBars * inputs.floorHeightM * 0.888 * wasteMultiplier) : 0,
    horizontalSteelKg: inputs.horizontalRebarEnabled ? round(horizontalRows * perimeterM * 0.888 * wasteMultiplier) : 0,
    baseWaterproofingM2: inputs.baseWaterproofingEnabled ? round(perimeterM * Math.max(inputs.blockWidthM, 0.2) * wasteMultiplier) : 0,
    plasterAreaM2: inputs.finishType === "plastered" ? round(netWallAreaM2 * 2 * wasteMultiplier) : 0,
    warnings: calculateEcoBlockWarnings(inputs),
  };
}
