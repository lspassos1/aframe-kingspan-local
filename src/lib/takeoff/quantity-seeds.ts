import type { PlanExtractResult, PlanExtractQuantitySeed } from "@/lib/ai/plan-extract-schema";
import { calculateScenarioGeometry } from "@/lib/construction-methods/scenario-calculations";
import type { ConstructionMethodId } from "@/lib/construction-methods";
import { calculateManualTakeoffMetrics, createManualTakeoffStateFromData, type ManualOpeningKind, type ManualTakeoffOpening, type ManualTakeoffState } from "@/lib/takeoff/manual-stepper";
import type { Project, Scenario } from "@/types/project";

export type QuantitySeedCategory =
  | "foundation"
  | "walls"
  | "openings"
  | "flooring"
  | "finishes"
  | "roof"
  | "electrical"
  | "plumbing"
  | "structure"
  | "external";

export type QuantitySeedUnit = "m" | "m2" | "m3" | "un" | "kg";

export type QuantitySeedSource = "ai_visible" | "system_calculated" | "rule_estimated" | "user_confirmed" | "manual";

export type QuantitySeedConfidence = "high" | "medium" | "low";

export interface QuantitySeed {
  id: string;
  scenarioId?: string;
  constructionMethod?: ConstructionMethodId;
  category: QuantitySeedCategory;
  description: string;
  quantity: number;
  unit: QuantitySeedUnit;
  source: QuantitySeedSource;
  confidence: QuantitySeedConfidence;
  requiresReview: boolean;
  evidence?: string;
  pendingReason?: string;
  notes: string;
}

export interface TakeoffRoomInput {
  id?: string;
  name?: string;
  type?: string;
  areaM2?: number;
  wetArea?: boolean;
}

export interface TakeoffOpeningInput {
  doorCount?: number;
  windowCount?: number;
  doorWidthM?: number;
  doorHeightM?: number;
  windowWidthM?: number;
  windowHeightM?: number;
}

export interface TakeoffFixtureInput {
  toilets?: number;
  sinks?: number;
  showers?: number;
  faucets?: number;
  tanks?: number;
}

export interface TakeoffSeedInput {
  scenarioId?: string;
  constructionMethod?: ConstructionMethodId;
  widthM?: number;
  depthM?: number;
  builtAreaM2?: number;
  footprintAreaM2?: number;
  floors?: number;
  floorHeightM?: number;
  perimeterM?: number;
  externalWallAreaM2?: number;
  internalWallLengthM?: number;
  externalAreaM2?: number;
  roofAreaM2?: number;
  roofHasPlan?: boolean;
  structureVisible?: boolean;
  structureAreaM2?: number;
  rooms?: TakeoffRoomInput[];
  openings?: TakeoffOpeningInput;
  fixtures?: TakeoffFixtureInput;
  electricalPointCount?: number;
  electricalEstimated?: boolean;
  plumbingPointCount?: number;
  plumbingEstimated?: boolean;
  source: Extract<QuantitySeedSource, "system_calculated" | "manual" | "ai_visible">;
}

const defaultFloorHeightM = 2.8;
const defaultDoorWidthM = 0.8;
const defaultDoorHeightM = 2.1;
const defaultWindowWidthM = 1.2;
const defaultWindowHeightM = 1;
const defaultRoofSlopeFactor = 1.15;
const defaultRoofEaveFactor = 1.08;
const defaultBaseboardFactorMPerM2 = 0.85;
const defaultWetWallTileAreaM2PerRoom = 14;

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function positive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function nonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function addSeed(seeds: QuantitySeed[], seed: QuantitySeed) {
  if (!Number.isFinite(seed.quantity) || seed.quantity <= 0) return;
  seeds.push({ ...seed, quantity: round(seed.quantity) });
}

function countFixturePoints(fixtures: TakeoffFixtureInput | undefined) {
  if (!fixtures) return 0;
  return [fixtures.toilets, fixtures.sinks, fixtures.showers, fixtures.faucets, fixtures.tanks].reduce<number>((total, value) => total + (nonNegative(value) ?? 0), 0);
}

