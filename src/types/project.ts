export type CurrencyCode = "BRL";

export type WarningLevel = "info" | "warning" | "error";

export interface AppWarning {
  id: string;
  level: WarningLevel;
  message: string;
}

export interface LocationData {
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  notes: string;
}

export interface Terrain {
  width: number;
  depth: number;
  frontSide: "width" | "depth";
  frontSetback: number;
  rearSetback: number;
  leftSetback: number;
  rightSetback: number;
}

export interface AFrameInputs {
  panelLength: number;
  panelUsefulWidth: number;
  panelThickness: number;
  baseAngleDeg: number;
  houseDepth: number;
  automaticDepth: boolean;
  targetGroundUsefulArea: number;
  upperFloorMode: "none" | "full-floor" | "mezzanine-percent";
  upperFloorLevelHeight: number;
  upperFloorAreaPercent: number;
  floorBuildUpThickness: number;
  minimumUsefulHeight: number;
  ridgeCapAllowance: number;
  facadeType: "open-glass" | "panel-closed" | "mixed" | "placeholder";
  frontOverhang: number;
  rearOverhang: number;
  lateralBaseFlashingOffset: number;
}

export interface PricingMeta {
  source: string;
  supplier: string;
  quoteDate: string;
  validDays: number;
  freightBRL: number;
  notes: string;
}

export interface Scenario {
  id: string;
  name: string;
  terrain: Terrain;
  location: LocationData;
  aFrame: AFrameInputs;
  panelProductId: string;
  externalColor: string;
  internalFinish: string;
  steelMode: "optimized" | "conservative";
  pricing: PricingMeta;
}

export interface AFrameGeometry {
  baseWidth: number;
  ridgeHeight: number;
  apexAngleDeg: number;
  effectiveHouseDepth: number;
  groundFloorTotalArea: number;
  deadZoneEachSide: number;
  groundUsefulWidth: number;
  groundUsefulArea: number;
  upperFloorTotalWidth: number;
  upperFloorUsefulWidth: number;
  upperFloorTotalArea: number;
  upperFloorUsefulArea: number;
  upperFloorDepth: number;
  upperFloorAreaPercent: number;
  mezzanineTotalWidth: number;
  mezzanineUsefulWidth: number;
  mezzanineTotalArea: number;
  mezzanineUsefulArea: number;
  combinedTotalArea: number;
  combinedUsefulArea: number;
  houseVolumeApprox: number;
  facadeTriangularArea: number;
  totalFacadeArea: number;
  roofInclinedArea: number;
  clearances: {
    front: number;
    rear: number;
    left: number;
    right: number;
  };
  fitsTerrain: boolean;
  warnings: AppWarning[];
}

export interface PanelFinish {
  id: string;
  label: string;
  color: string;
}

export interface PanelOption {
  id: string;
  label: string;
  value: string | number;
  colorHex?: string;
}

export interface PanelProduct {
  id: string;
  supplier: string;
  productName: string;
  category: string;
  coreType: "PIR" | "PUR" | "EPS" | "rock-wool" | "other";
  thicknessMm: number;
  lengthM: number;
  usefulWidthM: number;
  steelUpperThicknessMm?: number;
  steelLowerThicknessMm?: number;
  externalFinish: string;
  internalFinish: string;
  colorCode: string;
  colorHex: string;
  isCustom?: boolean;
  sourceUrl?: string;
  allowedThicknessMm?: number[];
  allowedLengthsM?: number[];
  externalColorOptions?: PanelOption[];
  internalFinishOptions?: PanelOption[];
  minLengthM?: number;
  maxLengthM?: number;
  lengthStepM?: number;
  constraintsNote?: string;
  weightKgM2?: number;
  thermalValue?: string;
  maxSpanM?: number;
  minimumSlopeDeg?: number;
  pricePerMeterBRL?: number;
  pricePerPanelBRL?: number;
  pricePerM2BRL?: number;
  leadTime?: string;
  freightEstimateBRL?: number;
  notes: string;
}

export interface AccessoryProduct {
  id: string;
  code: string;
  description: string;
  category: MaterialCategory;
  supplier: string;
  defaultUnit: MaterialUnit;
  packageSize?: number;
  pieceLengthM?: number;
  unitPriceBRL?: number;
  quoteQuantity?: number;
  quoteNetTotalBRL?: number;
  requiresConfirmation?: boolean;
  notes: string;
}

