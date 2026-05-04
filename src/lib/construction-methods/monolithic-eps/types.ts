import type { AppWarning } from "@/types/project";

export type MonolithicEpsUseType = "infill" | "structural-preliminary";

export interface MonolithicEpsInputs {
  widthM: number;
  depthM: number;
  floorHeightM: number;
  epsCoreThicknessM: number;
  renderThicknessPerFaceM: number;
  finalWallThicknessM: number;
  panelWidthM: number;
  panelHeightM: number;
  useType: MonolithicEpsUseType;
  foundationType: "radier" | "baldrame" | "placeholder";
  starterBarsEnabled: boolean;
  openingReinforcementEnabled: boolean;
  doorCount: number;
  doorWidthM: number;
  doorHeightM: number;
  windowCount: number;
  windowWidthM: number;
  windowHeightM: number;
  projectionEquipmentRequired: boolean;
  specializedLaborRequired: boolean;
  finalFinish: boolean;
  wastePercent: number;
}

export interface MonolithicEpsGeometry {
  widthM: number;
  depthM: number;
  floorHeightM: number;
  perimeterM: number;
  builtAreaM2: number;
  grossPanelAreaM2: number;
  openingsAreaM2: number;
  netPanelAreaM2: number;
  panelAreaM2: number;
  panelCount: number;
  renderVolumeM3: number;
  meshAreaM2: number;
  connectorCount: number;
  starterBars: number;
  openingReinforcementM: number;
  warnings: AppWarning[];
}