function valueNumber(extracted: { value: unknown } | undefined) {
  return positive(extracted?.value);
}

function valueBoolean(extracted: { value: unknown } | undefined) {
  return typeof extracted?.value === "boolean" ? extracted.value : undefined;
}

function normalizeRoomType(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isWetRoom(room: TakeoffRoomInput) {
  if (room.wetArea !== undefined) return room.wetArea;
  const normalized = normalizeRoomType(`${room.type ?? ""} ${room.name ?? ""}`);
  return ["banheiro", "lavabo", "cozinha", "lavanderia", "area de servico", "servico"].some((token) => normalized.includes(token));
}

function estimateElectricalPoints(rooms: TakeoffRoomInput[], builtAreaM2: number) {
  if (rooms.length === 0) {
    return Math.max(1, Math.ceil(builtAreaM2 / 8));
  }

  return rooms.reduce((total, room) => {
    const normalized = normalizeRoomType(`${room.type ?? ""} ${room.name ?? ""}`);
    if (normalized.includes("banheiro") || normalized.includes("lavabo")) return total + 4;
    if (normalized.includes("cozinha")) return total + 12;
    if (normalized.includes("lavanderia") || normalized.includes("servico")) return total + 6;
    if (normalized.includes("sala")) return total + 10;
    if (normalized.includes("quarto")) return total + 6;
    return total + 5;
  }, 0);
}

function estimatePlumbingPoints(rooms: TakeoffRoomInput[]) {
  return rooms.reduce((total, room) => {
    const normalized = normalizeRoomType(`${room.type ?? ""} ${room.name ?? ""}`);
    if (normalized.includes("banheiro") || normalized.includes("lavabo")) return total + 6;
    if (normalized.includes("cozinha")) return total + 2;
    if (normalized.includes("lavanderia") || normalized.includes("servico")) return total + 4;
    return total + (isWetRoom(room) ? 2 : 0);
  }, 0);
}

function getOpeningMetrics(openings: TakeoffOpeningInput | undefined) {
  const doorCount = nonNegative(openings?.doorCount) ?? 0;
  const windowCount = nonNegative(openings?.windowCount) ?? 0;
  const doorAreaM2 = doorCount * (positive(openings?.doorWidthM) ?? defaultDoorWidthM) * (positive(openings?.doorHeightM) ?? defaultDoorHeightM);
  const windowAreaM2 = windowCount * (positive(openings?.windowWidthM) ?? defaultWindowWidthM) * (positive(openings?.windowHeightM) ?? defaultWindowHeightM);

  return { doorCount, windowCount, doorAreaM2, windowAreaM2, openingsAreaM2: doorAreaM2 + windowAreaM2 };
}

export function generateTakeoffQuantitySeeds(input: TakeoffSeedInput): QuantitySeed[] {
  const widthM = positive(input.widthM);
  const depthM = positive(input.depthM);
  const floors = Math.max(1, Math.round(positive(input.floors) ?? 1));
  const floorHeightM = positive(input.floorHeightM) ?? defaultFloorHeightM;
  const builtAreaM2 = positive(input.builtAreaM2) ?? (widthM && depthM ? widthM * depthM * floors : undefined);
  const footprintAreaM2 = positive(input.footprintAreaM2) ?? (widthM && depthM ? widthM * depthM : builtAreaM2 ? builtAreaM2 / floors : undefined);
  const perimeterM = positive(input.perimeterM) ?? (widthM && depthM ? 2 * (widthM + depthM) : undefined);
  const rooms = input.rooms ?? [];
  const wetRoomCount = rooms.filter(isWetRoom).length;
  const openingMetrics = getOpeningMetrics(input.openings);
  const externalWallGrossAreaM2 = positive(input.externalWallAreaM2) ?? (perimeterM ? perimeterM * floorHeightM * floors : undefined);
  const internalWallGrossAreaM2 = positive(input.internalWallLengthM) ? input.internalWallLengthM! * floorHeightM * floors : undefined;
  const wallGrossAreaM2 = (externalWallGrossAreaM2 ?? 0) + (internalWallGrossAreaM2 ?? 0);
  const wallNetAreaM2 = wallGrossAreaM2 > 0 ? Math.max(0, wallGrossAreaM2 - openingMetrics.openingsAreaM2) : undefined;
  const roofAreaM2 = positive(input.roofAreaM2) ?? (footprintAreaM2 ? footprintAreaM2 * defaultRoofSlopeFactor * defaultRoofEaveFactor : undefined);
  const externalAreaM2 = positive(input.externalAreaM2);
  const fixturePointCount = countFixturePoints(input.fixtures);
  const baseMeta = {
    scenarioId: input.scenarioId,
    constructionMethod: input.constructionMethod,
    requiresReview: true,
  };
  const seeds: QuantitySeed[] = [];

  if (footprintAreaM2) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-foundation-footprint`,
      category: "foundation",
      description: "Fundacao preliminar pela projecao da edificacao",
      quantity: footprintAreaM2,
      unit: "m2",
      source: "rule_estimated",
      confidence: "low",
      pendingReason: "Confirmar tipo de fundacao com responsavel tecnico antes do orcamento.",
      notes: "Nao dimensiona fundacao; usa a projecao como base revisavel.",
    });
  }

  if (externalWallGrossAreaM2) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-external-walls-area`,
      category: "walls",
      description: "Area preliminar de paredes externas",
      quantity: externalWallGrossAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      evidence: perimeterM ? `Perimetro ${round(perimeterM)} m x pe-direito ${round(floorHeightM)} m x ${floors} pavimento(s).` : undefined,
      notes: "Area externa bruta antes de descontos completos.",
    });
  }

  if (internalWallGrossAreaM2) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-internal-walls-area`,
      category: "walls",
      description: "Area preliminar de paredes internas",
      quantity: internalWallGrossAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      evidence: `${round(input.internalWallLengthM ?? 0)} m de paredes internas x pe-direito ${round(floorHeightM)} m x ${floors} pavimento(s).`,
      notes: "Area interna bruta antes de descontos completos.",
    });
  }

  if (wallGrossAreaM2 > 0) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-walls-gross-area`,
      category: "walls",
      description: "Area bruta preliminar de paredes",
      quantity: wallGrossAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      evidence: perimeterM ? `Perimetro ${round(perimeterM)} m x pe-direito ${round(floorHeightM)} m x ${floors} pavimento(s).` : undefined,
      notes: "Area bruta antes de descontos completos.",
    });
  }

  if (wallNetAreaM2) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-walls-net-area`,
      category: "walls",
      description: "Area liquida preliminar de paredes",
      quantity: wallNetAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      evidence: `Desconta ${round(openingMetrics.openingsAreaM2)} m2 de portas e janelas.`,
      notes: "Desconto usa medidas padrao quando a planta nao informa dimensoes das aberturas.",
    });
  }

  if (builtAreaM2) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-flooring-area`,
      category: "flooring",
      description: "Area preliminar de piso",
      quantity: builtAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      notes: "Base para piso e contrapiso preliminares.",
    });
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-subfloor-area`,
      category: "flooring",
      description: "Area preliminar de contrapiso",
      quantity: builtAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      notes: "Usa area construida como base revisavel para contrapiso.",
    });
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-ceiling-area`,
      category: "finishes",
      description: "Area preliminar de teto ou forro",
      quantity: builtAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      notes: "Usa area construida como base revisavel para teto/forro.",
    });
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-baseboard-length`,
      category: "finishes",
      description: "Rodape preliminar por area construida",
      quantity: builtAreaM2 * defaultBaseboardFactorMPerM2,
      unit: "m",
      source: "rule_estimated",
      confidence: "low",
      pendingReason: "Confirmar perimetro de ambientes e padrao de rodape.",
      notes: "Estimativa por fator preliminar; editar por ambiente quando disponivel.",
    });
  }

  if (wallNetAreaM2) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-wall-finishes-area`,
      category: "finishes",
      description: "Area preliminar de revestimento ou pintura de paredes",
      quantity: wallNetAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      notes: "Acabamento especifico depende de selecao do usuario.",
    });
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-internal-plaster-area`,
      category: "finishes",
      description: "Reboco interno preliminar",
      quantity: internalWallGrossAreaM2 ?? wallNetAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      notes: "Area revisavel para revestimento interno de paredes.",
    });
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-external-plaster-area`,
      category: "finishes",
      description: "Reboco externo preliminar",
      quantity: externalWallGrossAreaM2 ?? wallNetAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      notes: "Area revisavel para revestimento externo de fachadas.",
    });
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-internal-paint-area`,
      category: "finishes",
      description: "Pintura interna preliminar",
      quantity: internalWallGrossAreaM2 ?? wallNetAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      notes: "Area revisavel; descontar revestimentos ceramicos e aberturas quando confirmados.",
    });
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-external-paint-area`,
      category: "finishes",
      description: "Pintura externa preliminar",
      quantity: externalWallGrossAreaM2 ?? wallNetAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      notes: "Area revisavel; depende do sistema de fachada confirmado.",
    });
  }

  if (wetRoomCount > 0) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-wet-wall-tile-area`,
      category: "finishes",
      description: "Revestimento de areas molhadas preliminar",
      quantity: wetRoomCount * defaultWetWallTileAreaM2PerRoom,
      unit: "m2",
      source: "rule_estimated",
      confidence: "low",
      pendingReason: "Confirmar altura e paredes revestidas nas areas molhadas.",
      notes: "Estimativa por ambiente molhado; nao substitui memorial de acabamento.",
    });
  }

  if (openingMetrics.doorCount > 0) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-doors-count`,
      category: "openings",
      description: "Quantidade preliminar de portas",
      quantity: openingMetrics.doorCount,
      unit: "un",
      source: input.source,
      confidence: "medium",
      notes: "Medidas devem ser revisadas antes de comprar esquadrias.",
    });
  }

  if (openingMetrics.windowCount > 0) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-windows-count`,
      category: "openings",
      description: "Quantidade preliminar de janelas",
      quantity: openingMetrics.windowCount,
      unit: "un",
      source: input.source,
      confidence: "medium",
      notes: "Medidas devem ser revisadas antes de comprar esquadrias.",
    });
  }

  if (roofAreaM2) {
    const source = input.roofAreaM2 || input.roofHasPlan ? input.source : "rule_estimated";
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-roof-area`,
      category: "roof",
      description: "Area preliminar de cobertura",
      quantity: roofAreaM2,
      unit: "m2",
      source,
      confidence: source === "rule_estimated" ? "low" : "medium",
      pendingReason: source === "rule_estimated" ? "Confirmar tipo de cobertura, inclinacao e beirais." : undefined,
      notes: source === "rule_estimated" ? "Usa fator preliminar sobre a projecao." : "Usa area de cobertura informada ou calculada.",
    });
  }

  if (input.structureVisible && (positive(input.structureAreaM2) ?? footprintAreaM2)) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-structure-preliminary`,
      category: "structure",
      description: "Estrutura preliminar visivel na planta",
      quantity: positive(input.structureAreaM2) ?? footprintAreaM2!,
      unit: "m2",
      source: "rule_estimated",
      confidence: "low",
      pendingReason: "Estrutura exige revisao tecnica; a IA nao dimensiona pilares, vigas ou lajes.",
      notes: "Seed apenas reserva revisao de estrutura quando ha indicio visual.",
    });
  }

  if (builtAreaM2) {
    const manualElectricalPoints = nonNegative(input.electricalPointCount);
    const electricalPoints = manualElectricalPoints ?? estimateElectricalPoints(rooms, builtAreaM2);
    const electricalEstimated = input.electricalEstimated ?? manualElectricalPoints === undefined;
    const electricalSource = electricalEstimated ? "rule_estimated" : input.source;
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-electrical-points`,
      category: "electrical",
      description: electricalEstimated ? "Pontos eletricos estimados por media" : "Pontos eletricos informados manualmente",
      quantity: electricalPoints,
      unit: "un",
      source: electricalSource,
      confidence: electricalEstimated ? "low" : "medium",
      pendingReason: electricalEstimated ? "Confirmar se existe projeto eletrico ou se a media por ambiente pode ser usada." : "Confirmar pontos antes do orcamento revisado.",
      notes: electricalEstimated ? "Estimativa editavel por ambiente; nao substitui projeto eletrico." : "Quantidade informada no preenchimento manual; nao substitui projeto eletrico.",
    });
  }

  const manualPlumbingPoints = nonNegative(input.plumbingPointCount);
  const plumbingPoints = manualPlumbingPoints ?? estimatePlumbingPoints(rooms);
  if (plumbingPoints > 0) {
    const plumbingEstimated = input.plumbingEstimated ?? manualPlumbingPoints === undefined;
    const plumbingSource = plumbingEstimated ? "rule_estimated" : input.source;
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-plumbing-points`,
      category: "plumbing",
      description: plumbingEstimated ? "Pontos hidraulicos estimados por areas molhadas" : "Pontos hidraulicos informados manualmente",
      quantity: plumbingPoints,
      unit: "un",
      source: plumbingSource,
      confidence: plumbingEstimated ? "low" : "medium",
      pendingReason: plumbingEstimated ? "Confirmar projeto hidraulico ou premissas por area molhada." : "Confirmar pontos antes do orcamento revisado.",
      notes: plumbingEstimated
        ? `${wetRoomCount} ambiente(s) molhado(s) detectado(s). Nao substitui projeto hidraulico.`
        : "Quantidade informada no preenchimento manual; nao substitui projeto hidraulico.",
    });
  }

  const fixtureQuantity = fixturePointCount || wetRoomCount * 3;
  if (fixtureQuantity > 0) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-fixtures-metals`,
      category: "plumbing",
      description: "Loucas e metais preliminares",
      quantity: fixtureQuantity,
      unit: "un",
      source: fixturePointCount ? input.source : "rule_estimated",
      confidence: fixturePointCount ? "medium" : "low",
      pendingReason: "Confirmar lista de loucas, metais e pontos hidraulicos.",
      notes: fixturePointCount ? "Quantidade vinda de itens identificados." : "Estimativa por ambientes molhados.",
    });
  }

  if (externalAreaM2) {
    addSeed(seeds, {
      ...baseMeta,
      id: `${input.scenarioId ?? "takeoff"}-external-area`,
      category: "external",
      description: "Areas externas preliminares",
      quantity: externalAreaM2,
      unit: "m2",
      source: input.source,
      confidence: "medium",
      notes: "Area externa revisavel para piso, paisagismo ou acesso.",
    });
  }

  return seeds;
}