export type MaterialCategory =
  | "panels"
  | "fasteners"
  | "flashings"
  | "sealants"
  | "facade"
  | "steel"
  | "civil"
  | "labor"
  | "technical"
  | "freight"
  | "contingency"
  | "other";

export type MaterialUnit = "un" | "m" | "m2" | "m3" | "kg" | "package" | "lot";

export interface MaterialLine {
  id: string;
  code: string;
  description: string;
  category: MaterialCategory;
  supplier: string;
  quantity: number;
  unit: MaterialUnit;
  unitPriceBRL?: number;
  grossTotalBRL: number;
  discountBRL: number;
  netTotalBRL: number;
  wasteIncluded: boolean;
  manualOverride: boolean;
  requiresConfirmation: boolean;
  notes: string;
}

export interface CustomMaterialProduct {
  id: string;
  code: string;
  description: string;
  category: MaterialCategory;
  supplier: string;
  unit: MaterialUnit;
  quantity: number;
  lengthM?: number;
  widthM?: number;
  thicknessMm?: number;
  unitPriceBRL?: number;
  maxLengthM?: number;
  lengthIncrementM?: number;
  externalFinish?: string;
  internalFinish?: string;
  colorHex?: string;
  enabled: boolean;
  notes: string;
}

export interface SteelProfile {
  id: string;
  family: "RHS" | "SHS" | "CHS" | "U" | "C" | "Z" | "I" | "angle" | "flat" | "rod";
  name: string;
  dimensions: string;
  thicknessMm?: number;
  kgPerM: number;
  areaCm2?: number;
  inertiaIxCm4?: number;
  inertiaIyCm4?: number;
  sectionModulusCm3?: number;
  steelGrade: string;
  supplierPriceBRLKg?: number;
  notes: string;
}

export interface SteelPriceSource {
  id: string;
  label: string;
  sourceType: "SINAPI" | "online-retail" | "supplier-catalog" | "manual";
  sourceUrl: string;
  referenceDate: string;
  region: string;
  profileReference: string;
  priceBRLKg?: number;
  priceBRLM?: number;
  priceBRLBar?: number;
  barLengthM?: number;
  weightKgM?: number;
  reliability: "reference" | "quote-required";
  notes: string;
}

export interface StructuralInputs {
  location: string;
  basicWindSpeedMS: number;
  terrainCategory: string;
  topographicFactor: number;
  importanceFactor: number;
  internalPressure: string;
  panelSelfWeightKNM2: number;
  steelSelfWeightAllowanceKNM2: number;
  mezzanineDeadLoadKNM2: number;
  mezzanineLiveLoadKNM2: number;
  roofMaintenanceLoadKNM2: number;
  solarPanelLoadKNM2: number;
  ceilingLoadKNM2: number;
  frameSpacingM: number;
  purlinSpacingM: number;
  steelGradeFYMPa: number;
  corrosionProtection: string;
  deflectionLimitRatio: number;
  safetyMode: "optimized" | "conservative";
  referenceSteelPriceBRLKg?: number;
  referenceSteelPriceSourceId?: string;
}

export interface StructuralMember {
  id: string;
  name: string;
  category: "main-frame" | "purlin" | "ridge" | "bracing" | "mezzanine" | "connection";
  quantity: number;
  lengthM: number;
  totalLengthM: number;
  selectedProfile: SteelProfile;
  assumedLoadKNM?: number;
  tributaryWidthM?: number;
  spanM?: number;
  utilizationRatio?: number;
  deflectionRatio?: number;
  pass: boolean;
  requiresEngineerValidation: boolean;
  notes: string;
}

export interface StructuralEstimate {
  frameCount: number;
  actualFrameSpacingM: number;
  totalSteelKg: number;
  steelKgM2: number;
  estimatedCostBRL: number;
  steelPriceSource?: SteelPriceSource;
  usesReferenceSteelPrice: boolean;
  selectedMainProfile: SteelProfile;
  candidates: Array<{
    profile: SteelProfile;
    utilizationRatio: number;
    deflectionRatio: number;
    pass: boolean;
    reason: string;
  }>;
  members: StructuralMember[];
  warnings: AppWarning[];
}

