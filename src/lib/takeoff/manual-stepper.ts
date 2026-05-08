export const manualTakeoffSteps = [
  {
    id: "location",
    label: "Local",
    description: "Cidade, UF e referência da obra.",
  },
  {
    id: "plot",
    label: "Lote",
    description: "Terreno, recuos e implantação simples.",
  },
  {
    id: "rooms",
    label: "Ambientes",
    description: "Área, pavimentos e pé-direito.",
  },
  {
    id: "openings",
    label: "Portas e janelas",
    description: "Contagens e medidas revisáveis.",
  },
  {
    id: "walls",
    label: "Paredes",
    description: "Pé-direito, perímetros e descontos.",
  },
  {
    id: "foundation-roof",
    label: "Fundação e cobertura",
    description: "Premissas preliminares pendentes.",
  },
  {
    id: "mep",
    label: "Elétrica e hidráulica",
    description: "Estimativas por média quando faltar projeto.",
  },
  {
    id: "method",
    label: "Método",
    description: "Sistema construtivo depois das medidas.",
  },
  {
    id: "review",
    label: "Revisão",
    description: "Quantitativos antes do orçamento.",
  },
] as const;

export type ManualTakeoffStepId = (typeof manualTakeoffSteps)[number]["id"];

export function getManualTakeoffStepIndex(stepId: ManualTakeoffStepId) {
  return manualTakeoffSteps.findIndex((step) => step.id === stepId);
}

export function getManualTakeoffStepLabel(stepId: ManualTakeoffStepId) {
  return manualTakeoffSteps[getManualTakeoffStepIndex(stepId)]?.label ?? stepId;
}

export type ManualRoomType = "social" | "bedroom" | "kitchen" | "bathroom" | "service" | "circulation" | "external";
export type ManualFinishLevel = "economico" | "medio" | "superior";
export type ManualFoundationType = "radier" | "baldrame" | "sapatas" | "a_confirmar";
export type ManualRoofType = "telhado_ceramico" | "telhado_metalico" | "laje" | "a_confirmar";
export type ManualOpeningKind = "door" | "window";

export interface ManualTakeoffRoom {
  id: string;
  name: string;
  type: ManualRoomType;
  areaM2: number;
  widthM: number;
  depthM: number;
  floor: number;
  wetArea: boolean;
  finishLevel: ManualFinishLevel;
  electricalPoints: number;
  plumbingPoints: number;
}

export interface ManualTakeoffOpening {
  id: string;
  kind: ManualOpeningKind;
  type: string;
  quantity: number;
  widthM: number;
  heightM: number;
  roomId: string;
  sillHeightM?: number;
  notes: string;
}

export interface ManualTakeoffState {
  projectName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  priceBaseSuggestion: string;
  lotWidthM: number;
  lotDepthM: number;
  frontSetbackM: number;
  rearSetbackM: number;
  leftSetbackM: number;
  rightSetbackM: number;
  buildingWidthM: number;
  buildingDepthM: number;
  floors: number;
  rooms: ManualTakeoffRoom[];
  openings: ManualTakeoffOpening[];
  externalWallLengthM: number;
  internalWallLengthM: number;
  wallThicknessM: number;
  floorHeightM: number;
  discountOpenings: boolean;
  foundationType: ManualFoundationType;
  foundationAreaM2: number;
  roofType: ManualRoofType;
  roofSlopeFactor: number;
  roofEaveM: number;
  electricalEstimated: boolean;
  electricalPoints: number;
  plumbingEstimated: boolean;
  plumbingPoints: number;
}

export interface ManualTakeoffSiteData {
  projectName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  priceBaseSuggestion: string;
  lotWidthM: number;
  lotDepthM: number;
  frontSetbackM: number;
  rearSetbackM: number;
  leftSetbackM: number;
  rightSetbackM: number;
  buildingWidthM: number;
  buildingDepthM: number;
  floors: number;
}

export interface ManualTakeoffWallMetrics {
  externalWallLengthM: number;
  internalWallLengthM: number;
  wallThicknessM: number;
  floorHeightM: number;
  discountOpenings: boolean;
}

export interface ManualTakeoffFoundationRoofAssumptions {
  foundationType: ManualFoundationType;
  foundationAreaM2: number;
  roofType: ManualRoofType;
  roofSlopeFactor: number;
  roofEaveM: number;
}

