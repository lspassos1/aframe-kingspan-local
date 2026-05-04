import type { MonolithicEpsInputs } from "./types";

export const defaultMonolithicEpsInputs: MonolithicEpsInputs = {
  widthM: 8,
  depthM: 12,
  floorHeightM: 2.8,
  epsCoreThicknessM: 0.08,
  renderThicknessPerFaceM: 0.03,
  finalWallThicknessM: 0.14,
  panelWidthM: 1.2,
  panelHeightM: 2.8,
  useType: "infill",
  foundationType: "radier",
  starterBarsEnabled: true,
  openingReinforcementEnabled: true,
  doorCount: 2,
  doorWidthM: 0.8,
  doorHeightM: 2.1,
  windowCount: 4,
  windowWidthM: 1.2,
  windowHeightM: 1,
  projectionEquipmentRequired: true,
  specializedLaborRequired: true,
  finalFinish: false,
  wastePercent: 10,
};

export function normalizeMonolithicEpsInputs(inputs: unknown): MonolithicEpsInputs {
  const source = typeof inputs === "object" && inputs !== null && !Array.isArray(inputs) ? (inputs as Partial<MonolithicEpsInputs>) : {};
  const epsCoreThicknessM = positiveNumber(source.epsCoreThicknessM, defaultMonolithicEpsInputs.epsCoreThicknessM);
  const renderThicknessPerFaceM = positiveNumber(source.renderThicknessPerFaceM, defaultMonolithicEpsInputs.renderThicknessPerFaceM);

  return {
    ...defaultMonolithicEpsInputs,
    ...source,
    widthM: positiveNumber(source.widthM, defaultMonolithicEpsInputs.widthM),
    depthM: positiveNumber(source.depthM, defaultMonolithicEpsInputs.depthM),
    floorHeightM: positiveNumber(source.floorHeightM, defaultMonolithicEpsInputs.floorHeightM),
    epsCoreThicknessM,
    renderThicknessPerFaceM,
    finalWallThicknessM: positiveNumber(source.finalWallThicknessM, epsCoreThicknessM + renderThicknessPerFaceM * 2),
    panelWidthM: positiveNumber(source.panelWidthM, defaultMonolithicEpsInputs.panelWidthM),
    panelHeightM: positiveNumber(source.panelHeightM, defaultMonolithicEpsInputs.panelHeightM),
    doorCount: Math.max(0, Math.round(source.doorCount ?? defaultMonolithicEpsInputs.doorCount)),
    doorWidthM: positiveNumber(source.doorWidthM, defaultMonolithicEpsInputs.doorWidthM),
    doorHeightM: positiveNumber(source.doorHeightM, defaultMonolithicEpsInputs.doorHeightM),
    windowCount: Math.max(0, Math.round(source.windowCount ?? defaultMonolithicEpsInputs.windowCount)),
    windowWidthM: positiveNumber(source.windowWidthM, defaultMonolithicEpsInputs.windowWidthM),
    windowHeightM: positiveNumber(source.windowHeightM, defaultMonolithicEpsInputs.windowHeightM),
    wastePercent: Math.max(0, source.wastePercent ?? defaultMonolithicEpsInputs.wastePercent),
  };
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