export interface BudgetItem {
  id: string;
  category: MaterialCategory;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  unitPriceBRL?: number;
  grossTotalBRL: number;
  discountBRL: number;
  netTotalBRL: number;
  supplier: string;
  notes: string;
  requiresConfirmation: boolean;
}

export interface FoundationAssumptions {
  type: "radier-fiber";
  enabled: boolean;
  useHouseFootprint: boolean;
  extraPerimeterM: number;
  slabThicknessM: number;
  edgeBeamWidthM: number;
  edgeBeamDepthM: number;
  subbaseThicknessM: number;
  concreteUnitPriceBRLM3: number;
  fiberDosageKgM3: number;
  fiberUnitPriceBRLKg: number;
  subbaseUnitPriceBRLM3: number;
  vaporBarrierUnitPriceBRLM2: number;
  formworkUnitPriceBRLM: number;
  laborUnitPriceBRLM2: number;
  pumpBRL: number;
  soilPrepUnitPriceBRLM2: number;
  wastePercent: number;
}

export interface FoundationEstimate {
  areaM2: number;
  widthM: number;
  depthM: number;
  perimeterM: number;
  slabConcreteM3: number;
  edgeBeamConcreteM3: number;
  concreteM3: number;
  fiberKg: number;
  subbaseM3: number;
  vaporBarrierM2: number;
  formworkM: number;
  totalBRL: number;
  items: BudgetItem[];
  warnings: AppWarning[];
}

export interface BudgetSummary {
  items: BudgetItem[];
  panelPackageCostBRL: number;
  accessoriesCostBRL: number;
  freightBRL: number;
  steelStructureCostBRL: number;
  civilPlaceholderBRL: number;
  foundationCostBRL: number;
  laborEquipmentBRL: number;
  technicalLegalBRL: number;
  contingencyBRL: number;
  totalEstimatedCostBRL: number;
  costPerTotalM2: number;
  costPerUsefulM2: number;
  costPerGroundUsefulM2: number;
  warnings: AppWarning[];
}

export interface Supplier {
  id: string;
  companyName: string;
  category: "steel-distributor" | "steel-fabricator" | "galvanising-painting" | "panel-supplier" | "accessory-supplier" | "transport-freight" | "other";
  city: string;
  state: string;
  distanceToReferenceKm?: number;
  contactName?: string;
  whatsapp?: string;
  phone?: string;
  email?: string;
  website?: string;
  products: string;
  deliveryAvailability: string;
  notes: string;
}

export interface QuotationRequest {
  id: string;
  title: string;
  supplierCategory: string;
  body: string;
  generatedAt: string;
}

export interface AssemblyDrawing {
  id: string;
  title: string;
  svg: string;
}

export interface ExportReport {
  projectName: string;
  generatedAt: string;
  geometry: AFrameGeometry;
  materials: MaterialLine[];
  budget: BudgetSummary;
  structural: StructuralEstimate;
  warnings: AppWarning[];
}

export interface Project {
  id: string;
  name: string;
  currency: CurrencyCode;
  selectedScenarioId: string;
  scenarios: Scenario[];
  panelProducts: PanelProduct[];
  panelFinishes: PanelFinish[];
  accessories: AccessoryProduct[];
  customMaterials: CustomMaterialProduct[];
  steelProfiles: SteelProfile[];
  steelPriceSources: SteelPriceSource[];
  suppliers: Supplier[];
  structuralInputs: StructuralInputs;
  materialAssumptions: {
    wastePercent: number;
    sparePanelCount: number;
    screwsPerPanel: number;
    fixingScrewsPerPanel: number;
    flashingPieceLengthM: number;
    overlapLengthM: number;
    sealantCoverageM: number;
    tapeCoverageM: number;
  };
  budgetAssumptions: {
    panelInstallationLaborBRLM2: number;
    steelAssemblyLaborBRLKg?: number;
    liftingEquipmentBRL: number;
    scaffoldingBRL: number;
    foundationPlaceholderBRL: number;
    slabPlaceholderBRL: number;
    drainagePlaceholderBRL: number;
    frontFacadePlaceholderBRL: number;
    rearClosurePlaceholderBRL: number;
    doorsWindowsPlaceholderBRL: number;
    architectPlaceholderBRL: number;
    engineerPlaceholderBRL: number;
    municipalApprovalPlaceholderBRL: number;
    contingencyPercent: number;
  };
  foundationAssumptions: FoundationAssumptions;
}