export interface ManualTakeoffMepAssumptions {
  electricalEstimated: boolean;
  electricalPoints: number;
  plumbingEstimated: boolean;
  plumbingPoints: number;
}

export interface ManualTakeoffProjectData {
  version: 1;
  updatedAt: string;
  source: "manual-stepper";
  site: ManualTakeoffSiteData;
  rooms: ManualTakeoffRoom[];
  openings: ManualTakeoffOpening[];
  wallMetrics: ManualTakeoffWallMetrics;
  foundationRoof: ManualTakeoffFoundationRoofAssumptions;
  mep: ManualTakeoffMepAssumptions;
}

const roomTypeDefaults: Record<ManualRoomType, Pick<ManualTakeoffRoom, "wetArea" | "electricalPoints" | "plumbingPoints">> = {
  social: { wetArea: false, electricalPoints: 10, plumbingPoints: 0 },
  bedroom: { wetArea: false, electricalPoints: 6, plumbingPoints: 0 },
  kitchen: { wetArea: true, electricalPoints: 12, plumbingPoints: 2 },
  bathroom: { wetArea: true, electricalPoints: 4, plumbingPoints: 6 },
  service: { wetArea: true, electricalPoints: 6, plumbingPoints: 4 },
  circulation: { wetArea: false, electricalPoints: 3, plumbingPoints: 0 },
  external: { wetArea: false, electricalPoints: 2, plumbingPoints: 1 },
};

export function createManualTakeoffRoom(
  id: string,
  overrides: Partial<Omit<ManualTakeoffRoom, "id">> = {}
): ManualTakeoffRoom {
  const type = overrides.type ?? "bedroom";
  const defaults = roomTypeDefaults[type];
  const widthM = overrides.widthM ?? 3;
  const depthM = overrides.depthM ?? 3;
  return {
    id,
    name: overrides.name ?? "Ambiente",
    type,
    areaM2: overrides.areaM2 ?? Number((widthM * depthM).toFixed(2)),
    widthM,
    depthM,
    floor: overrides.floor ?? 1,
    wetArea: overrides.wetArea ?? defaults.wetArea,
    finishLevel: overrides.finishLevel ?? "medio",
    electricalPoints: overrides.electricalPoints ?? defaults.electricalPoints,
    plumbingPoints: overrides.plumbingPoints ?? defaults.plumbingPoints,
  };
}

export function createManualTakeoffOpening(
  id: string,
  kind: ManualOpeningKind,
  roomId: string,
  overrides: Partial<Omit<ManualTakeoffOpening, "id" | "kind" | "roomId">> = {}
): ManualTakeoffOpening {
  const isDoor = kind === "door";
  return {
    id,
    kind,
    roomId,
    type: overrides.type ?? (isDoor ? "Madeira interna" : "Janela de correr"),
    quantity: overrides.quantity ?? 1,
    widthM: overrides.widthM ?? (isDoor ? 0.8 : 1.2),
    heightM: overrides.heightM ?? (isDoor ? 2.1 : 1),
    sillHeightM: isDoor ? undefined : (overrides.sillHeightM ?? 1.1),
    notes: overrides.notes ?? "",
  };
}

