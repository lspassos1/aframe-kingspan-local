import type { AppWarning } from "@/types/project";

export type ConventionalMasonryBlockType = "ceramic" | "concrete";
export type ConventionalMasonryFoundationType = "radier" | "baldrame" | "placeholder";
export type ConventionalMasonryRoofType = "simple-roof" | "slab" | "placeholder";

export interface ConventionalMasonryInputs {
  widthM: number;
  depthM: number;
  floors: number;
  floorHeightM: number;
  internalWallLengthM: number;
  blockType: ConventionalMasonryBlockType;
  wallThicknessM: number;
  doorCount: number;
  doorWidthM: number;
  doorHeightM: number;
  windowCount: number;
  windowWidthM: number;
  windowHeightM: number;
  foundationType: ConventionalMasonryFoundationType;
  roofType: ConventionalMasonryRoofType;
  internalPlaster: boolean;
  externalPlaster: boolean;
  subfloor: boolean;
  basicFinish: boolean;
  wastePercent: number;
}

export interface ConventionalMasonryGeometry {
  widthM: number;
  depthM: number;
  floors: number;
  floorHeightM: number;
  builtAreaM2: number;
  perimeterM: number;
  externalWallGrossAreaM2: number;
  internalWallGrossAreaM2: number;
  openingsAreaM2: number;
  netMasonryAreaM2: number;
  blocksPerM2: number;
  totalBlocks: number;
  layingMortarM3: number;
  internalPlasterAreaM2: number;
  externalPlasterAreaM2: number;
  subfloorAreaM2: number;
  warnings: AppWarning[];
}
