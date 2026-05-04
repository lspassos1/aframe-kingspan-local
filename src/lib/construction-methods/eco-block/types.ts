import type { AppWarning } from "@/types/project";

export type EcoBlockUseType = "infill" | "structural-preliminary";
export type EcoBlockFinishType = "exposed" | "plastered";

export interface EcoBlockInputs {
  widthM: number;
  depthM: number;
  floorHeightM: number;
  blockLengthM: number;
  blockHeightM: number;
  blockWidthM: number;
  blocksPerM2: number;
  useType: EcoBlockUseType;
  finishType: EcoBlockFinishType;
  groutingEnabled: boolean;
  verticalRebarEnabled: boolean;
  horizontalRebarEnabled: boolean;
  doorCount: number;
  doorWidthM: number;
  doorHeightM: number;
  windowCount: number;
  windowWidthM: number;
  windowHeightM: number;
  baseWaterproofingEnabled: boolean;
  foundationType: "radier" | "baldrame" | "placeholder";
  specializedLabor: boolean;
  wastePercent: number;
}

export interface EcoBlockGeometry {
  widthM: number;
  depthM: number;
  floorHeightM: number;
  perimeterM: number;
  builtAreaM2: number;
  grossWallAreaM2: number;
  openingsAreaM2: number;
  netWallAreaM2: number;
  totalBlocks: number;
  specialBlocks: number;
  adhesiveMortarKg: number;
  groutM3: number;
  verticalSteelKg: number;
  horizontalSteelKg: number;
  baseWaterproofingM2: number;
  plasterAreaM2: number;
  warnings: AppWarning[];
}