export function createDefaultManualTakeoffState(input: Partial<ManualTakeoffState> = {}): ManualTakeoffState {
  const buildingWidthM = input.buildingWidthM ?? 8;
  const buildingDepthM = input.buildingDepthM ?? 10;
  const defaultRooms = [
    createManualTakeoffRoom("room-social", { name: "Sala e cozinha", type: "social", areaM2: 28, widthM: 4, depthM: 7, electricalPoints: 12 }),
    createManualTakeoffRoom("room-bedroom", { name: "Quarto", type: "bedroom", areaM2: 12, widthM: 3, depthM: 4 }),
    createManualTakeoffRoom("room-bath", { name: "Banheiro", type: "bathroom", areaM2: 4, widthM: 2, depthM: 2 }),
  ];
  const firstRoomId = defaultRooms[0]?.id ?? "room-social";

  return {
    projectName: input.projectName ?? "Estudo manual",
    address: input.address ?? "",
    city: input.city ?? "",
    state: input.state ?? "",
    country: input.country ?? "Brasil",
    priceBaseSuggestion: input.priceBaseSuggestion ?? "SINAPI da UF ou base importada",
    lotWidthM: input.lotWidthM ?? 12,
    lotDepthM: input.lotDepthM ?? 24,
    frontSetbackM: input.frontSetbackM ?? 3,
    rearSetbackM: input.rearSetbackM ?? 2,
    leftSetbackM: input.leftSetbackM ?? 1.5,
    rightSetbackM: input.rightSetbackM ?? 1.5,
    buildingWidthM,
    buildingDepthM,
    floors: input.floors ?? 1,
    rooms: input.rooms ?? defaultRooms,
    openings:
      input.openings ??
      [
        createManualTakeoffOpening("door-entry", "door", firstRoomId, { type: "Porta de entrada", quantity: 1, widthM: 0.9 }),
        createManualTakeoffOpening("window-social", "window", firstRoomId, { quantity: 2, widthM: 1.2, heightM: 1 }),
      ],
    externalWallLengthM: input.externalWallLengthM ?? Number((2 * (buildingWidthM + buildingDepthM)).toFixed(2)),
    internalWallLengthM: input.internalWallLengthM ?? 18,
    wallThicknessM: input.wallThicknessM ?? 0.14,
    floorHeightM: input.floorHeightM ?? 2.8,
    discountOpenings: input.discountOpenings ?? true,
    foundationType: input.foundationType ?? "a_confirmar",
    foundationAreaM2: input.foundationAreaM2 ?? Number((buildingWidthM * buildingDepthM).toFixed(2)),
    roofType: input.roofType ?? "a_confirmar",
    roofSlopeFactor: input.roofSlopeFactor ?? 1.18,
    roofEaveM: input.roofEaveM ?? 0.5,
    electricalEstimated: input.electricalEstimated ?? true,
    electricalPoints: input.electricalPoints ?? 0,
    plumbingEstimated: input.plumbingEstimated ?? true,
    plumbingPoints: input.plumbingPoints ?? 0,
  };
}

function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeRoomType(value: unknown, fallback: ManualRoomType): ManualRoomType {
  return ["social", "bedroom", "kitchen", "bathroom", "service", "circulation", "external"].includes(String(value))
    ? (value as ManualRoomType)
    : fallback;
}

function normalizeFinishLevel(value: unknown, fallback: ManualFinishLevel): ManualFinishLevel {
  return ["economico", "medio", "superior"].includes(String(value)) ? (value as ManualFinishLevel) : fallback;
}

function normalizeOpeningKind(value: unknown, fallback: ManualOpeningKind): ManualOpeningKind {
  return value === "door" || value === "window" ? value : fallback;
}

function normalizeFoundationType(value: unknown, fallback: ManualFoundationType): ManualFoundationType {
  return ["radier", "baldrame", "sapatas", "a_confirmar"].includes(String(value)) ? (value as ManualFoundationType) : fallback;
}

function normalizeRoofType(value: unknown, fallback: ManualRoofType): ManualRoofType {
  return ["telhado_ceramico", "telhado_metalico", "laje", "a_confirmar"].includes(String(value)) ? (value as ManualRoofType) : fallback;
}

export function normalizeManualTakeoffRoom(room: Partial<ManualTakeoffRoom> | undefined, index = 0): ManualTakeoffRoom {
  const fallback = createManualTakeoffRoom(`room-${index + 1}`);
  const type = normalizeRoomType(room?.type, fallback.type);
  const defaults = roomTypeDefaults[type];
  const widthM = normalizeNumber(room?.widthM, fallback.widthM);
  const depthM = normalizeNumber(room?.depthM, fallback.depthM);
  return {
    id: normalizeText(room?.id, fallback.id),
    name: normalizeText(room?.name, fallback.name),
    type,
    areaM2: normalizeNumber(room?.areaM2, Number((widthM * depthM).toFixed(2))),
    widthM,
    depthM,
    floor: Math.max(1, Math.round(normalizeNumber(room?.floor, fallback.floor))),
    wetArea: normalizeBoolean(room?.wetArea, defaults.wetArea),
    finishLevel: normalizeFinishLevel(room?.finishLevel, fallback.finishLevel),
    electricalPoints: Math.max(0, Math.round(normalizeNumber(room?.electricalPoints, defaults.electricalPoints))),
    plumbingPoints: Math.max(0, Math.round(normalizeNumber(room?.plumbingPoints, defaults.plumbingPoints))),
  };
}