function countManualOpenings(openings: ManualTakeoffOpening[], kind: ManualOpeningKind) {
  return openings.filter((opening) => opening.kind === kind).reduce((total, opening) => total + opening.quantity, 0);
}

function averageManualOpeningDimension(openings: ManualTakeoffOpening[], kind: ManualOpeningKind, key: "widthM" | "heightM", fallback: number) {
  const matching = openings.filter((opening) => opening.kind === kind);
  const totalQuantity = matching.reduce((total, opening) => total + opening.quantity, 0);
  if (totalQuantity <= 0) return fallback;
  return round(matching.reduce((total, opening) => total + opening[key] * opening.quantity, 0) / totalQuantity, 2);
}

function equivalentNumber(current: number | undefined, manual: number, tolerance = 0.01) {
  return current === undefined || Math.abs(current - manual) <= tolerance;
}

function isManualTakeoffCurrentForScenario(state: ManualTakeoffState, scenario: Scenario, liveInput: TakeoffSeedInput) {
  const manualMetrics = calculateManualTakeoffMetrics(state);
  const terrainMatches =
    equivalentNumber(scenario.terrain.width, state.lotWidthM) &&
    equivalentNumber(scenario.terrain.depth, state.lotDepthM) &&
    equivalentNumber(scenario.terrain.frontSetback, state.frontSetbackM) &&
    equivalentNumber(scenario.terrain.rearSetback, state.rearSetbackM) &&
    equivalentNumber(scenario.terrain.leftSetback, state.leftSetbackM) &&
    equivalentNumber(scenario.terrain.rightSetback, state.rightSetbackM);

  if (!terrainMatches) return false;

  const manualDoorCount = countManualOpenings(state.openings, "door");
  const manualWindowCount = countManualOpenings(state.openings, "window");
  const sharedMatches =
    equivalentNumber(liveInput.depthM, state.buildingDepthM) &&
    equivalentNumber(liveInput.floors, state.floors) &&
    equivalentNumber(liveInput.internalWallLengthM, state.internalWallLengthM) &&
    equivalentNumber(liveInput.openings?.doorCount, manualDoorCount) &&
    equivalentNumber(liveInput.openings?.windowCount, manualWindowCount);

  if (scenario.constructionMethod === "aframe") {
    const aFrameAreaMatches =
      equivalentNumber(liveInput.widthM, state.buildingWidthM) &&
      equivalentNumber(liveInput.floorHeightM, state.floorHeightM) &&
      equivalentNumber(liveInput.builtAreaM2, manualMetrics.builtAreaM2, 0.5) &&
      equivalentNumber(liveInput.footprintAreaM2, manualMetrics.footprintAreaM2, 0.5) &&
      equivalentNumber(liveInput.roofAreaM2, manualMetrics.roofAreaM2, 0.5);

    return sharedMatches && aFrameAreaMatches;
  }

  return sharedMatches && equivalentNumber(liveInput.widthM, state.buildingWidthM) && equivalentNumber(liveInput.floorHeightM, state.floorHeightM);
}

