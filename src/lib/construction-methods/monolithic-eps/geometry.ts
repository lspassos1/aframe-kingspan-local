import type { ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";
import type { MonolithicEpsGeometry } from "./types";
import { normalizeMonolithicEpsInputs } from "./inputs";
import { calculateMonolithicEpsWarnings } from "./warnings";

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function calculateMonolithicEpsGeometry({ scenario }: ConstructionMethodCalculationContext): MonolithicEpsGeometry {
  const inputs = normalizeMonolithicEpsInputs(scenario.methodInputs?.["monolithic-eps"]);
  const perimeterM = 2 * (inputs.widthM + inputs.depthM);
  const builtAreaM2 = inputs.widthM * inputs.depthM;
  const grossPanelAreaM2 = perimeterM * inputs.floorHeightM;
  const openingsAreaM2 = inputs.doorCount * inputs.doorWidthM * inputs.doorHeightM + inputs.windowCount * inputs.windowWidthM * inputs.windowHeightM;
  const netPanelAreaM2 = Math.max(0, grossPanelAreaM2 - openingsAreaM2);
  const panelAreaM2 = inputs.panelWidthM * inputs.panelHeightM;
  const wasteMultiplier = 1 + inputs.wastePercent / 100;
  const openingPerimeterM =
    inputs.doorCount * (inputs.doorWidthM + inputs.doorHeightM * 2) + inputs.windowCount * (inputs.windowWidthM * 2 + inputs.windowHeightM * 2);

  return {
    widthM: round(inputs.widthM),
    depthM: round(inputs.depthM),
    floorHeightM: round(inputs.floorHeightM),
    perimeterM: round(perimeterM),
    builtAreaM2: round(builtAreaM2),
    grossPanelAreaM2: round(grossPanelAreaM2),
    openingsAreaM2: round(openingsAreaM2),
    netPanelAreaM2: round(netPanelAreaM2),
    panelAreaM2: round(panelAreaM2),
    panelCount: Math.ceil((netPanelAreaM2 / Math.max(0.01, panelAreaM2)) * wasteMultiplier),
    renderVolumeM3: round(netPanelAreaM2 * inputs.renderThicknessPerFaceM * 2 * wasteMultiplier, 3),
    meshAreaM2: round(netPanelAreaM2 * 2 * wasteMultiplier),
    connectorCount: Math.ceil(netPanelAreaM2 * 4 * wasteMultiplier),
    starterBars: inputs.starterBarsEnabled ? Math.ceil(perimeterM / 0.4) : 0,
    openingReinforcementM: inputs.openingReinforcementEnabled ? round(openingPerimeterM * wasteMultiplier) : 0,
    warnings: calculateMonolithicEpsWarnings(inputs),
  };
}
