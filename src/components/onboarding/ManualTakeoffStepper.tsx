"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  Home,
  Plus,
  Ruler,
  Trash2,
  Triangle,
  Waves,
  Zap,
} from "lucide-react";
import { ConstructionMethodSelector } from "@/components/onboarding/ConstructionMethodSelector";
import {
  ActionCard,
  FormSection,
  InlineHelp,
  MetricCard,
  NumericAdjuster,
  OpeningEditor,
  ReviewCard,
  RoomEditor,
  StepProgress,
  StepShell,
  StatusPill,
  StickySummary,
} from "@/components/shared/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getConstructionMethodDefinition, getScenarioMethodInputs, type ConstructionMethodId, type ConstructionMethodInputs } from "@/lib/construction-methods";
import {
  calculateManualTakeoffMetrics,
  createManualTakeoffDataFromState,
  createDefaultManualTakeoffState,
  createManualTakeoffOpening,
  createManualTakeoffRoom,
  createManualTakeoffStateFromData,
  manualTakeoffSteps,
  type ManualFinishLevel,
  type ManualFoundationType,
  type ManualOpeningKind,
  type ManualRoofType,
  type ManualRoomType,
  type ManualTakeoffOpening,
  type ManualTakeoffRoom,
  type ManualTakeoffState,
} from "@/lib/takeoff/manual-stepper";
import { generateTakeoffQuantitySeeds } from "@/lib/takeoff/quantity-seeds";
import { normalizeBrazilStateName } from "@/lib/locations/brazil";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import { formatNumber } from "@/lib/format";

const roomTypeOptions: Array<{ value: ManualRoomType; label: string; icon: typeof Home; wetArea: boolean; electricalPoints: number; plumbingPoints: number }> = [
  { value: "social", label: "Social", icon: Home, wetArea: false, electricalPoints: 10, plumbingPoints: 0 },
  { value: "bedroom", label: "Quarto", icon: BedDouble, wetArea: false, electricalPoints: 6, plumbingPoints: 0 },
  { value: "kitchen", label: "Cozinha", icon: Home, wetArea: true, electricalPoints: 12, plumbingPoints: 2 },
  { value: "bathroom", label: "Banheiro", icon: Bath, wetArea: true, electricalPoints: 4, plumbingPoints: 6 },
  { value: "service", label: "Serviço", icon: Waves, wetArea: true, electricalPoints: 6, plumbingPoints: 4 },
  { value: "circulation", label: "Circulação", icon: Ruler, wetArea: false, electricalPoints: 3, plumbingPoints: 0 },
  { value: "external", label: "Externo", icon: Building2, wetArea: false, electricalPoints: 2, plumbingPoints: 1 },
];

const finishOptions: Array<{ value: ManualFinishLevel; label: string }> = [
  { value: "economico", label: "Econômico" },
  { value: "medio", label: "Médio" },
  { value: "superior", label: "Superior" },
];

const foundationOptions: Array<{ value: ManualFoundationType; label: string }> = [
  { value: "a_confirmar", label: "A confirmar" },
  { value: "radier", label: "Radier preliminar" },
  { value: "baldrame", label: "Baldrame preliminar" },
  { value: "sapatas", label: "Sapatas preliminares" },
];

const roofOptions: Array<{ value: ManualRoofType; label: string }> = [
  { value: "a_confirmar", label: "A confirmar" },
  { value: "telhado_ceramico", label: "Telhado cerâmico" },
  { value: "telhado_metalico", label: "Telhado metálico" },
  { value: "laje", label: "Laje" },
];

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function averageOpeningDimension(openings: ManualTakeoffOpening[], kind: ManualOpeningKind, key: "widthM" | "heightM", fallback: number) {
  const matching = openings.filter((opening) => opening.kind === kind);
  const totalQuantity = matching.reduce((total, opening) => total + opening.quantity, 0);
  if (totalQuantity <= 0) return fallback;
  return round(matching.reduce((total, opening) => total + opening[key] * opening.quantity, 0) / totalQuantity, 2);
}

function countOpenings(openings: ManualTakeoffOpening[], kind: ManualOpeningKind) {
  return openings.filter((opening) => opening.kind === kind).reduce((total, opening) => total + opening.quantity, 0);
}

