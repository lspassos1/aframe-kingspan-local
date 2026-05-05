"use client";

import { useEffect, useMemo, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ChevronDown, MapPinned, Triangle } from "lucide-react";
import { defaultProject } from "@/data/defaultProject";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrazilLocationSelectFields } from "@/components/shared/BrazilLocationSelectFields";
import { ConstructionMethodSelector } from "@/components/onboarding/ConstructionMethodSelector";
import { getConstructionMethodDefinition, getScenarioMethodInputs, type ConstructionMethodId } from "@/lib/construction-methods";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { coerceAFrameToPanel, getPanelExternalOptions, getPanelInternalOptions, getPanelLengthOptions } from "@/lib/panels";
import { normalizeBrazilStateName } from "@/lib/locations/brazil";
import { methodProjectSchema, startProjectSchema, type MethodProjectFormValues, type StartProjectFormValues } from "@/lib/validation/onboarding";

function fieldClass(hasError?: boolean) {
  return cn(hasError && "border-destructive bg-destructive/5 ring-2 ring-destructive/20");
}

const methodNativeSelectClass =
  "h-10 w-full rounded-xl border border-input/85 bg-background/75 px-3 text-sm shadow-inner shadow-foreground/[0.015] outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

function NumberInput({
  label,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id} className={cn(error && "text-destructive")}>
        {label}
      </Label>
      <Input type="number" step="0.01" aria-invalid={Boolean(error)} className={cn(fieldClass(Boolean(error)), className)} {...props} />
      <FieldError message={error} />
    </div>
  );
}

function ProgressiveDetails({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-2xl border bg-muted/15 p-4 md:col-span-2">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span>
        </span>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </details>
  );
}

type MinimalMethodInputs = {
  widthM?: number;
  depthM?: number;
  floors?: number;
  floorHeightM?: number;
  internalWallLengthM?: number;
  blockType?: "ceramic" | "concrete";
  blockLengthM?: number;
  blockHeightM?: number;
  blockWidthM?: number;
  blocksPerM2?: number;
  useType?: "infill" | "structural-preliminary";
  finishType?: "exposed" | "plastered";
  epsCoreThicknessM?: number;
  renderThicknessPerFaceM?: number;
  finalWallThicknessM?: number;
  panelWidthM?: number;
  panelHeightM?: number;
  wallThicknessM?: number;
  doorCount?: number;
  doorWidthM?: number;
  doorHeightM?: number;
  windowCount?: number;
  windowWidthM?: number;
  windowHeightM?: number;
  foundationType?: "radier" | "baldrame" | "placeholder";
  roofType?: "simple-roof" | "slab" | "placeholder";
  internalPlaster?: boolean;
  externalPlaster?: boolean;
  subfloor?: boolean;
  basicFinish?: boolean;
  groutingEnabled?: boolean;
  verticalRebarEnabled?: boolean;
  horizontalRebarEnabled?: boolean;
  baseWaterproofingEnabled?: boolean;
  specializedLabor?: boolean;
  starterBarsEnabled?: boolean;
  openingReinforcementEnabled?: boolean;
  projectionEquipmentRequired?: boolean;
  specializedLaborRequired?: boolean;
  finalFinish?: boolean;
  wastePercent?: number;
};

function buildMethodProjectFormDefaults({
  constructionMethod,
  inputs,
  isFreshProject,
  projectName,
  city,
  state,
}: {
  constructionMethod: ConstructionMethodId;
  inputs: MinimalMethodInputs;
  isFreshProject: boolean;
  projectName: string;
  city: string;
  state: string;
}): MethodProjectFormValues {
  return {
    constructionMethod,
    projectName: isFreshProject ? "" : projectName,
    city: isFreshProject ? "" : city,
    state: isFreshProject ? "" : normalizeBrazilStateName(state) || state,
    widthM: isFreshProject ? undefined : inputs.widthM ?? 8,
    depthM: isFreshProject ? undefined : inputs.depthM ?? 12,
    floorHeightM: isFreshProject ? undefined : inputs.floorHeightM ?? 2.8,
    floors: inputs.floors ?? 1,
    internalWallLengthM: inputs.internalWallLengthM ?? 20,
    blockType: inputs.blockType ?? "ceramic",
    blockLengthM: inputs.blockLengthM ?? 0.25,
    blockHeightM: inputs.blockHeightM ?? 0.125,
    blockWidthM: inputs.blockWidthM ?? 0.125,
    blocksPerM2: inputs.blocksPerM2 ?? 64,
    useType: inputs.useType ?? "infill",
    finishType: inputs.finishType ?? "exposed",
    epsCoreThicknessM: inputs.epsCoreThicknessM ?? 0.08,
    renderThicknessPerFaceM: inputs.renderThicknessPerFaceM ?? 0.03,
    finalWallThicknessM: inputs.finalWallThicknessM ?? 0.14,
    panelWidthM: inputs.panelWidthM ?? 1.2,
    panelHeightM: inputs.panelHeightM ?? 2.8,
    wallThicknessM: inputs.wallThicknessM ?? 0.14,
    doorCount: inputs.doorCount ?? 2,
    doorWidthM: inputs.doorWidthM ?? 0.8,
    doorHeightM: inputs.doorHeightM ?? 2.1,
    windowCount: inputs.windowCount ?? 4,
    windowWidthM: inputs.windowWidthM ?? 1.2,
    windowHeightM: inputs.windowHeightM ?? 1,
    foundationType: inputs.foundationType ?? (constructionMethod === "monolithic-eps" ? "radier" : "placeholder"),
    roofType: inputs.roofType ?? "simple-roof",
    internalPlaster: inputs.internalPlaster ?? true,
    externalPlaster: inputs.externalPlaster ?? true,
    subfloor: inputs.subfloor ?? true,
    basicFinish: inputs.basicFinish ?? false,
    groutingEnabled: inputs.groutingEnabled ?? false,
    verticalRebarEnabled: inputs.verticalRebarEnabled ?? false,
    horizontalRebarEnabled: inputs.horizontalRebarEnabled ?? false,
    baseWaterproofingEnabled: inputs.baseWaterproofingEnabled ?? true,
    specializedLabor: inputs.specializedLabor ?? true,
    starterBarsEnabled: inputs.starterBarsEnabled ?? true,
    openingReinforcementEnabled: inputs.openingReinforcementEnabled ?? true,
    projectionEquipmentRequired: inputs.projectionEquipmentRequired ?? true,
    specializedLaborRequired: inputs.specializedLaborRequired ?? true,
    finalFinish: inputs.finalFinish ?? false,
    wastePercent: inputs.wastePercent ?? 10,
  };
}