function createTakeoffSeedInputFromManualState(
  state: ManualTakeoffState,
  scenario: Scenario
): TakeoffSeedInput {
  const metrics = calculateManualTakeoffMetrics(state);
  return {
    scenarioId: scenario.id,
    constructionMethod: scenario.constructionMethod,
    widthM: state.buildingWidthM,
    depthM: state.buildingDepthM,
    builtAreaM2: metrics.builtAreaM2,
    footprintAreaM2: metrics.footprintAreaM2,
    floors: state.floors,
    floorHeightM: state.floorHeightM,
    perimeterM: state.externalWallLengthM,
    internalWallLengthM: state.internalWallLengthM,
    externalAreaM2: Math.max(0, state.lotWidthM * state.lotDepthM - metrics.footprintAreaM2),
    roofAreaM2: metrics.roofAreaM2,
    roofHasPlan: state.roofType !== "a_confirmar",
    structureVisible: false,
    rooms: state.rooms.map((room) => ({ id: room.id, name: room.name, type: room.type, areaM2: room.areaM2, wetArea: room.wetArea })),
    openings: {
      doorCount: countManualOpenings(state.openings, "door"),
      windowCount: countManualOpenings(state.openings, "window"),
      doorWidthM: averageManualOpeningDimension(state.openings, "door", "widthM", defaultDoorWidthM),
      doorHeightM: averageManualOpeningDimension(state.openings, "door", "heightM", defaultDoorHeightM),
      windowWidthM: averageManualOpeningDimension(state.openings, "window", "widthM", defaultWindowWidthM),
      windowHeightM: averageManualOpeningDimension(state.openings, "window", "heightM", defaultWindowHeightM),
    },
    fixtures: {
      toilets: state.rooms.filter((room) => room.type === "bathroom").length,
      sinks: state.rooms.filter((room) => room.wetArea).length,
      showers: state.rooms.filter((room) => room.type === "bathroom").length,
      faucets: state.rooms.filter((room) => room.wetArea).length,
    },
    electricalPointCount: metrics.electricalPoints,
    electricalEstimated: state.electricalEstimated,
    plumbingPointCount: metrics.plumbingPoints,
    plumbingEstimated: state.plumbingEstimated,
    source: "manual",
  };
}

