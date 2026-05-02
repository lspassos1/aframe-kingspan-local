"use client";

import { useEffect, useMemo, type InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, MapPinned, RotateCcw, Triangle } from "lucide-react";
import { defaultProject } from "@/data/defaultProject";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { coerceAFrameToPanel, getPanelExternalOptions, getPanelInternalOptions, getPanelLengthOptions } from "@/lib/panels";
import { startProjectSchema, type StartProjectFormValues } from "@/lib/validation/onboarding";

function fieldClass(hasError?: boolean) {
  return cn(hasError && "border-destructive bg-destructive/5 ring-2 ring-destructive/20");
}

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

export function StartProjectForm() {
  const router = useRouter();
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const updateProjectName = useProjectStore((state) => state.updateProjectName);
  const updateScenarioName = useProjectStore((state) => state.updateScenarioName);
  const updateScenarioLocation = useProjectStore((state) => state.updateScenarioLocation);
  const updateScenarioTerrain = useProjectStore((state) => state.updateScenarioTerrain);
  const updateScenarioAFrame = useProjectStore((state) => state.updateScenarioAFrame);
  const updateScenarioPanel = useProjectStore((state) => state.updateScenarioPanel);
  const setOnboardingCompleted = useProjectStore((state) => state.setOnboardingCompleted);
  const requiresFreshInput = !project.onboardingCompleted;

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

  const watched = useWatch({ control: form.control });
  const selectedPanel = useMemo(
    () => project.panelProducts.find((panel) => panel.id === watched.panelProductId) ?? project.panelProducts[0],
    [project.panelProducts, watched.panelProductId]
  );
  const lengthOptions = useMemo(() => getPanelLengthOptions(selectedPanel), [selectedPanel]);
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
      state: values.state,
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

  const useExampleProject = () => {
    const example = defaultProject.scenarios[0];
    const values: StartProjectFormValues = {
      projectName: defaultProject.name,
      address: example.location.address,
      city: example.location.city,
      state: example.location.state,
      country: example.location.country,
      terrainWidth: example.terrain.width,
      terrainDepth: example.terrain.depth,
      panelProductId: example.panelProductId,
      panelLength: example.aFrame.panelLength,
      baseAngleDeg: example.aFrame.baseAngleDeg,
      houseDepth: example.aFrame.houseDepth,
    };
    form.reset(values);
    applyValues(values);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle>Dados minimos para abrir o 3D</CardTitle>
          <p className="text-sm text-muted-foreground">
            Campos obrigatorios ficam destacados em vermelho ate ficarem validos. Depois disso o modelo 3D pode recalcular lote, painel, altura e profundidade.
          </p>
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
                <Label htmlFor="address">Endereco ou referencia do lote</Label>
                <Input id="address" placeholder="Opcional nesta etapa" {...form.register("address")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className={cn(form.formState.errors.city && "text-destructive")}>
                  Cidade
                </Label>
                <Input id="city" aria-invalid={Boolean(form.formState.errors.city)} className={fieldClass(Boolean(form.formState.errors.city))} {...form.register("city")} />
                <FieldError message={form.formState.errors.city?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className={cn(form.formState.errors.state && "text-destructive")}>
                  Estado
                </Label>
                <Input id="state" aria-invalid={Boolean(form.formState.errors.state)} className={fieldClass(Boolean(form.formState.errors.state))} {...form.register("state")} />
                <FieldError message={form.formState.errors.state?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country" className={cn(form.formState.errors.country && "text-destructive")}>
                  Pais
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
                      <Label className={cn(fieldState.error && "text-destructive")}>Comprimento disponivel</Label>
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
              <NumberInput id="baseAngleDeg" label="Angulo da casa (graus)" step="1" error={form.formState.errors.baseAngleDeg?.message} {...form.register("baseAngleDeg")} />
              <NumberInput id="houseDepth" label="Profundidade da casa (m)" error={form.formState.errors.houseDepth?.message} {...form.register("houseDepth")} />
            </section>

            <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={useExampleProject}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Usar projeto exemplo
              </Button>
              <Button type="submit" disabled={!form.formState.isValid}>
                Iniciar Modelo 3D
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Triangle className="h-4 w-4" />
              Previa geometrica
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
              <span className="text-muted-foreground">Terreo util</span>
              <strong>{formatNumber(geometry.groundUsefulArea)} m2</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Cabe no lote</span>
              <strong>{geometry.fitsTerrain ? "Sim" : "Nao"}</strong>
            </div>
            {geometry.warnings.slice(0, 3).map((warning) => (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950" key={warning.id}>
                {warning.message}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPinned className="h-4 w-4" />
              Privacidade nesta etapa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Esses dados ficam no LocalStorage do navegador. O app nao envia projeto, endereco ou medidas para um banco proprio.</p>
            <p>Autenticacao e email ficam no Clerk. Senhas e tokens OAuth nao passam pelo app.</p>
            <p>Estimativa inicial exibida: {formatCurrency(0)} ate voce preencher precos reais nas abas internas.</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