function buildMethodInputsFromManualState(
  state: ManualTakeoffState,
  currentInputs: ConstructionMethodInputs
): ConstructionMethodInputs {
  const doorOpenings = state.openings.filter((opening) => opening.kind === "door");
  const windowOpenings = state.openings.filter((opening) => opening.kind === "window");
  return {
    ...(currentInputs as Record<string, unknown>),
    widthM: state.buildingWidthM,
    depthM: state.buildingDepthM,
    floors: state.floors,
    floorHeightM: state.floorHeightM,
    internalWallLengthM: state.internalWallLengthM,
    wallThicknessM: state.wallThicknessM,
    doorCount: countOpenings(doorOpenings, "door"),
    doorWidthM: averageOpeningDimension(state.openings, "door", "widthM", 0.8),
    doorHeightM: averageOpeningDimension(state.openings, "door", "heightM", 2.1),
    windowCount: countOpenings(windowOpenings, "window"),
    windowWidthM: averageOpeningDimension(state.openings, "window", "widthM", 1.2),
    windowHeightM: averageOpeningDimension(state.openings, "window", "heightM", 1),
    foundationType: state.foundationType === "a_confirmar" ? "placeholder" : state.foundationType,
    roofType: state.roofType === "a_confirmar" ? "placeholder" : state.roofType,
    foundationAreaM2: state.foundationAreaM2,
    roofSlopeFactor: state.roofSlopeFactor,
    roofEaveM: state.roofEaveM,
    electricalPointCount: state.electricalPoints,
    plumbingPointCount: state.plumbingPoints,
    manualTakeoffReviewRequired: true,
  };
}

function createInitialState(projectName: string, scenario: ReturnType<typeof useSelectedScenario>) {
  const inputs = getScenarioMethodInputs<Record<string, unknown>>(scenario);
  const fallback = {
    projectName,
    address: scenario.location.address,
    city: scenario.location.city,
    state: scenario.location.state,
    country: scenario.location.country || "Brasil",
    lotWidthM: scenario.terrain.width,
    lotDepthM: scenario.terrain.depth,
    frontSetbackM: scenario.terrain.frontSetback,
    rearSetbackM: scenario.terrain.rearSetback,
    leftSetbackM: scenario.terrain.leftSetback,
    rightSetbackM: scenario.terrain.rightSetback,
    buildingWidthM: Number(inputs.widthM ?? scenario.aFrame.panelLength ?? 8),
    buildingDepthM: Number(inputs.depthM ?? scenario.aFrame.houseDepth ?? 10),
    floors: Number(inputs.floors ?? (scenario.aFrame.upperFloorMode === "none" ? 1 : 2)),
    floorHeightM: Number(inputs.floorHeightM ?? scenario.aFrame.upperFloorLevelHeight ?? 2.8),
    wallThicknessM: Number(inputs.wallThicknessM ?? 0.14),
    internalWallLengthM: Number(inputs.internalWallLengthM ?? 18),
  };
  return scenario.manualTakeoff ? createManualTakeoffStateFromData(scenario.manualTakeoff, fallback) : createDefaultManualTakeoffState(fallback);
}