export function normalizeManualTakeoffOpening(
  opening: Partial<ManualTakeoffOpening> | undefined,
  roomIds: string[],
  index = 0
): ManualTakeoffOpening {
  const kind = normalizeOpeningKind(opening?.kind, "door");
  const fallback = createManualTakeoffOpening(`${kind}-${index + 1}`, kind, roomIds[0] ?? "room-social");
  const roomId = roomIds.includes(String(opening?.roomId)) ? String(opening?.roomId) : fallback.roomId;
  return {
    id: normalizeText(opening?.id, fallback.id),
    kind,
    type: normalizeText(opening?.type, fallback.type),
    quantity: Math.max(0, Math.round(normalizeNumber(opening?.quantity, fallback.quantity))),
    widthM: normalizeNumber(opening?.widthM, fallback.widthM),
    heightM: normalizeNumber(opening?.heightM, fallback.heightM),
    roomId,
    sillHeightM: kind === "window" ? normalizeNumber(opening?.sillHeightM, fallback.sillHeightM ?? 1.1) : undefined,
    notes: normalizeText(opening?.notes, ""),
  };
}

export function createManualTakeoffDataFromState(
  state: ManualTakeoffState,
  updatedAt = new Date().toISOString()
): ManualTakeoffProjectData {
  return {
    version: 1,
    updatedAt,
    source: "manual-stepper",
    site: {
      projectName: state.projectName,
      address: state.address,
      city: state.city,
      state: state.state,
      country: state.country,
      priceBaseSuggestion: state.priceBaseSuggestion,
      lotWidthM: state.lotWidthM,
      lotDepthM: state.lotDepthM,
      frontSetbackM: state.frontSetbackM,
      rearSetbackM: state.rearSetbackM,
      leftSetbackM: state.leftSetbackM,
      rightSetbackM: state.rightSetbackM,
      buildingWidthM: state.buildingWidthM,
      buildingDepthM: state.buildingDepthM,
      floors: state.floors,
    },
    rooms: state.rooms.map((room, index) => normalizeManualTakeoffRoom(room, index)),
    openings: state.openings.map((opening, index) => normalizeManualTakeoffOpening(opening, state.rooms.map((room) => room.id), index)),
    wallMetrics: {
      externalWallLengthM: state.externalWallLengthM,
      internalWallLengthM: state.internalWallLengthM,
      wallThicknessM: state.wallThicknessM,
      floorHeightM: state.floorHeightM,
      discountOpenings: state.discountOpenings,
    },
    foundationRoof: {
      foundationType: state.foundationType,
      foundationAreaM2: state.foundationAreaM2,
      roofType: state.roofType,
      roofSlopeFactor: state.roofSlopeFactor,
      roofEaveM: state.roofEaveM,
    },
    mep: {
      electricalEstimated: state.electricalEstimated,
      electricalPoints: state.electricalPoints,
      plumbingEstimated: state.plumbingEstimated,
      plumbingPoints: state.plumbingPoints,
    },
  };
}