export function StartProjectForm() {
  const router = useRouter();
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const updateProjectName = useProjectStore((state) => state.updateProjectName);
  const updateScenarioName = useProjectStore((state) => state.updateScenarioName);
  const updateScenarioLocation = useProjectStore((state) => state.updateScenarioLocation);
  const updateScenarioTerrain = useProjectStore((state) => state.updateScenarioTerrain);
  const updateScenarioConstructionMethod = useProjectStore((state) => state.updateScenarioConstructionMethod);
  const updateScenarioMethodInputs = useProjectStore((state) => state.updateScenarioMethodInputs);
  const updateScenarioAFrame = useProjectStore((state) => state.updateScenarioAFrame);
  const updateScenarioPanel = useProjectStore((state) => state.updateScenarioPanel);
  const setOnboardingCompleted = useProjectStore((state) => state.setOnboardingCompleted);
  const requiresFreshInput = !project.onboardingCompleted;
  const selectedMethod = scenario.constructionMethod;
  const selectedMethodDefinition = getConstructionMethodDefinition(selectedMethod);
  const selectedMethodInputs = useMemo(() => getScenarioMethodInputs<MinimalMethodInputs>(scenario), [scenario]);

  const form = useForm<StartProjectFormValues>({
    resolver: zodResolver(startProjectSchema) as Resolver<StartProjectFormValues>,
    mode: "onChange",
    defaultValues: {
      projectName: requiresFreshInput ? "" : project.name,
      address: scenario.location.address,
      city: requiresFreshInput ? "" : scenario.location.city,
      state: requiresFreshInput ? "" : scenario.location.state,
      country: requiresFreshInput ? "" : scenario.location.country,
      terrainWidth: requiresFreshInput ? (undefined as unknown as number) : scenario.terrain.width,
      terrainDepth: requiresFreshInput ? (undefined as unknown as number) : scenario.terrain.depth,
      panelProductId: scenario.panelProductId,
      panelLength: scenario.aFrame.panelLength,
      baseAngleDeg: requiresFreshInput ? (undefined as unknown as number) : scenario.aFrame.baseAngleDeg,
      houseDepth: requiresFreshInput ? (undefined as unknown as number) : scenario.aFrame.houseDepth,
    },
  });
  const manualFormStoreSyncInitializedRef = useRef(false);

  const methodForm = useForm<MethodProjectFormValues>({
    resolver: zodResolver(methodProjectSchema) as Resolver<MethodProjectFormValues>,
    mode: "onChange",
    defaultValues: buildMethodProjectFormDefaults({
      constructionMethod: selectedMethod,
      inputs: selectedMethodInputs,
      isFreshProject: requiresFreshInput,
      projectName: project.name,
      city: scenario.location.city,
      state: scenario.location.state,
    }),
  });

  const watched = useWatch({ control: form.control });
  const selectedPanel = useMemo(
    () => project.panelProducts.find((panel) => panel.id === watched.panelProductId) ?? project.panelProducts[0],
    [project.panelProducts, watched.panelProductId]
  );
  const lengthOptions = useMemo(() => getPanelLengthOptions(selectedPanel), [selectedPanel]);
  const hasFreshStoreValues = useMemo(() => {
    const baseline = defaultProject.scenarios[0];
    return (
      project.name !== defaultProject.name ||
      scenario.location.address !== baseline.location.address ||
      scenario.location.city !== baseline.location.city ||
      scenario.location.state !== baseline.location.state ||
      scenario.location.country !== baseline.location.country ||
      scenario.terrain.width !== baseline.terrain.width ||
      scenario.terrain.depth !== baseline.terrain.depth ||
      scenario.panelProductId !== baseline.panelProductId ||
      scenario.aFrame.panelLength !== baseline.aFrame.panelLength ||
      scenario.aFrame.baseAngleDeg !== baseline.aFrame.baseAngleDeg ||
      scenario.aFrame.houseDepth !== baseline.aFrame.houseDepth
    );
  }, [
    project.name,
    scenario.aFrame.baseAngleDeg,
    scenario.aFrame.houseDepth,
    scenario.aFrame.panelLength,
    scenario.location.address,
    scenario.location.city,
    scenario.location.country,
    scenario.location.state,
    scenario.panelProductId,
    scenario.terrain.depth,
    scenario.terrain.width,
  ]);
  const geometry = calculateAFrameGeometry(
    { ...scenario.terrain, width: Number(watched.terrainWidth ?? scenario.terrain.width), depth: Number(watched.terrainDepth ?? scenario.terrain.depth) },
    {
      ...scenario.aFrame,
      panelLength: Number(watched.panelLength ?? scenario.aFrame.panelLength),
      baseAngleDeg: Number(watched.baseAngleDeg ?? scenario.aFrame.baseAngleDeg),
      houseDepth: Number(watched.houseDepth ?? scenario.aFrame.houseDepth),
    }
  );

  useEffect(() => {
    if (!requiresFreshInput) return;
    const isFirstSync = !manualFormStoreSyncInitializedRef.current;
    manualFormStoreSyncInitializedRef.current = true;
    if (isFirstSync && !hasFreshStoreValues) {
      return;
    }

    form.reset({
      projectName: project.name,
      address: scenario.location.address,
      city: scenario.location.city,
      state: scenario.location.state,
      country: scenario.location.country,
      terrainWidth: scenario.terrain.width,
      terrainDepth: scenario.terrain.depth,
      panelProductId: scenario.panelProductId,
      panelLength: scenario.aFrame.panelLength,
      baseAngleDeg: scenario.aFrame.baseAngleDeg,
      houseDepth: scenario.aFrame.houseDepth,
    });
    void form.trigger();
  }, [
    form,
    hasFreshStoreValues,
    project.name,
    requiresFreshInput,
    scenario.aFrame.baseAngleDeg,
    scenario.aFrame.houseDepth,
    scenario.aFrame.panelLength,
    scenario.location.address,
    scenario.location.city,
    scenario.location.country,
    scenario.location.state,
    scenario.panelProductId,
    scenario.terrain.depth,
    scenario.terrain.width,
  ]);

  useEffect(() => {
    if (!selectedPanel || selectedPanel.isCustom) return;
    const currentLength = Number(form.getValues("panelLength"));
    if (!lengthOptions.includes(currentLength)) {
      form.setValue("panelLength", lengthOptions[0], { shouldDirty: true, shouldValidate: true });
    }
  }, [form, lengthOptions, selectedPanel]);

  useEffect(() => {
    if (requiresFreshInput) {
      void form.trigger();
    }
  }, [form, requiresFreshInput]);

  useEffect(() => {
    methodForm.reset(
      buildMethodProjectFormDefaults({
        constructionMethod: selectedMethod,
        inputs: selectedMethodInputs,
        isFreshProject: requiresFreshInput,
        projectName: project.name,
        city: scenario.location.city,
        state: scenario.location.state,
      })
    );
    if (requiresFreshInput && selectedMethod !== "aframe") {
      void methodForm.trigger();
    }
  }, [methodForm, project.name, requiresFreshInput, scenario.location.city, scenario.location.state, selectedMethod, selectedMethodInputs]);

  const applyValues = (values: StartProjectFormValues) => {
    const panel = project.panelProducts.find((item) => item.id === values.panelProductId) ?? project.panelProducts[0];
    const external = getPanelExternalOptions(panel)[0];
    const internal = getPanelInternalOptions(panel)[0];
    const aFrame = coerceAFrameToPanel(
      {
        ...scenario.aFrame,
        panelLength: values.panelLength,
        panelUsefulWidth: panel.usefulWidthM,
        panelThickness: panel.thicknessMm,
        baseAngleDeg: values.baseAngleDeg,
        houseDepth: values.houseDepth,
      },
      panel
    );

    updateProjectName(values.projectName);
    updateScenarioName(scenario.id, "Cenario inicial");
    updateScenarioLocation(scenario.id, {
      ...scenario.location,
      address: values.address ?? "",
      city: values.city,
      state: normalizeBrazilStateName(values.state) || values.state,
      country: values.country,
    });
    updateScenarioTerrain(scenario.id, {
      ...scenario.terrain,
      width: values.terrainWidth,
      depth: values.terrainDepth,
    });
    updateScenarioAFrame(scenario.id, aFrame);
    updateScenarioPanel(scenario.id, panel.id, String(external.value), String(internal.value));
    setOnboardingCompleted(true);
    router.push("/model-3d");
  };

  const selectConstructionMethod = (methodId: ConstructionMethodId) => {
    updateScenarioConstructionMethod(scenario.id, methodId);
  };

  const applyMethodPlaceholder = (values: MethodProjectFormValues) => {
    const projectName = values.projectName.trim() || `${selectedMethodDefinition.name} - estudo`;
    const widthM = Number(values.widthM ?? selectedMethodInputs.widthM ?? 8);
    const depthM = Number(values.depthM ?? selectedMethodInputs.depthM ?? 12);
    const floorHeightM = Number(values.floorHeightM ?? selectedMethodInputs.floorHeightM ?? 2.8);
    const methodInputs: MinimalMethodInputs = {
      ...selectedMethodInputs,
      widthM,
      depthM,
      floorHeightM,
    };

    if (selectedMethod === "conventional-masonry") {
      methodInputs.floors = Number(values.floors ?? selectedMethodInputs.floors ?? 1);
      methodInputs.internalWallLengthM = Number(values.internalWallLengthM ?? selectedMethodInputs.internalWallLengthM ?? 20);
      methodInputs.blockType = values.blockType ?? selectedMethodInputs.blockType ?? "ceramic";
      methodInputs.wallThicknessM = Number(values.wallThicknessM ?? selectedMethodInputs.wallThicknessM ?? 0.14);
      methodInputs.doorCount = Number(values.doorCount ?? selectedMethodInputs.doorCount ?? 2);
      methodInputs.doorWidthM = Number(values.doorWidthM ?? selectedMethodInputs.doorWidthM ?? 0.8);
      methodInputs.doorHeightM = Number(values.doorHeightM ?? selectedMethodInputs.doorHeightM ?? 2.1);
      methodInputs.windowCount = Number(values.windowCount ?? selectedMethodInputs.windowCount ?? 4);
      methodInputs.windowWidthM = Number(values.windowWidthM ?? selectedMethodInputs.windowWidthM ?? 1.2);
      methodInputs.windowHeightM = Number(values.windowHeightM ?? selectedMethodInputs.windowHeightM ?? 1);
      methodInputs.foundationType = values.foundationType ?? selectedMethodInputs.foundationType ?? "placeholder";
      methodInputs.roofType = values.roofType ?? selectedMethodInputs.roofType ?? "simple-roof";
      methodInputs.internalPlaster = Boolean(values.internalPlaster);
      methodInputs.externalPlaster = Boolean(values.externalPlaster);
      methodInputs.subfloor = Boolean(values.subfloor);
      methodInputs.basicFinish = Boolean(values.basicFinish);
      methodInputs.wastePercent = Number(values.wastePercent ?? selectedMethodInputs.wastePercent ?? 10);
    }

    if (selectedMethod === "eco-block") {
      methodInputs.blockLengthM = Number(values.blockLengthM ?? selectedMethodInputs.blockLengthM ?? 0.25);
      methodInputs.blockHeightM = Number(values.blockHeightM ?? selectedMethodInputs.blockHeightM ?? 0.125);
      methodInputs.blockWidthM = Number(values.blockWidthM ?? selectedMethodInputs.blockWidthM ?? 0.125);
      methodInputs.blocksPerM2 = Number(values.blocksPerM2 ?? selectedMethodInputs.blocksPerM2 ?? 64);
      methodInputs.useType = values.useType ?? selectedMethodInputs.useType ?? "infill";
      methodInputs.finishType = values.finishType ?? selectedMethodInputs.finishType ?? "exposed";
      methodInputs.doorCount = Number(values.doorCount ?? selectedMethodInputs.doorCount ?? 2);
      methodInputs.doorWidthM = Number(values.doorWidthM ?? selectedMethodInputs.doorWidthM ?? 0.8);
      methodInputs.doorHeightM = Number(values.doorHeightM ?? selectedMethodInputs.doorHeightM ?? 2.1);
      methodInputs.windowCount = Number(values.windowCount ?? selectedMethodInputs.windowCount ?? 4);
      methodInputs.windowWidthM = Number(values.windowWidthM ?? selectedMethodInputs.windowWidthM ?? 1.2);
      methodInputs.windowHeightM = Number(values.windowHeightM ?? selectedMethodInputs.windowHeightM ?? 1);
      methodInputs.foundationType = values.foundationType ?? selectedMethodInputs.foundationType ?? "placeholder";
      methodInputs.groutingEnabled = Boolean(values.groutingEnabled);
      methodInputs.verticalRebarEnabled = Boolean(values.verticalRebarEnabled);
      methodInputs.horizontalRebarEnabled = Boolean(values.horizontalRebarEnabled);
      methodInputs.baseWaterproofingEnabled = Boolean(values.baseWaterproofingEnabled);
      methodInputs.specializedLabor = Boolean(values.specializedLabor);
      methodInputs.wastePercent = Number(values.wastePercent ?? selectedMethodInputs.wastePercent ?? 10);
    }

    if (selectedMethod === "monolithic-eps") {
      methodInputs.epsCoreThicknessM = Number(values.epsCoreThicknessM ?? selectedMethodInputs.epsCoreThicknessM ?? 0.08);
      methodInputs.renderThicknessPerFaceM = Number(values.renderThicknessPerFaceM ?? selectedMethodInputs.renderThicknessPerFaceM ?? 0.03);
      methodInputs.finalWallThicknessM = Number(values.finalWallThicknessM ?? selectedMethodInputs.finalWallThicknessM ?? 0.14);
      methodInputs.panelWidthM = Number(values.panelWidthM ?? selectedMethodInputs.panelWidthM ?? 1.2);
      methodInputs.panelHeightM = Number(values.panelHeightM ?? selectedMethodInputs.panelHeightM ?? 2.8);
      methodInputs.useType = values.useType ?? selectedMethodInputs.useType ?? "infill";
      methodInputs.foundationType = values.foundationType ?? selectedMethodInputs.foundationType ?? "radier";
      methodInputs.doorCount = Number(values.doorCount ?? selectedMethodInputs.doorCount ?? 2);
      methodInputs.doorWidthM = Number(values.doorWidthM ?? selectedMethodInputs.doorWidthM ?? 0.8);
      methodInputs.doorHeightM = Number(values.doorHeightM ?? selectedMethodInputs.doorHeightM ?? 2.1);
      methodInputs.windowCount = Number(values.windowCount ?? selectedMethodInputs.windowCount ?? 4);
      methodInputs.windowWidthM = Number(values.windowWidthM ?? selectedMethodInputs.windowWidthM ?? 1.2);
      methodInputs.windowHeightM = Number(values.windowHeightM ?? selectedMethodInputs.windowHeightM ?? 1);
      methodInputs.starterBarsEnabled = Boolean(values.starterBarsEnabled);
      methodInputs.openingReinforcementEnabled = Boolean(values.openingReinforcementEnabled);
      methodInputs.projectionEquipmentRequired = Boolean(values.projectionEquipmentRequired);
      methodInputs.specializedLaborRequired = Boolean(values.specializedLaborRequired);
      methodInputs.finalFinish = Boolean(values.finalFinish);
      methodInputs.wastePercent = Number(values.wastePercent ?? selectedMethodInputs.wastePercent ?? 10);
    }

    updateProjectName(projectName);
    updateScenarioName(scenario.id, "Cenario inicial");
    updateScenarioLocation(scenario.id, {
      ...scenario.location,
      city: values.city,
      state: normalizeBrazilStateName(values.state) || values.state,
    });
    updateScenarioMethodInputs(scenario.id, selectedMethod, methodInputs);
    setOnboardingCompleted(true);
    router.push("/dashboard");
  };

  return (
    <div className="space-y-5">
      <ConstructionMethodSelector selectedMethod={selectedMethod} onSelect={selectConstructionMethod} />

      {selectedMethod === "aframe" ? (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="rounded-3xl shadow-sm">
        <CardHeader>
          <CardTitle>Dados mínimos</CardTitle>
          <p className="text-sm text-muted-foreground">Preencha lote, painel e geometria principal para abrir o 3D.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(applyValues)} className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="projectName" className={cn(form.formState.errors.projectName && "text-destructive")}>
                  Nome do projeto
                </Label>
                <Input
                  id="projectName"
                  aria-invalid={Boolean(form.formState.errors.projectName)}
                  className={fieldClass(Boolean(form.formState.errors.projectName))}
                  {...form.register("projectName")}
                />
                <FieldError message={form.formState.errors.projectName?.message} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Endereço ou referência do lote</Label>
                <Input id="address" placeholder="Opcional nesta etapa" {...form.register("address")} />
              </div>
              <Controller
                control={form.control}
                name="state"
                render={({ field: stateField, fieldState: stateFieldState }) => (
                  <Controller
                    control={form.control}
                    name="city"
                    render={({ field: cityField, fieldState: cityFieldState }) => (
                      <BrazilLocationSelectFields
                        className="md:col-span-2"
                        stateId="state"
                        cityId="city"
                        stateValue={stateField.value}
                        cityValue={cityField.value}
                        onStateChange={stateField.onChange}
                        onCityChange={cityField.onChange}
                        stateError={stateFieldState.error?.message}
                        cityError={cityFieldState.error?.message}
                      />
                    )}
                  />
                )}
              />
              <div className="space-y-2">
                <Label htmlFor="country" className={cn(form.formState.errors.country && "text-destructive")}>
                  País
                </Label>
                <Input id="country" aria-invalid={Boolean(form.formState.errors.country)} className={fieldClass(Boolean(form.formState.errors.country))} {...form.register("country")} />
                <FieldError message={form.formState.errors.country?.message} />
              </div>
              <NumberInput id="terrainWidth" label="Largura do lote (m)" error={form.formState.errors.terrainWidth?.message} {...form.register("terrainWidth")} />
              <NumberInput id="terrainDepth" label="Profundidade do lote (m)" error={form.formState.errors.terrainDepth?.message} {...form.register("terrainDepth")} />
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <Controller
                control={form.control}
                name="panelProductId"
                render={({ field, fieldState }) => (
                  <div className="space-y-2 md:col-span-2">
                    <Label className={cn(fieldState.error && "text-destructive")}>Painel</Label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={Boolean(fieldState.error)} className={fieldClass(Boolean(fieldState.error))}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {project.panelProducts.map((panel) => (
                          <SelectItem value={panel.id} key={panel.id}>
                            {panel.productName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={fieldState.error?.message} />
                    <p className="text-xs text-muted-foreground">{selectedPanel.constraintsNote ?? selectedPanel.notes}</p>
                  </div>
                )}
              />
              {selectedPanel.isCustom ? (
                <NumberInput id="panelLength" label="Comprimento do painel (m)" error={form.formState.errors.panelLength?.message} {...form.register("panelLength")} />
              ) : (
                <Controller
                  control={form.control}
                  name="panelLength"
                  render={({ field, fieldState }) => (
                    <div className="space-y-2">
                      <Label className={cn(fieldState.error && "text-destructive")}>Comprimento disponível</Label>
                      <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                        <SelectTrigger aria-invalid={Boolean(fieldState.error)} className={fieldClass(Boolean(fieldState.error))}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {lengthOptions.map((value) => (
                            <SelectItem value={String(value)} key={value}>
                              {value.toLocaleString("pt-BR")} m
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError message={fieldState.error?.message} />
                    </div>
                  )}
                />
              )}
              <NumberInput id="baseAngleDeg" label="Ângulo da casa (graus)" step="1" error={form.formState.errors.baseAngleDeg?.message} {...form.register("baseAngleDeg")} />
              <NumberInput id="houseDepth" label="Profundidade da casa (m)" error={form.formState.errors.houseDepth?.message} {...form.register("houseDepth")} />
            </section>

            <div className="flex justify-end border-t pt-5">
              <Button type="submit" disabled={!form.formState.isValid}>
                Abrir modelo 3D
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card className="rounded-3xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Triangle className="h-4 w-4" />
              Prévia geométrica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Largura da casa</span>
              <strong>{formatNumber(geometry.baseWidth)} m</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Cumeeira</span>
              <strong>{formatNumber(geometry.ridgeHeight)} m</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Térreo útil</span>
              <strong>{formatNumber(geometry.groundUsefulArea)} m²</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Cabe no lote</span>
              <strong>{geometry.fitsTerrain ? "Sim" : "Não"}</strong>
            </div>
            {geometry.warnings.length > 0 ? (
              <details className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                <summary className="cursor-pointer font-medium">Ver alertas técnicos</summary>
                <div className="mt-2 space-y-2">
                  {geometry.warnings.slice(0, 3).map((warning) => (
                    <p key={warning.id}>{warning.message}</p>
                  ))}
                </div>
              </details>
            ) : null}
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPinned className="h-4 w-4" />
              Privacidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Projetos continuam salvos no navegador.</p>
            <p>Login seguro via Clerk.</p>
            <p>Preços dependem de fontes revisadas. Valor inicial: {formatCurrency(0)}.</p>
          </CardContent>
        </Card>
      </aside>
    </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-3xl shadow-sm">
            <CardHeader>
              <CardTitle>{selectedMethodDefinition.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedMethod === "conventional-masonry"
                  ? "Casa retangular em blocos, com custo preliminar."
                  : selectedMethod === "eco-block"
                    ? "Modulação preliminar em bloco solo-cimento."
                    : selectedMethod === "monolithic-eps"
                      ? "Painéis EPS com quantitativos preliminares."
                  : "Dimensões iniciais para estudo preliminar."}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={methodForm.handleSubmit(applyMethodPlaceholder)} className="space-y-6">
                <input type="hidden" {...methodForm.register("constructionMethod")} />
                <section className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="methodProjectName" className={cn(methodForm.formState.errors.projectName && "text-destructive")}>
                      Nome do projeto
                    </Label>
                    <Input
                      id="methodProjectName"
                      aria-invalid={Boolean(methodForm.formState.errors.projectName)}
                      className={fieldClass(Boolean(methodForm.formState.errors.projectName))}
                      {...methodForm.register("projectName")}
                    />
                    <FieldError message={methodForm.formState.errors.projectName?.message} />
                  </div>
                  <NumberInput
                    id="methodWidthM"
                    label="Largura da casa (m)"
                    min={2}
                    error={methodForm.formState.errors.widthM?.message}
                    {...methodForm.register("widthM")}
                  />
                  <NumberInput
                    id="methodDepthM"
                    label="Profundidade da casa (m)"
                    min={2}
                    error={methodForm.formState.errors.depthM?.message}
                    {...methodForm.register("depthM")}
                  />
                  <NumberInput
                    id="methodFloorHeightM"
                    label="Pé-direito (m)"
                    min={2}
                    error={methodForm.formState.errors.floorHeightM?.message}
                    {...methodForm.register("floorHeightM")}
                  />
                  <Controller
                    control={methodForm.control}
                    name="state"
                    render={({ field: stateField, fieldState: stateFieldState }) => (
                      <Controller
                        control={methodForm.control}
                        name="city"
                        render={({ field: cityField, fieldState: cityFieldState }) => (
                          <BrazilLocationSelectFields
                            className="md:col-span-2"
                            stateId="methodState"
                            cityId="methodCity"
                            stateValue={stateField.value}
                            cityValue={cityField.value}
                            onStateChange={stateField.onChange}
                            onCityChange={cityField.onChange}
                            stateError={stateFieldState.error?.message}
                            cityError={cityFieldState.error?.message}
                          />
                        )}
                      />
                    )}
                  />
                  {selectedMethod === "conventional-masonry" ? (
                    <ProgressiveDetails
                      title="Detalhes de alvenaria"
                      description="Blocos, aberturas, fundação, cobertura e acabamentos ficam aqui para não travar o início do estudo."
                    >
                      <NumberInput
                        id="methodFloors"
                        label="Pavimentos"
                        min={1}
                        step={1}
                        error={methodForm.formState.errors.floors?.message}
                        {...methodForm.register("floors")}
                      />
                      <NumberInput
                        id="methodInternalWalls"
                        label="Paredes internas estimadas (m)"
                        min={0}
                        error={methodForm.formState.errors.internalWallLengthM?.message}
                        {...methodForm.register("internalWallLengthM")}
                      />
                      <div className="space-y-2">
                        <Label htmlFor="methodBlockType">Tipo de bloco</Label>
                        <select
                          id="methodBlockType"
                          className={methodNativeSelectClass}
                          {...methodForm.register("blockType")}
                        >
                          <option value="ceramic">Cerâmico</option>
                          <option value="concrete">Concreto</option>
                        </select>
                      </div>
                      <NumberInput
                        id="methodWallThickness"
                        label="Espessura parede (m)"
                        min={0.09}
                        step={0.01}
                        error={methodForm.formState.errors.wallThicknessM?.message}
                        {...methodForm.register("wallThicknessM")}
                      />
                      <NumberInput id="methodDoorCount" label="Portas (qtd.)" min={0} step={1} error={methodForm.formState.errors.doorCount?.message} {...methodForm.register("doorCount")} />
                      <NumberInput id="methodDoorWidth" label="Largura porta (m)" min={0.5} error={methodForm.formState.errors.doorWidthM?.message} {...methodForm.register("doorWidthM")} />
                      <NumberInput id="methodDoorHeight" label="Altura porta (m)" min={1.8} error={methodForm.formState.errors.doorHeightM?.message} {...methodForm.register("doorHeightM")} />
                      <NumberInput id="methodWindowCount" label="Janelas (qtd.)" min={0} step={1} error={methodForm.formState.errors.windowCount?.message} {...methodForm.register("windowCount")} />
                      <NumberInput id="methodWindowWidth" label="Largura janela (m)" min={0.4} error={methodForm.formState.errors.windowWidthM?.message} {...methodForm.register("windowWidthM")} />
                      <NumberInput id="methodWindowHeight" label="Altura janela (m)" min={0.4} error={methodForm.formState.errors.windowHeightM?.message} {...methodForm.register("windowHeightM")} />
                      <div className="space-y-2">
                        <Label htmlFor="methodFoundationType">Fundação</Label>
                        <select
                          id="methodFoundationType"
                          className={methodNativeSelectClass}
                          {...methodForm.register("foundationType")}
                        >
                          <option value="placeholder">Placeholder</option>
                          <option value="radier">Radier</option>
                          <option value="baldrame">Baldrame</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="methodRoofType">Cobertura</Label>
                        <select
                          id="methodRoofType"
                          className={methodNativeSelectClass}
                          {...methodForm.register("roofType")}
                        >
                          <option value="simple-roof">Telhado simples</option>
                          <option value="slab">Laje</option>
                          <option value="placeholder">Placeholder</option>
                        </select>
                      </div>
                      <NumberInput id="methodWaste" label="Perdas (%)" min={0} step={1} error={methodForm.formState.errors.wastePercent?.message} {...methodForm.register("wastePercent")} />
                      <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:col-span-2 md:grid-cols-2">
                        {[
                          ["internalPlaster", "Reboco interno"],
                          ["externalPlaster", "Reboco externo"],
                          ["subfloor", "Contrapiso"],
                          ["basicFinish", "Acabamento básico"],
                        ].map(([name, label]) => (
                          <label className="flex items-center gap-2 text-sm" key={String(name)}>
                            <input type="checkbox" className="h-4 w-4 accent-primary" {...methodForm.register(name as keyof MethodProjectFormValues)} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </ProgressiveDetails>
                  ) : null}
                  {selectedMethod === "eco-block" ? (
                    <ProgressiveDetails
                      title="Detalhes do bloco ecológico"
                      description="Modulação, uso, acabamento, aberturas e reforços preliminares podem ser ajustados depois dos dados básicos."
                    >
                      <NumberInput id="ecoBlockLength" label="Comprimento bloco (m)" min={0.1} error={methodForm.formState.errors.blockLengthM?.message} {...methodForm.register("blockLengthM")} />
                      <NumberInput id="ecoBlockHeight" label="Altura bloco (m)" min={0.05} error={methodForm.formState.errors.blockHeightM?.message} {...methodForm.register("blockHeightM")} />
                      <NumberInput id="ecoBlockWidth" label="Largura bloco (m)" min={0.08} error={methodForm.formState.errors.blockWidthM?.message} {...methodForm.register("blockWidthM")} />
                      <NumberInput id="ecoBlocksM2" label="Blocos por m²" min={1} error={methodForm.formState.errors.blocksPerM2?.message} {...methodForm.register("blocksPerM2")} />
                      <div className="space-y-2">
                        <Label htmlFor="ecoUseType">Uso</Label>
                        <select
                          id="ecoUseType"
                          className={methodNativeSelectClass}
                          {...methodForm.register("useType")}
                        >
                          <option value="infill">Vedação</option>
                          <option value="structural-preliminary">Estrutural preliminar</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ecoFinishType">Acabamento</Label>
                        <select
                          id="ecoFinishType"
                          className={methodNativeSelectClass}
                          {...methodForm.register("finishType")}
                        >
                          <option value="exposed">Aparente</option>
                          <option value="plastered">Rebocado</option>
                        </select>
                      </div>
                      <NumberInput id="ecoDoorCount" label="Portas (qtd.)" min={0} step={1} error={methodForm.formState.errors.doorCount?.message} {...methodForm.register("doorCount")} />
                      <NumberInput id="ecoDoorWidth" label="Largura porta (m)" min={0.5} error={methodForm.formState.errors.doorWidthM?.message} {...methodForm.register("doorWidthM")} />
                      <NumberInput id="ecoDoorHeight" label="Altura porta (m)" min={1.8} error={methodForm.formState.errors.doorHeightM?.message} {...methodForm.register("doorHeightM")} />
                      <NumberInput id="ecoWindowCount" label="Janelas (qtd.)" min={0} step={1} error={methodForm.formState.errors.windowCount?.message} {...methodForm.register("windowCount")} />
                      <NumberInput id="ecoWindowWidth" label="Largura janela (m)" min={0.4} error={methodForm.formState.errors.windowWidthM?.message} {...methodForm.register("windowWidthM")} />
                      <NumberInput id="ecoWindowHeight" label="Altura janela (m)" min={0.4} error={methodForm.formState.errors.windowHeightM?.message} {...methodForm.register("windowHeightM")} />
                      <div className="space-y-2">
                        <Label htmlFor="ecoFoundationType">Fundação</Label>
                        <select
                          id="ecoFoundationType"
                          className={methodNativeSelectClass}
                          {...methodForm.register("foundationType")}
                        >
                          <option value="placeholder">Placeholder</option>
                          <option value="radier">Radier</option>
                          <option value="baldrame">Baldrame</option>
                        </select>
                      </div>
                      <NumberInput id="ecoWaste" label="Perdas (%)" min={0} step={1} error={methodForm.formState.errors.wastePercent?.message} {...methodForm.register("wastePercent")} />
                      <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:col-span-2 md:grid-cols-2">
                        {[
                          ["groutingEnabled", "Grauteamento"],
                          ["verticalRebarEnabled", "Armadura vertical"],
                          ["horizontalRebarEnabled", "Armadura horizontal/canaletas"],
                          ["baseWaterproofingEnabled", "Impermeabilização de base"],
                          ["specializedLabor", "Mão de obra especializada"],
                        ].map(([name, label]) => (
                          <label className="flex items-center gap-2 text-sm" key={String(name)}>
                            <input type="checkbox" className="h-4 w-4 accent-primary" {...methodForm.register(name as keyof MethodProjectFormValues)} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </ProgressiveDetails>
                  ) : null}
                  {selectedMethod === "monolithic-eps" ? (
                    <ProgressiveDetails
                      title="Detalhes dos painéis EPS"
                      description="Camadas do painel, aberturas, arranques e condições de montagem ficam recolhidos para revisão técnica."
                    >
                      <NumberInput id="epsCoreThickness" label="Núcleo EPS (m)" min={0.03} error={methodForm.formState.errors.epsCoreThicknessM?.message} {...methodForm.register("epsCoreThicknessM")} />
                      <NumberInput id="epsRenderThickness" label="Revest. por face (m)" min={0.01} error={methodForm.formState.errors.renderThicknessPerFaceM?.message} {...methodForm.register("renderThicknessPerFaceM")} />
                      <NumberInput id="epsFinalThickness" label="Espessura final (m)" min={0.08} error={methodForm.formState.errors.finalWallThicknessM?.message} {...methodForm.register("finalWallThicknessM")} />
                      <NumberInput id="epsPanelWidth" label="Largura painel (m)" min={0.3} error={methodForm.formState.errors.panelWidthM?.message} {...methodForm.register("panelWidthM")} />
                      <NumberInput id="epsPanelHeight" label="Altura painel (m)" min={1} error={methodForm.formState.errors.panelHeightM?.message} {...methodForm.register("panelHeightM")} />
                      <div className="space-y-2">
                        <Label htmlFor="epsUseType">Uso</Label>
                        <select
                          id="epsUseType"
                          className={methodNativeSelectClass}
                          {...methodForm.register("useType")}
                        >
                          <option value="infill">Vedação</option>
                          <option value="structural-preliminary">Estrutural preliminar</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="epsFoundationType">Fundação</Label>
                        <select
                          id="epsFoundationType"
                          className={methodNativeSelectClass}
                          {...methodForm.register("foundationType")}
                        >
                          <option value="radier">Radier</option>
                          <option value="baldrame">Baldrame</option>
                          <option value="placeholder">Placeholder</option>
                        </select>
                      </div>
                      <NumberInput id="epsDoorCount" label="Portas (qtd.)" min={0} step={1} error={methodForm.formState.errors.doorCount?.message} {...methodForm.register("doorCount")} />
                      <NumberInput id="epsDoorWidth" label="Largura porta (m)" min={0.5} error={methodForm.formState.errors.doorWidthM?.message} {...methodForm.register("doorWidthM")} />
                      <NumberInput id="epsDoorHeight" label="Altura porta (m)" min={1.8} error={methodForm.formState.errors.doorHeightM?.message} {...methodForm.register("doorHeightM")} />
                      <NumberInput id="epsWindowCount" label="Janelas (qtd.)" min={0} step={1} error={methodForm.formState.errors.windowCount?.message} {...methodForm.register("windowCount")} />
                      <NumberInput id="epsWindowWidth" label="Largura janela (m)" min={0.4} error={methodForm.formState.errors.windowWidthM?.message} {...methodForm.register("windowWidthM")} />
                      <NumberInput id="epsWindowHeight" label="Altura janela (m)" min={0.4} error={methodForm.formState.errors.windowHeightM?.message} {...methodForm.register("windowHeightM")} />
                      <NumberInput id="epsWaste" label="Perdas (%)" min={0} step={1} error={methodForm.formState.errors.wastePercent?.message} {...methodForm.register("wastePercent")} />
                      <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:col-span-2 md:grid-cols-2">
                        {[
                          ["starterBarsEnabled", "Arranques na fundação"],
                          ["openingReinforcementEnabled", "Reforços em aberturas"],
                          ["projectionEquipmentRequired", "Equipamento de projeção"],
                          ["specializedLaborRequired", "Mão de obra especializada"],
                          ["finalFinish", "Acabamento final"],
                        ].map(([name, label]) => (
                          <label className="flex items-center gap-2 text-sm" key={String(name)}>
                            <input type="checkbox" className="h-4 w-4 accent-primary" {...methodForm.register(name as keyof MethodProjectFormValues)} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </ProgressiveDetails>
                  ) : null}
                </section>

                <div className="flex justify-end border-t pt-5">
                  <Button type="submit" disabled={!methodForm.formState.isValid}>
                    Continuar para dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle>Escopo deste método</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>{selectedMethodDefinition.bestFor}</p>
                <details className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                  <summary className="cursor-pointer font-medium">Ver alertas técnicos</summary>
                  <div className="mt-2 space-y-2">
                    {selectedMethodDefinition.defaultWarnings.map((warning) => (
                      <p key={warning.id}>{warning.message}</p>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
