import type { Project, Scenario, StructuralInputs } from "@/types/project";
import { accessories } from "./accessories";
import { customMaterials } from "./customMaterials";
import { panelFinishes, panelProducts } from "./panels";
import { steelProfiles } from "./steelProfiles";
import { steelPriceSources } from "./steelPriceSources";
import { suppliers } from "./suppliers";

const defaultStructuralInputs: StructuralInputs = {
  location: "Cruz das Almas, Bahia",
  basicWindSpeedMS: 30,
  terrainCategory: "A confirmar pelo engenheiro",
  topographicFactor: 1,
  importanceFactor: 1,
  internalPressure: "A confirmar conforme aberturas e NBR 6123",
  panelSelfWeightKNM2: 0.105,
  steelSelfWeightAllowanceKNM2: 0.08,
  mezzanineDeadLoadKNM2: 1.5,
  mezzanineLiveLoadKNM2: 2,
  roofMaintenanceLoadKNM2: 0.25,
  solarPanelLoadKNM2: 0,
  ceilingLoadKNM2: 0,
  frameSpacingM: 3,
  purlinSpacingM: 1.5,
  steelGradeFYMPa: 250,
  corrosionProtection: "Pintura anticorrosiva ou galvanizacao a confirmar",
  deflectionLimitRatio: 250,
  safetyMode: "optimized",
  referenceSteelPriceBRLKg: 10.28,
  referenceSteelPriceSourceId: "sinapi-ba-43083-2026-03",
};

type AFrameScenarioSeed = Omit<Scenario, "constructionMethod" | "methodInputs">;

function createAFrameScenario(scenario: AFrameScenarioSeed): Scenario {
  return {
    ...scenario,
    constructionMethod: "aframe",
    methodInputs: {
      aframe: scenario.aFrame,
    },
  };
}

const baseScenario = createAFrameScenario({
  id: "scenario-a",
  name: "Cenario A - 7,5 m, 50 graus",
  location: {
    address: "",
    city: "Cruz das Almas",
    state: "Bahia",
    country: "Brasil",
    postalCode: "",
    notes: "Endereco editavel. Cruz das Almas/BA e apenas o padrao inicial.",
  },
  terrain: {
    width: 17,
    depth: 26,
    frontSide: "width",
    frontSetback: 2,
    rearSetback: 2,
    leftSetback: 1.5,
    rightSetback: 1.5,
  },
  aFrame: {
    panelLength: 7.5,
    panelUsefulWidth: 1,
    panelThickness: 30,
    baseAngleDeg: 50,
    houseDepth: 17.3,
    automaticDepth: false,
    targetGroundUsefulArea: 130,
    upperFloorMode: "full-floor",
    upperFloorLevelHeight: 2.8,
    upperFloorAreaPercent: 100,
    floorBuildUpThickness: 0.18,
    minimumUsefulHeight: 1.5,
    ridgeCapAllowance: 0.12,
    facadeType: "mixed",
    frontOverhang: 0,
    rearOverhang: 0,
    lateralBaseFlashingOffset: 0.05,
  },
  panelProductId: "isotelha-30-750",
  externalColor: "#f7f7f1",
  internalFinish: "#ffffff",
  steelMode: "optimized",
  pricing: {
    source: "Cotacao Kingspan/KingRoofing fornecida pelo usuario",
    supplier: "Kingspan Isoeste / KingRoofing",
    quoteDate: "2025-11-20",
    validDays: 90,
    freightBRL: 0,
    notes: "Frete nao incluso. Atualizar precos por cotacao formal.",
  },
});

export const defaultScenarios: Scenario[] = [
  baseScenario,
  createAFrameScenario({
    ...baseScenario,
    id: "scenario-b",
    name: "Cenario B - 7,5 m, 60 graus, area automatica",
    aFrame: { ...baseScenario.aFrame, baseAngleDeg: 60, automaticDepth: true },
  }),
  createAFrameScenario({
    ...baseScenario,
    id: "scenario-c",
    name: "Cenario C - painel 7,0 m, 50 graus",
    panelProductId: "isotelha-trapezoidal-pir-aco-aco",
    aFrame: { ...baseScenario.aFrame, panelLength: 7, houseDepth: 17.3 },
  }),
  createAFrameScenario({
    ...baseScenario,
    id: "scenario-d",
    name: "Cenario D - painel 30 mm",
    panelProductId: "isotelha-30-750",
    aFrame: { ...baseScenario.aFrame, panelThickness: 30 },
  }),
  createAFrameScenario({
    ...baseScenario,
    id: "scenario-e",
    name: "Cenario E - painel 20 mm",
    panelProductId: "isotelha-20-750",
    aFrame: { ...baseScenario.aFrame, panelThickness: 20 },
  }),
  createAFrameScenario({
    ...baseScenario,
    id: "scenario-f",
    name: "Cenario F - estrutura otimizada",
    steelMode: "optimized",
  }),
  createAFrameScenario({
    ...baseScenario,
    id: "scenario-g",
    name: "Cenario G - estrutura conservadora",
    steelMode: "conservative",
  }),
];

export const defaultProject: Project = {
  id: "aframe-local-project",
  name: "Estudo A-frame - Painel Sanduiche",
  onboardingCompleted: false,
  currency: "BRL",
  selectedScenarioId: "scenario-a",
  scenarios: defaultScenarios,
  panelProducts,
  panelFinishes,
  accessories,
  customMaterials,
  steelProfiles,
  steelPriceSources,
  suppliers,
  structuralInputs: defaultStructuralInputs,
  materialAssumptions: {
    wastePercent: 5,
    sparePanelCount: 0,
    screwsPerPanel: 28.33,
    fixingScrewsPerPanel: 8.33,
    flashingPieceLengthM: 1,
    overlapLengthM: 0.1,
    sealantCoverageM: 8,
    tapeCoverageM: 12.2,
  },
  budgetAssumptions: {
    panelInstallationLaborBRLM2: 0,
    steelAssemblyLaborBRLKg: undefined,
    liftingEquipmentBRL: 0,
    scaffoldingBRL: 0,
    foundationPlaceholderBRL: 0,
    slabPlaceholderBRL: 0,
    drainagePlaceholderBRL: 0,
    frontFacadePlaceholderBRL: 0,
    rearClosurePlaceholderBRL: 0,
    doorsWindowsPlaceholderBRL: 0,
    architectPlaceholderBRL: 0,
    engineerPlaceholderBRL: 0,
    municipalApprovalPlaceholderBRL: 0,
    contingencyPercent: 10,
  },
  foundationAssumptions: {
    type: "radier-fiber",
    enabled: true,
    useHouseFootprint: true,
    extraPerimeterM: 0.4,
    slabThicknessM: 0.12,
    edgeBeamWidthM: 0.25,
    edgeBeamDepthM: 0.3,
    subbaseThicknessM: 0.1,
    concreteUnitPriceBRLM3: 777.24,
    fiberDosageKgM3: 3,
    fiberUnitPriceBRLKg: 28,
    subbaseUnitPriceBRLM3: 335.14,
    vaporBarrierUnitPriceBRLM2: 8,
    formworkUnitPriceBRLM: 42,
    laborUnitPriceBRLM2: 95,
    pumpBRL: 1200,
    soilPrepUnitPriceBRLM2: 18,
    wastePercent: 7,
  },
};