export function createManualTakeoffStateFromData(
  data: Partial<ManualTakeoffProjectData> | undefined,
  fallback: Partial<ManualTakeoffState> = {}
): ManualTakeoffState {
  const base = createDefaultManualTakeoffState(fallback);
  const site = data?.site;
  const wallMetrics = data?.wallMetrics;
  const foundationRoof = data?.foundationRoof;
  const mep = data?.mep;
  const rooms = data?.rooms?.length ? data.rooms.map(normalizeManualTakeoffRoom) : base.rooms;
  const roomIds = rooms.map((room) => room.id);
  const openings = data?.openings?.length ? data.openings.map((opening, index) => normalizeManualTakeoffOpening(opening, roomIds, index)) : base.openings;

  return {
    ...base,
    projectName: normalizeText(site?.projectName, base.projectName),
    address: normalizeText(site?.address, base.address),
    city: normalizeText(site?.city, base.city),
    state: normalizeText(site?.state, base.state),
    country: normalizeText(site?.country, base.country),
    priceBaseSuggestion: normalizeText(site?.priceBaseSuggestion, base.priceBaseSuggestion),
    lotWidthM: normalizeNumber(site?.lotWidthM, base.lotWidthM),
    lotDepthM: normalizeNumber(site?.lotDepthM, base.lotDepthM),
    frontSetbackM: normalizeNumber(site?.frontSetbackM, base.frontSetbackM),
    rearSetbackM: normalizeNumber(site?.rearSetbackM, base.rearSetbackM),
    leftSetbackM: normalizeNumber(site?.leftSetbackM, base.leftSetbackM),
    rightSetbackM: normalizeNumber(site?.rightSetbackM, base.rightSetbackM),
    buildingWidthM: normalizeNumber(site?.buildingWidthM, base.buildingWidthM),
    buildingDepthM: normalizeNumber(site?.buildingDepthM, base.buildingDepthM),
    floors: Math.max(1, Math.round(normalizeNumber(site?.floors, base.floors))),
    rooms,
    openings,
    externalWallLengthM: normalizeNumber(wallMetrics?.externalWallLengthM, base.externalWallLengthM),
    internalWallLengthM: normalizeNumber(wallMetrics?.internalWallLengthM, base.internalWallLengthM),
    wallThicknessM: normalizeNumber(wallMetrics?.wallThicknessM, base.wallThicknessM),
    floorHeightM: normalizeNumber(wallMetrics?.floorHeightM, base.floorHeightM),
    discountOpenings: normalizeBoolean(wallMetrics?.discountOpenings, base.discountOpenings),
    foundationType: normalizeFoundationType(foundationRoof?.foundationType, base.foundationType),
    foundationAreaM2: normalizeNumber(foundationRoof?.foundationAreaM2, base.foundationAreaM2),
    roofType: normalizeRoofType(foundationRoof?.roofType, base.roofType),
    roofSlopeFactor: normalizeNumber(foundationRoof?.roofSlopeFactor, base.roofSlopeFactor),
    roofEaveM: normalizeNumber(foundationRoof?.roofEaveM, base.roofEaveM),
    electricalEstimated: normalizeBoolean(mep?.electricalEstimated, base.electricalEstimated),
    electricalPoints: Math.max(0, Math.round(normalizeNumber(mep?.electricalPoints, base.electricalPoints))),
    plumbingEstimated: normalizeBoolean(mep?.plumbingEstimated, base.plumbingEstimated),
    plumbingPoints: Math.max(0, Math.round(normalizeNumber(mep?.plumbingPoints, base.plumbingPoints))),
  };
}

export function normalizeManualTakeoffProjectData(
  data: Partial<ManualTakeoffProjectData> | undefined,
  fallback: Partial<ManualTakeoffState> = {}
): ManualTakeoffProjectData | undefined {
  if (!data) return undefined;
  return createManualTakeoffDataFromState(createManualTakeoffStateFromData(data, fallback), typeof data.updatedAt === "string" ? data.updatedAt : "");
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

export function calculateManualTakeoffMetrics(state: ManualTakeoffState) {
  const builtAreaM2 = sum(state.rooms.map((room) => room.areaM2));
  const footprintAreaM2 = Math.max(state.foundationAreaM2, state.buildingWidthM * state.buildingDepthM);
  const openingsAreaM2 = sum(state.openings.map((opening) => opening.quantity * opening.widthM * opening.heightM));
  const grossWallAreaM2 = (state.externalWallLengthM + state.internalWallLengthM) * state.floorHeightM * Math.max(1, state.floors);
  const netWallAreaM2 = Math.max(0, grossWallAreaM2 - (state.discountOpenings ? openingsAreaM2 : 0));
  const roofAreaM2 = (state.buildingWidthM + state.roofEaveM * 2) * (state.buildingDepthM + state.roofEaveM * 2) * state.roofSlopeFactor;
  const wetRoomCount = state.rooms.filter((room) => room.wetArea).length;
  const electricalPoints = state.electricalPoints > 0 ? state.electricalPoints : sum(state.rooms.map((room) => room.electricalPoints));
  const plumbingPoints = state.plumbingPoints > 0 ? state.plumbingPoints : sum(state.rooms.map((room) => room.plumbingPoints));
  const pendingCount =
    Number(state.foundationType === "a_confirmar") +
    Number(state.roofType === "a_confirmar") +
    Number(state.electricalEstimated) +
    Number(state.plumbingEstimated) +
    Number(state.discountOpenings);

  return {
    builtAreaM2: Number(builtAreaM2.toFixed(2)),
    footprintAreaM2: Number(footprintAreaM2.toFixed(2)),
    openingsAreaM2: Number(openingsAreaM2.toFixed(2)),
    grossWallAreaM2: Number(grossWallAreaM2.toFixed(2)),
    netWallAreaM2: Number(netWallAreaM2.toFixed(2)),
    roofAreaM2: Number(roofAreaM2.toFixed(2)),
    wetRoomCount,
    electricalPoints,
    plumbingPoints,
    pendingCount,
  };
}
