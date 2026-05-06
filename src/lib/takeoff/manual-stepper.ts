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