function createLiveTakeoffSeedInputFromScenario(project: Project, scenario: Scenario): TakeoffSeedInput {
  const geometry = calculateScenarioGeometry(project, scenario) as Record<string, unknown>;
  const methodInputs = (scenario.methodInputs?.[scenario.constructionMethod] ?? {}) as Record<string, unknown>;
  const aFrameFallback = scenario.constructionMethod === "aframe" ? scenario.aFrame : undefined;
  const widthM = positive(geometry.widthM) ?? positive(geometry.baseWidth);
  const depthM = positive(geometry.depthM) ?? positive(geometry.effectiveHouseDepth) ?? positive(aFrameFallback?.houseDepth);
  const builtAreaM2 = positive(geometry.builtAreaM2) ?? positive(geometry.combinedTotalArea) ?? positive(geometry.groundFloorTotalArea);
  const footprintAreaM2 = positive(geometry.footprintAreaM2) ?? (widthM && depthM ? widthM * depthM : undefined);
  const floorHeightM = positive(geometry.floorHeightM) ?? positive(methodInputs.floorHeightM) ?? positive(aFrameFallback?.minimumUsefulHeight);
  const floors = positive(geometry.floors) ?? positive(methodInputs.floors) ?? (positive(geometry.upperFloorTotalArea) ? 2 : 1);

  return {
    scenarioId: scenario.id,
    constructionMethod: scenario.constructionMethod,
    widthM,
    depthM,
    builtAreaM2,
    footprintAreaM2,
    floors,
    floorHeightM,
    perimeterM: positive(geometry.perimeterM) ?? (widthM && depthM ? 2 * (widthM + depthM) : undefined),
    externalWallAreaM2:
      positive(geometry.externalWallGrossAreaM2) ?? positive(geometry.externalPanelAreaM2) ?? positive(geometry.totalFacadeArea),
    internalWallLengthM: nonNegative(methodInputs.internalWallLengthM),
    roofAreaM2: positive(geometry.roofAreaM2) ?? positive(geometry.roofInclinedArea),
    openings: {
      doorCount: nonNegative(methodInputs.doorCount),
      windowCount: nonNegative(methodInputs.windowCount),
      doorWidthM: positive(methodInputs.doorWidthM),
      doorHeightM: positive(methodInputs.doorHeightM),
      windowWidthM: positive(methodInputs.windowWidthM),
      windowHeightM: positive(methodInputs.windowHeightM),
    },
    rooms: [],
    source: "system_calculated",
  };
}