export function ManualTakeoffStepper() {
  const router = useRouter();
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const updateProjectName = useProjectStore((state) => state.updateProjectName);
  const updateScenarioName = useProjectStore((state) => state.updateScenarioName);
  const updateScenarioLocation = useProjectStore((state) => state.updateScenarioLocation);
  const updateScenarioTerrain = useProjectStore((state) => state.updateScenarioTerrain);
  const updateScenarioConstructionMethod = useProjectStore((state) => state.updateScenarioConstructionMethod);
  const updateScenarioMethodInputs = useProjectStore((state) => state.updateScenarioMethodInputs);
  const updateScenarioManualTakeoff = useProjectStore((state) => state.updateScenarioManualTakeoff);
  const updateScenarioAFrame = useProjectStore((state) => state.updateScenarioAFrame);
  const setOnboardingCompleted = useProjectStore((state) => state.setOnboardingCompleted);
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState(() => createInitialState(project.name, scenario));
  const [selectedMethod, setSelectedMethod] = useState<ConstructionMethodId>(scenario.constructionMethod);
  const [lastSync, setLastSync] = useState<"idle" | "synced">("idle");
  const currentStep = manualTakeoffSteps[stepIndex];
  const metrics = useMemo(() => calculateManualTakeoffMetrics(state), [state]);
  const seeds = useMemo(
    () =>
      generateTakeoffQuantitySeeds({
        scenarioId: scenario.id,
        constructionMethod: selectedMethod,
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
          doorCount: countOpenings(state.openings, "door"),
          windowCount: countOpenings(state.openings, "window"),
          doorWidthM: averageOpeningDimension(state.openings, "door", "widthM", 0.8),
          doorHeightM: averageOpeningDimension(state.openings, "door", "heightM", 2.1),
          windowWidthM: averageOpeningDimension(state.openings, "window", "widthM", 1.2),
          windowHeightM: averageOpeningDimension(state.openings, "window", "heightM", 1),
        },
        fixtures: {
          toilets: state.rooms.filter((room) => room.type === "bathroom").length,
          sinks: state.rooms.filter((room) => room.wetArea).length,
          showers: state.rooms.filter((room) => room.type === "bathroom").length,
          faucets: state.rooms.filter((room) => room.wetArea).length,
        },
        source: "manual",
      }),
    [metrics.builtAreaM2, metrics.footprintAreaM2, metrics.roofAreaM2, scenario.id, selectedMethod, state]
  );
  const pendingSeeds = seeds.filter((seed) => seed.requiresReview || seed.pendingReason);
  const methodDefinition = getConstructionMethodDefinition(selectedMethod);

  function updateField<Key extends keyof ManualTakeoffState>(key: Key, value: ManualTakeoffState[Key]) {
    setLastSync("idle");
    setState((current) => ({ ...current, [key]: value }));
  }

  function updateRoom(roomId: string, patch: Partial<ManualTakeoffRoom>) {
    setLastSync("idle");
    setState((current) => ({
      ...current,
      rooms: current.rooms.map((room) => (room.id === roomId ? { ...room, ...patch } : room)),
    }));
  }

  function updateOpening(openingId: string, patch: Partial<ManualTakeoffOpening>) {
    setLastSync("idle");
    setState((current) => ({
      ...current,
      openings: current.openings.map((opening) => (opening.id === openingId ? { ...opening, ...patch } : opening)),
    }));
  }

  function addRoom() {
    const nextId = `room-${Date.now()}`;
    setLastSync("idle");
    setState((current) => ({
      ...current,
      rooms: [...current.rooms, createManualTakeoffRoom(nextId, { name: `Ambiente ${current.rooms.length + 1}` })],
    }));
  }

  function removeRoom(roomId: string) {
    setLastSync("idle");
    setState((current) => ({
      ...current,
      rooms: current.rooms.filter((room) => room.id !== roomId),
      openings: current.openings.filter((opening) => opening.roomId !== roomId),
    }));
  }

  function addOpening(kind: ManualOpeningKind) {
    const roomId = state.rooms[0]?.id ?? "room-social";
    setLastSync("idle");
    setState((current) => ({
      ...current,
      openings: [...current.openings, createManualTakeoffOpening(`${kind}-${Date.now()}`, kind, roomId)],
    }));
  }

  function removeOpening(openingId: string) {
    setLastSync("idle");
    setState((current) => ({ ...current, openings: current.openings.filter((opening) => opening.id !== openingId) }));
  }

  function syncProject() {
    const normalizedState = normalizeBrazilStateName(state.state) || state.state;
    const currentMethodInputs = getScenarioMethodInputs<ConstructionMethodInputs>(scenario);
    const methodInputs = buildMethodInputsFromManualState(state, currentMethodInputs);
    updateProjectName(state.projectName.trim() || "Estudo manual");
    updateScenarioName(scenario.id, "Estudo manual revisado");
    updateScenarioLocation(scenario.id, {
      ...scenario.location,
      address: state.address,
      city: state.city,
      state: normalizedState,
      country: state.country || "Brasil",
    });
    updateScenarioTerrain(scenario.id, {
      ...scenario.terrain,
      width: state.lotWidthM,
      depth: state.lotDepthM,
      frontSetback: state.frontSetbackM,
      rearSetback: state.rearSetbackM,
      leftSetback: state.leftSetbackM,
      rightSetback: state.rightSetbackM,
    });
    updateScenarioConstructionMethod(scenario.id, selectedMethod);
    updateScenarioMethodInputs(scenario.id, selectedMethod, methodInputs);

    if (selectedMethod === "aframe") {
      updateScenarioAFrame(scenario.id, {
        ...scenario.aFrame,
        houseDepth: state.buildingDepthM,
        targetGroundUsefulArea: metrics.footprintAreaM2,
        upperFloorMode: state.floors > 1 ? "full-floor" : "none",
        upperFloorAreaPercent: state.floors > 1 ? 100 : scenario.aFrame.upperFloorAreaPercent,
        upperFloorLevelHeight: state.floorHeightM,
      });
    }

    updateScenarioManualTakeoff(scenario.id, createManualTakeoffDataFromState(state));
    setOnboardingCompleted(true);
    setLastSync("synced");
  }

  function applyAndOpenModel() {
    syncProject();
    router.push("/model-3d");
  }

  const summaryAside = (
    <StickySummary title="Resumo vivo" description="As medidas editadas aqui alimentam o estudo e a prévia 3D quando você aplica.">
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background/70 p-3">
          <span className="text-muted-foreground">Área informada</span>
          <strong>{formatNumber(metrics.builtAreaM2)} m²</strong>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background/70 p-3">
          <span className="text-muted-foreground">Paredes líquidas</span>
          <strong>{formatNumber(metrics.netWallAreaM2)} m²</strong>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background/70 p-3">
          <span className="text-muted-foreground">Seeds geradas</span>
          <strong>{seeds.length}</strong>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone={pendingSeeds.length > 0 ? "warning" : "success"}>{pendingSeeds.length} pendências</StatusPill>
        <StatusPill tone={lastSync === "synced" ? "success" : "pending"}>{lastSync === "synced" ? "3D sincronizado" : "não aplicado"}</StatusPill>
      </div>
      <InlineHelp tone="warning" className="mt-3">
        Aberturas ainda entram no 3D como marcação simplificada. Posicionamento por parede fica como pendência do fluxo 3D.
      </InlineHelp>
    </StickySummary>
  );

  const navigation = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button type="button" variant="outline" disabled={stepIndex === 0} onClick={() => setStepIndex((current) => Math.max(0, current - 1))}>
        Voltar
      </Button>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={syncProject}>
          Aplicar ao estudo
        </Button>
        {stepIndex < manualTakeoffSteps.length - 1 ? (
          <Button type="button" onClick={() => setStepIndex((current) => Math.min(manualTakeoffSteps.length - 1, current + 1))}>
            Próxima etapa
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={applyAndOpenModel}>
            Aplicar e abrir 3D
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <section data-testid="manual-takeoff-stepper" className="space-y-5">
      <div className="rounded-3xl border bg-card/88 p-4 shadow-sm shadow-foreground/5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Preenchimento manual</p>
            <h2 className="mt-1 text-xl font-semibold">Takeoff por etapas</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Edite medidas, ambientes, paredes e premissas antes de confirmar método, quantitativos e orçamento.
            </p>
          </div>
          <StatusPill tone="pending" icon={false}>
            revisão humana obrigatória
          </StatusPill>
        </div>
        <StepProgress
          steps={manualTakeoffSteps.map((step) => ({ label: step.label, description: step.description }))}
          currentIndex={stepIndex}
          className="mt-4 md:grid-cols-3"
        />
      </div>

      <StepShell
        title={currentStep.label}
        description={currentStep.description}
        status={<StatusPill tone="info">{stepIndex + 1} de {manualTakeoffSteps.length}</StatusPill>}
        aside={summaryAside}
        footer={navigation}
      >
        {currentStep.id === "location" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormSection title="Identificação" description="Dados simples para rastrear o estudo." contentClassName="grid gap-4 md:grid-cols-2" className="md:col-span-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="manual-project-name">Nome do estudo</Label>
                <Input id="manual-project-name" value={state.projectName} onChange={(event) => updateField("projectName", event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="manual-address">Endereço ou referência</Label>
                <Input id="manual-address" value={state.address} onChange={(event) => updateField("address", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-city">Cidade</Label>
                <Input id="manual-city" value={state.city} onChange={(event) => updateField("city", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-state">UF ou estado</Label>
                <Input id="manual-state" value={state.state} onChange={(event) => updateField("state", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-country">País</Label>
                <Input id="manual-country" value={state.country} onChange={(event) => updateField("country", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-price-base">Base de preço sugerida</Label>
                <Input id="manual-price-base" value={state.priceBaseSuggestion} onChange={(event) => updateField("priceBaseSuggestion", event.target.value)} />
              </div>
            </FormSection>
            <InlineHelp tone="info" className="md:col-span-2">
              A base de preço é só uma intenção nesta etapa. O orçamento revisado continua dependendo de fonte importada e vínculo aprovado.
            </InlineHelp>
          </div>
        ) : null}

        {currentStep.id === "plot" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <FormSection title="Lote e implantação" description="Defina terreno, recuos e volume base para alimentar o 3D." contentClassName="grid gap-4 md:grid-cols-2">
              <NumericAdjuster id="manual-lot-width" label="Largura do lote" unit="m" step={0.5} value={state.lotWidthM} onChange={(value) => updateField("lotWidthM", value)} />
              <NumericAdjuster id="manual-lot-depth" label="Profundidade do lote" unit="m" step={0.5} value={state.lotDepthM} onChange={(value) => updateField("lotDepthM", value)} />
              <NumericAdjuster id="manual-front-setback" label="Recuo frontal" unit="m" step={0.25} value={state.frontSetbackM} onChange={(value) => updateField("frontSetbackM", value)} />
              <NumericAdjuster id="manual-rear-setback" label="Recuo fundo" unit="m" step={0.25} value={state.rearSetbackM} onChange={(value) => updateField("rearSetbackM", value)} />
              <NumericAdjuster id="manual-left-setback" label="Recuo esquerdo" unit="m" step={0.25} value={state.leftSetbackM} onChange={(value) => updateField("leftSetbackM", value)} />
              <NumericAdjuster id="manual-right-setback" label="Recuo direito" unit="m" step={0.25} value={state.rightSetbackM} onChange={(value) => updateField("rightSetbackM", value)} />
              <NumericAdjuster id="manual-building-width" label="Largura da edificação" unit="m" step={0.25} value={state.buildingWidthM} onChange={(value) => updateField("buildingWidthM", value)} />
              <NumericAdjuster id="manual-building-depth" label="Profundidade da edificação" unit="m" step={0.25} value={state.buildingDepthM} onChange={(value) => updateField("buildingDepthM", value)} />
              <NumericAdjuster id="manual-floors" label="Pavimentos" step={1} min={1} value={state.floors} onChange={(value) => updateField("floors", Math.max(1, Math.round(value)))} />
            </FormSection>
            <div className="rounded-3xl border bg-emerald-50/60 p-4">
              <p className="text-sm font-semibold">Prévia de implantação</p>
              <div className="relative mt-4 aspect-[4/5] rounded-2xl border border-emerald-200 bg-emerald-100/70 p-5">
                <div className="absolute inset-5 rounded-xl border border-dashed border-amber-500/70" />
                <div
                  className="absolute left-1/2 top-1/2 rounded-lg border border-slate-600 bg-white/85 shadow-sm"
                  style={{
                    width: `${Math.min(70, Math.max(24, (state.buildingWidthM / Math.max(state.lotWidthM, 1)) * 70))}%`,
                    height: `${Math.min(70, Math.max(24, (state.buildingDepthM / Math.max(state.lotDepthM, 1)) * 70))}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-emerald-950/80">Ao aplicar, largura, profundidade, pavimentos e recuos alimentam a prévia 3D quando o método suporta volume retangular.</p>
            </div>
          </div>
        ) : null}

        {currentStep.id === "rooms" ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <InlineHelp tone="info">Ambientes molhados alimentam revestimentos e pontos hidráulicos estimados.</InlineHelp>
              <Button type="button" onClick={addRoom}>
                <Plus className="h-4 w-4" />
                Adicionar ambiente
              </Button>
            </div>
            <div className="space-y-3">
              {state.rooms.map((room) => (
                <RoomEditor
                  key={room.id}
                  title={room.name || "Ambiente"}
                  meta={`${formatNumber(room.areaM2)} m² · pavimento ${room.floor}`}
                  status={<StatusPill tone={room.wetArea ? "info" : "neutral"}>{room.wetArea ? "molhado" : "seco"}</StatusPill>}
                  action={
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRoom(room.id)} aria-label={`Remover ${room.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                >
                  <div className="space-y-2">
                    <Label htmlFor={`${room.id}-name`}>Nome</Label>
                    <Input id={`${room.id}-name`} value={room.name} onChange={(event) => updateRoom(room.id, { name: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={room.type}
                      onValueChange={(value) => {
                        const option = roomTypeOptions.find((item) => item.value === value);
                        updateRoom(room.id, {
                          type: value as ManualRoomType,
                          wetArea: option?.wetArea ?? room.wetArea,
                          electricalPoints: option?.electricalPoints ?? room.electricalPoints,
                          plumbingPoints: option?.plumbingPoints ?? room.plumbingPoints,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roomTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <NumericAdjuster
                    id={`${room.id}-width`}
                    label="Largura"
                    unit="m"
                    step={0.1}
                    value={room.widthM}
                    onChange={(value) => updateRoom(room.id, { widthM: value, areaM2: round(value * room.depthM) })}
                  />
                  <NumericAdjuster
                    id={`${room.id}-depth`}
                    label="Comprimento"
                    unit="m"
                    step={0.1}
                    value={room.depthM}
                    onChange={(value) => updateRoom(room.id, { depthM: value, areaM2: round(room.widthM * value) })}
                  />
                  <NumericAdjuster id={`${room.id}-area`} label="Área" unit="m²" step={0.5} value={room.areaM2} onChange={(value) => updateRoom(room.id, { areaM2: value })} />
                  <NumericAdjuster id={`${room.id}-floor`} label="Pavimento" min={1} step={1} value={room.floor} onChange={(value) => updateRoom(room.id, { floor: Math.max(1, Math.round(value)) })} />
                  <div className="space-y-2">
                    <Label>Acabamento</Label>
                    <Select value={room.finishLevel} onValueChange={(value) => updateRoom(room.id, { finishLevel: value as ManualFinishLevel })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {finishOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <NumericAdjuster id={`${room.id}-electrical`} label="Pontos elétricos" step={1} value={room.electricalPoints} onChange={(value) => updateRoom(room.id, { electricalPoints: Math.round(value) })} />
                  <NumericAdjuster id={`${room.id}-plumbing`} label="Pontos hidráulicos" step={1} value={room.plumbingPoints} onChange={(value) => updateRoom(room.id, { plumbingPoints: Math.round(value) })} />
                </RoomEditor>
              ))}
            </div>
          </div>
        ) : null}

        {currentStep.id === "openings" ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <InlineHelp tone="warning">As quantidades entram no desconto de paredes. Posicionamento por parede no 3D segue pendente.</InlineHelp>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => addOpening("door")}>
                  <Plus className="h-4 w-4" />
                  Porta
                </Button>
                <Button type="button" onClick={() => addOpening("window")}>
                  <Plus className="h-4 w-4" />
                  Janela
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {state.openings.map((opening) => (
                <OpeningEditor
                  key={opening.id}
                  title={opening.type}
                  kind={opening.kind === "door" ? "Porta" : "Janela"}
                  status={<StatusPill tone="info">{opening.quantity} un.</StatusPill>}
                  action={
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeOpening(opening.id)} aria-label={`Remover ${opening.type}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                >
                  <div className="space-y-2">
                    <Label htmlFor={`${opening.id}-type`}>Tipo</Label>
                    <Input id={`${opening.id}-type`} value={opening.type} onChange={(event) => updateOpening(opening.id, { type: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ambiente</Label>
                    <Select value={opening.roomId} onValueChange={(value) => updateOpening(opening.id, { roomId: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {state.rooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <NumericAdjuster id={`${opening.id}-quantity`} label="Quantidade" step={1} value={opening.quantity} onChange={(value) => updateOpening(opening.id, { quantity: Math.round(value) })} />
                  <NumericAdjuster id={`${opening.id}-width`} label="Largura" unit="m" step={0.05} value={opening.widthM} onChange={(value) => updateOpening(opening.id, { widthM: value })} />
                  <NumericAdjuster id={`${opening.id}-height`} label="Altura" unit="m" step={0.05} value={opening.heightM} onChange={(value) => updateOpening(opening.id, { heightM: value })} />
                  {opening.kind === "window" ? (
                    <NumericAdjuster id={`${opening.id}-sill`} label="Peitoril" unit="m" step={0.05} value={opening.sillHeightM ?? 1.1} onChange={(value) => updateOpening(opening.id, { sillHeightM: value })} />
                  ) : null}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`${opening.id}-notes`}>Observações</Label>
                    <Textarea id={`${opening.id}-notes`} value={opening.notes} onChange={(event) => updateOpening(opening.id, { notes: event.target.value })} />
                  </div>
                </OpeningEditor>
              ))}
            </div>
          </div>
        ) : null}

        {currentStep.id === "walls" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormSection title="Paredes" description="Controle as áreas usadas para revestimento, pintura e alvenaria." contentClassName="grid gap-4 md:grid-cols-2" className="md:col-span-2">
              <NumericAdjuster id="manual-external-wall-length" label="Comprimento externo" unit="m" step={0.5} value={state.externalWallLengthM} onChange={(value) => updateField("externalWallLengthM", value)} />
              <NumericAdjuster id="manual-internal-wall-length" label="Comprimento interno" unit="m" step={0.5} value={state.internalWallLengthM} onChange={(value) => updateField("internalWallLengthM", value)} />
              <NumericAdjuster id="manual-wall-thickness" label="Espessura" unit="m" step={0.01} value={state.wallThicknessM} onChange={(value) => updateField("wallThicknessM", value)} />
              <NumericAdjuster id="manual-floor-height" label="Pé-direito" unit="m" step={0.05} value={state.floorHeightM} onChange={(value) => updateField("floorHeightM", value)} />
              <label className="flex items-start gap-3 rounded-2xl border bg-background/70 p-3 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={state.discountOpenings}
                  onChange={(event) => updateField("discountOpenings", event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">Descontar área de portas e janelas</span>
                  <span className="mt-1 block leading-6 text-muted-foreground">Desconto preliminar. Aberturas continuam revisáveis até posicionamento final.</span>
                </span>
              </label>
            </FormSection>
            <MetricCard label="Área bruta de paredes" value={`${formatNumber(metrics.grossWallAreaM2)} m²`} icon={<Ruler className="h-4 w-4" />} />
            <MetricCard label="Área líquida de paredes" value={`${formatNumber(metrics.netWallAreaM2)} m²`} detail={`${formatNumber(metrics.openingsAreaM2)} m² em aberturas`} tone="info" />
          </div>
        ) : null}

        {currentStep.id === "foundation-roof" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormSection title="Fundação preliminar" description="Não dimensiona fundação. Só registra premissa para orçamento pendente." contentClassName="grid gap-4">
              <div className="space-y-2">
                <Label>Tipo preliminar</Label>
                <Select value={state.foundationType} onValueChange={(value) => updateField("foundationType", value as ManualFoundationType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {foundationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumericAdjuster id="manual-foundation-area" label="Área/projeção" unit="m²" step={1} value={state.foundationAreaM2} onChange={(value) => updateField("foundationAreaM2", value)} />
              <InlineHelp tone="warning">Fundação sempre exige revisão técnica antes de virar orçamento revisado.</InlineHelp>
            </FormSection>
            <FormSection title="Cobertura preliminar" description="Registre tipo, inclinação e beiral para gerar quantidade pendente." contentClassName="grid gap-4">
              <div className="space-y-2">
                <Label>Tipo de cobertura</Label>
                <Select value={state.roofType} onValueChange={(value) => updateField("roofType", value as ManualRoofType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roofOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumericAdjuster id="manual-roof-slope" label="Fator de inclinação" step={0.01} value={state.roofSlopeFactor} onChange={(value) => updateField("roofSlopeFactor", value)} />
              <NumericAdjuster id="manual-roof-eave" label="Beiral" unit="m" step={0.05} value={state.roofEaveM} onChange={(value) => updateField("roofEaveM", value)} />
              <MetricCard label="Área preliminar de cobertura" value={`${formatNumber(metrics.roofAreaM2)} m²`} tone="warning" />
            </FormSection>
          </div>
        ) : null}

        {currentStep.id === "mep" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormSection title="Elétrica estimada" description="Use média por ambiente quando não houver projeto elétrico." contentClassName="grid gap-4">
              <label className="flex items-start gap-3 rounded-2xl border bg-background/70 p-3 text-sm">
                <input type="checkbox" checked={state.electricalEstimated} onChange={(event) => updateField("electricalEstimated", event.target.checked)} className="mt-1" />
                <span>
                  <span className="block font-medium">Estimado por média</span>
                  <span className="mt-1 block leading-6 text-muted-foreground">Pendente até confirmação do usuário ou projeto específico.</span>
                </span>
              </label>
              <NumericAdjuster id="manual-electrical-points" label="Pontos elétricos" step={1} value={metrics.electricalPoints} onChange={(value) => updateField("electricalPoints", Math.round(value))} />
              <MetricCard label="Regra usada" value="média por ambiente" detail="Banheiros, cozinha, serviço e salas recebem pesos diferentes." icon={<Zap className="h-4 w-4" />} tone="warning" />
            </FormSection>
            <FormSection title="Hidráulica estimada" description="Use média por áreas molhadas quando não houver projeto hidráulico." contentClassName="grid gap-4">
              <label className="flex items-start gap-3 rounded-2xl border bg-background/70 p-3 text-sm">
                <input type="checkbox" checked={state.plumbingEstimated} onChange={(event) => updateField("plumbingEstimated", event.target.checked)} className="mt-1" />
                <span>
                  <span className="block font-medium">Estimado por média</span>
                  <span className="mt-1 block leading-6 text-muted-foreground">Pendente até confirmação do usuário ou projeto específico.</span>
                </span>
              </label>
              <NumericAdjuster id="manual-plumbing-points" label="Pontos hidráulicos" step={1} value={metrics.plumbingPoints} onChange={(value) => updateField("plumbingPoints", Math.round(value))} />
              <MetricCard label="Áreas molhadas" value={metrics.wetRoomCount} detail="Ambientes marcados como molhados alimentam a estimativa." icon={<Waves className="h-4 w-4" />} tone="warning" />
            </FormSection>
          </div>
        ) : null}

        {currentStep.id === "method" ? (
          <div className="space-y-4">
            <InlineHelp tone="info">O método só aparece depois das medidas base. A escolha continua revisável no app.</InlineHelp>
            <ConstructionMethodSelector selectedMethod={selectedMethod} onSelect={setSelectedMethod} />
            <ActionCard
              title={methodDefinition.name}
              description={methodDefinition.shortDescription}
              icon={Triangle}
              badge={<StatusPill tone="pending">premissas revisáveis</StatusPill>}
            >
              <p className="text-sm leading-6 text-muted-foreground">{methodDefinition.limitations[0]}</p>
            </ActionCard>
          </div>
        ) : null}

        {currentStep.id === "review" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard label="Área" value={`${formatNumber(metrics.builtAreaM2)} m²`} />
              <MetricCard label="Paredes líquidas" value={`${formatNumber(metrics.netWallAreaM2)} m²`} />
              <MetricCard label="Aberturas" value={state.openings.length} />
              <MetricCard label="Seeds" value={seeds.length} tone={pendingSeeds.length > 0 ? "warning" : "success"} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <ReviewCard title="Ambientes" status={<StatusPill tone="info">{state.rooms.length} itens</StatusPill>}>
                <div className="space-y-2 text-sm">
                  {state.rooms.map((room) => (
                    <div key={room.id} className="flex items-center justify-between gap-3 rounded-xl border bg-background/70 p-3">
                      <span>{room.name}</span>
                      <strong>{formatNumber(room.areaM2)} m²</strong>
                    </div>
                  ))}
                </div>
              </ReviewCard>
              <ReviewCard title="Pendências" status={<StatusPill tone={pendingSeeds.length > 0 ? "warning" : "success"}>{pendingSeeds.length}</StatusPill>}>
                <div className="space-y-2 text-sm">
                  {pendingSeeds.slice(0, 6).map((seed) => (
                    <div key={seed.id} className="rounded-xl border bg-background/70 p-3">
                      <p className="font-medium">{seed.description}</p>
                      <p className="mt-1 text-muted-foreground">{seed.pendingReason ?? "Revisar antes do orçamento."}</p>
                    </div>
                  ))}
                </div>
              </ReviewCard>
            </div>
            <FormSection title="Quantitativos gerados" description="Prévia determinística para o próximo PR de orçamento." contentClassName="grid gap-2">
              {seeds.slice(0, 10).map((seed) => (
                <div key={seed.id} className="grid gap-2 rounded-2xl border bg-background/70 p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                  <span className="font-medium">{seed.description}</span>
                  <span>{formatNumber(seed.quantity)} {seed.unit}</span>
                  <StatusPill tone={seed.requiresReview ? "warning" : "success"}>{seed.requiresReview ? "revisar" : "ok"}</StatusPill>
                </div>
              ))}
            </FormSection>
          </div>
        ) : null}
      </StepShell>
    </section>
  );
}