export function createTakeoffSeedInputFromScenario(project: Project, scenario: Scenario): TakeoffSeedInput {
  const liveInput = createLiveTakeoffSeedInputFromScenario(project, scenario);

  if (scenario.manualTakeoff) {
    const manualState = createManualTakeoffStateFromData(scenario.manualTakeoff, {
      projectName: project.name,
      address: scenario.location.address,
      city: scenario.location.city,
      state: scenario.location.state,
      country: scenario.location.country,
      lotWidthM: scenario.terrain.width,
      lotDepthM: scenario.terrain.depth,
      frontSetbackM: scenario.terrain.frontSetback,
      rearSetbackM: scenario.terrain.rearSetback,
      leftSetbackM: scenario.terrain.leftSetback,
      rightSetbackM: scenario.terrain.rightSetback,
    });

    if (isManualTakeoffCurrentForScenario(manualState, scenario, liveInput)) {
      return createTakeoffSeedInputFromManualState(manualState, scenario);
    }
  }

  return liveInput;
}

export function generateScenarioQuantitySeeds(project: Project, scenario: Scenario) {
  return generateTakeoffQuantitySeeds(createTakeoffSeedInputFromScenario(project, scenario));
}

export function createTakeoffSeedInputFromPlanExtract(
  result: PlanExtractResult,
  defaults: { scenarioId?: string; constructionMethod?: ConstructionMethodId } = {}
): TakeoffSeedInput {
  const planFloors = valueNumber(result.building?.floors) ?? positive(result.extracted.floors) ?? 1;
  const planFloorHeightM = valueNumber(result.building?.floorHeightM) ?? positive(result.extracted.floorHeightM) ?? defaultFloorHeightM;
  const rooms =
    result.rooms?.map<TakeoffRoomInput>((room) => ({
      id: room.id,
      name: typeof room.name?.value === "string" ? room.name.value : undefined,
      type: typeof room.type?.value === "string" ? room.type.value : undefined,
      areaM2: valueNumber(room.areaM2),
      wetArea: valueBoolean(room.wetArea),
    })) ?? [];

  return {
    scenarioId: defaults.scenarioId,
    constructionMethod: result.extracted.constructionMethod ?? defaults.constructionMethod,
    widthM: valueNumber(result.building?.widthM) ?? positive(result.extracted.houseWidthM),
    depthM: valueNumber(result.building?.depthM) ?? positive(result.extracted.houseDepthM),
    builtAreaM2: valueNumber(result.building?.builtAreaM2) ?? positive(result.extracted.builtAreaM2),
    footprintAreaM2: valueNumber(result.building?.footprintAreaM2),
    floors: planFloors,
    floorHeightM: planFloorHeightM,
    perimeterM: valueNumber(result.building?.perimeterM),
    externalWallAreaM2: valueNumber(result.walls?.externalLengthM)
      ? valueNumber(result.walls?.externalLengthM)! * planFloorHeightM * planFloors
      : valueNumber(result.walls?.grossAreaM2),
    internalWallLengthM: valueNumber(result.walls?.internalLengthM),
    externalAreaM2: valueNumber(result.exterior?.pavedAreaM2) ?? valueNumber(result.exterior?.drivewayAreaM2),
    roofAreaM2: valueNumber(result.roof?.roofAreaM2),
    roofHasPlan: valueBoolean(result.roof?.hasRoofPlan),
    structureVisible: Boolean(result.structure?.visibleSystem || result.structure?.structuralElementsVisible?.length),
    structureAreaM2: valueNumber(result.building?.footprintAreaM2) ?? valueNumber(result.building?.builtAreaM2),
    rooms,
    openings: {
      doorCount: valueNumber(result.openings?.doorCount) ?? positive(result.extracted.doorCount),
      windowCount: valueNumber(result.openings?.windowCount) ?? positive(result.extracted.windowCount),
    },
    fixtures: {
      toilets: valueNumber(result.fixtures?.toilets),
      sinks: valueNumber(result.fixtures?.sinks),
      showers: valueNumber(result.fixtures?.showers),
      faucets: valueNumber(result.fixtures?.faucets),
      tanks: valueNumber(result.fixtures?.tanks),
    },
    source: "ai_visible",
  };
}

export function generatePlanExtractQuantitySeeds(
  result: PlanExtractResult,
  defaults: { scenarioId?: string; constructionMethod?: ConstructionMethodId } = {}
) {
  const generated = generateTakeoffQuantitySeeds(createTakeoffSeedInputFromPlanExtract(result, defaults));
  const provided = (result.quantitySeeds ?? []).map((seed) => normalizePlanExtractQuantitySeed(seed, defaults));
  return [...generated, ...provided];
}

function normalizePlanExtractQuantitySeed(
  seed: PlanExtractQuantitySeed,
  defaults: { scenarioId?: string; constructionMethod?: ConstructionMethodId }
): QuantitySeed {
  const source = seed.source;
  return {
    id: seed.id,
    scenarioId: defaults.scenarioId,
    constructionMethod: defaults.constructionMethod,
    category: seed.category,
    description: seed.description,
    quantity: round(seed.quantity),
    unit: seed.unit,
    source,
    confidence: seed.confidence,
    requiresReview: true,
    evidence: seed.evidence,
    pendingReason: seed.pendingReason ?? (seed.confidence === "low" || source === "rule_estimated" ? "Revisar quantitativo antes do orcamento." : undefined),
    notes: seed.notes,
  };
}
