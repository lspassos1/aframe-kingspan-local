"use client";

import { useEffect } from "react";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import { scenarioSchema, type ScenarioFormValues } from "@/lib/validation/project";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import {
  coerceAFrameToPanel,
  getPanelExternalOptions,
  getPanelInternalOptions,
  getPanelLengthOptions,
  getPanelThicknessOptions,
} from "@/lib/panels";

function NumberField({
  label,
  step = "0.01",
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{label}</Label>
      <Input type="number" step={step} {...props} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export default function EditPage() {
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const updateProjectName = useProjectStore((state) => state.updateProjectName);
  const updateScenarioName = useProjectStore((state) => state.updateScenarioName);
  const updateScenarioLocation = useProjectStore((state) => state.updateScenarioLocation);
  const updateScenarioTerrain = useProjectStore((state) => state.updateScenarioTerrain);
  const updateScenarioAFrame = useProjectStore((state) => state.updateScenarioAFrame);
  const updateScenarioPanel = useProjectStore((state) => state.updateScenarioPanel);
  const updateScenarioPricing = useProjectStore((state) => state.updateScenarioPricing);
  const updateScenarioSteelMode = useProjectStore((state) => state.updateScenarioSteelMode);

  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioSchema) as Resolver<ScenarioFormValues>,
    defaultValues: scenario,
  });

  useEffect(() => {
    form.reset(scenario);
  }, [form, scenario]);

  const watched = useWatch({ control: form.control }) as ScenarioFormValues;
  const geometry = calculateAFrameGeometry(watched.terrain, watched.aFrame);
  const selectedPanel = project.panelProducts.find((item) => item.id === watched.panelProductId) ?? project.panelProducts[0];
  const isCustomPanel = Boolean(selectedPanel.isCustom);
  const lengthOptions = getPanelLengthOptions(selectedPanel);
  const thicknessOptions = getPanelThicknessOptions(selectedPanel);
  const externalOptions = getPanelExternalOptions(selectedPanel);
  const internalOptions = getPanelInternalOptions(selectedPanel);

  useEffect(() => {
    if (!selectedPanel || selectedPanel.isCustom) return;
    const current = form.getValues("aFrame");
    const coerced = coerceAFrameToPanel(current, selectedPanel);
    if (
      coerced.panelLength !== current.panelLength ||
      coerced.panelUsefulWidth !== current.panelUsefulWidth ||
      coerced.panelThickness !== current.panelThickness
    ) {
      form.setValue("aFrame", coerced, { shouldDirty: true, shouldValidate: true });
    }
  }, [form, selectedPanel]);

  const onSubmit = (values: ScenarioFormValues) => {
    updateScenarioName(scenario.id, values.name);
    updateScenarioLocation(scenario.id, values.location);
    updateScenarioTerrain(scenario.id, values.terrain);
    updateScenarioAFrame(scenario.id, values.aFrame);
    updateScenarioPanel(scenario.id, values.panelProductId, values.externalColor, values.internalFinish);
    updateScenarioPricing(scenario.id, values.pricing);
    updateScenarioSteelMode(scenario.id, values.steelMode);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Configurar</p>
          <h1 className="text-3xl font-semibold tracking-normal">Dados do projeto e geometria</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lote, endereco e medidas sao editaveis. Cruz das Almas/BA e 17 x 26 m sao apenas defaults.
          </p>
        </div>
        <Button type="submit">
          <Save className="mr-2 h-4 w-4" />
          Salvar configuracao
        </Button>
      </div>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle>Projeto e endereco</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label>Nome do projeto</Label>
            <Input value={project.name} onChange={(event) => updateProjectName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nome do cenario</Label>
            <Input {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <Label>Endereco</Label>
            <Input {...form.register("location.address")} placeholder="Rua, numero, bairro" />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input {...form.register("location.city")} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input {...form.register("location.state")} />
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input {...form.register("location.postalCode")} />
          </div>
          <div className="space-y-2 xl:col-span-3">
            <Label>Observacoes do local</Label>
            <Textarea {...form.register("location.notes")} />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="rounded-md shadow-none">
            <CardHeader>
              <CardTitle>Lote e recuos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <NumberField label="Largura do lote (m)" {...form.register("terrain.width")} />
              <NumberField label="Profundidade do lote (m)" {...form.register("terrain.depth")} />
              <Controller
                control={form.control}
                name="terrain.frontSide"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Frente do lote</Label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="width">Lado da largura</SelectItem>
                        <SelectItem value="depth">Lado da profundidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <NumberField label="Recuo frontal (m)" {...form.register("terrain.frontSetback")} />
              <NumberField label="Recuo fundo (m)" {...form.register("terrain.rearSetback")} />
              <NumberField label="Recuo esquerdo (m)" {...form.register("terrain.leftSetback")} />
              <NumberField label="Recuo direito (m)" {...form.register("terrain.rightSetback")} />
            </CardContent>
          </Card>

          <Card className="rounded-md shadow-none">
            <CardHeader>
              <CardTitle>A-frame</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {isCustomPanel ? (
                <NumberField label="Comprimento do painel (m)" {...form.register("aFrame.panelLength")} />
              ) : (
                <Controller
                  control={form.control}
                  name="aFrame.panelLength"
                  render={({ field }) => (
                    <div className="space-y-2">
                      <Label>Comprimento disponivel (m)</Label>
                      <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                        <SelectTrigger>
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
                    </div>
                  )}
                />
              )}
              <NumberField label="Largura util do painel (m)" disabled={!isCustomPanel} {...form.register("aFrame.panelUsefulWidth")} />
              {isCustomPanel ? (
                <NumberField label="Espessura do painel (mm)" step="1" {...form.register("aFrame.panelThickness")} />
              ) : (
                <Controller
                  control={form.control}
                  name="aFrame.panelThickness"
                  render={({ field }) => (
                    <div className="space-y-2">
                      <Label>Espessura disponivel (mm)</Label>
                      <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {thicknessOptions.map((value) => (
                            <SelectItem value={String(value)} key={value}>
                              {value} mm
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
              )}
              <NumberField label="Angulo base (graus)" step="1" {...form.register("aFrame.baseAngleDeg")} />
              <NumberField label="Profundidade manual (m)" {...form.register("aFrame.houseDepth")} />
              <NumberField label="Meta area util terreo (m2)" {...form.register("aFrame.targetGroundUsefulArea")} />
              <NumberField label="Pe-direito minimo util (m)" {...form.register("aFrame.minimumUsefulHeight")} />
              <Controller
                control={form.control}
                name="aFrame.upperFloorMode"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Pavimento superior</Label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem pavimento superior</SelectItem>
                        <SelectItem value="full-floor">Segundo pavimento completo</SelectItem>
                        <SelectItem value="mezzanine-percent">Mezanino por percentual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <NumberField label="Altura do piso superior (m)" {...form.register("aFrame.upperFloorLevelHeight")} />
              <NumberField
                label="% area pav. superior"
                step="1"
                disabled={watched.aFrame.upperFloorMode !== "mezzanine-percent"}
                {...form.register("aFrame.upperFloorAreaPercent")}
              />
              <NumberField label="Espessura piso superior (m)" {...form.register("aFrame.floorBuildUpThickness")} />
              <NumberField label="Folga cumeeira (m)" {...form.register("aFrame.ridgeCapAllowance")} />
              <NumberField label="Beiral frontal (m)" {...form.register("aFrame.frontOverhang")} />
              <NumberField label="Beiral posterior (m)" {...form.register("aFrame.rearOverhang")} />
              <NumberField label="Offset acabamento lateral (m)" {...form.register("aFrame.lateralBaseFlashingOffset")} />
              <Controller
                control={form.control}
                name="aFrame.automaticDepth"
                render={({ field }) => (
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label>Profundidade automatica</Label>
                      <p className="text-xs text-muted-foreground">Calcula pela meta de area util.</p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
              <Controller
                control={form.control}
                name="aFrame.facadeType"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Tipo de fachada</Label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open-glass">Vidro aberto</SelectItem>
                        <SelectItem value="panel-closed">Painel fechado</SelectItem>
                        <SelectItem value="mixed">Mista</SelectItem>
                        <SelectItem value="placeholder">Placeholder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            </CardContent>
          </Card>

          <Card className="rounded-md shadow-none">
            <CardHeader>
              <CardTitle>Painel, preco e estrutura</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Controller
                control={form.control}
                name="panelProductId"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Produto de painel</Label>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        const selected = project.panelProducts.find((item) => item.id === value);
                        field.onChange(value);
                        if (selected) {
                          const coerced = coerceAFrameToPanel(form.getValues("aFrame"), selected);
                          const selectedExternal = getPanelExternalOptions(selected)[0];
                          const selectedInternal = getPanelInternalOptions(selected)[0];
                          form.setValue("aFrame", coerced, { shouldDirty: true, shouldValidate: true });
                          form.setValue("externalColor", String(selectedExternal.value ?? selected.colorHex), { shouldDirty: true });
                          form.setValue("internalFinish", String(selectedInternal.value ?? selected.colorHex), { shouldDirty: true });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {project.panelProducts.map((item) => (
                          <SelectItem value={item.id} key={item.id}>
                            {item.productName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              {isCustomPanel ? (
                <div className="space-y-2">
                  <Label>Cor externa</Label>
                  <Input type="color" {...form.register("externalColor")} className="h-10" />
                </div>
              ) : (
                <Controller
                  control={form.control}
                  name="externalColor"
                  render={({ field }) => (
                    <div className="space-y-2">
                      <Label>Cor externa disponivel</Label>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {externalOptions.map((option) => (
                            <SelectItem value={String(option.value)} key={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
              )}
              {isCustomPanel ? (
                <div className="space-y-2">
                  <Label>Acabamento interno</Label>
                  <Input type="color" {...form.register("internalFinish")} className="h-10" />
                </div>
              ) : (
                <Controller
                  control={form.control}
                  name="internalFinish"
                  render={({ field }) => (
                    <div className="space-y-2">
                      <Label>Acabamento interno disponivel</Label>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {internalOptions.map((option) => (
                            <SelectItem value={String(option.value)} key={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
              )}
              <Controller
                control={form.control}
                name="steelMode"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Modo estrutural</Label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="optimized">Otimizado preliminar</SelectItem>
                        <SelectItem value="conservative">Conservador preliminar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <NumberField label="Frete separado (R$)" {...form.register("pricing.freightBRL")} />
              <NumberField label="Validade da cotacao (dias)" step="1" {...form.register("pricing.validDays")} />
              <div className="space-y-2">
                <Label>Data da cotacao</Label>
                <Input type="date" {...form.register("pricing.quoteDate")} />
              </div>
              <div className="space-y-2">
                <Label>Fonte dos precos</Label>
                <Input {...form.register("pricing.source")} />
              </div>
              <div className="space-y-2">
                <Label>Fornecedor da cotacao</Label>
                <Input {...form.register("pricing.supplier")} />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground md:col-span-2 xl:col-span-3">
                <p className="font-medium text-foreground">Restricoes do item selecionado</p>
                <p className="mt-1">{selectedPanel.constraintsNote ?? selectedPanel.notes}</p>
                <p className="mt-1">
                  Fonte: {selectedPanel.sourceUrl?.startsWith("http") ? selectedPanel.sourceUrl : selectedPanel.sourceUrl ?? "cotacao/manual"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit rounded-md shadow-none xl:sticky xl:top-6">
          <CardHeader>
            <CardTitle>Resumo calculado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Largura</span>
              <strong>{geometry.baseWidth} m</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Profundidade efetiva</span>
              <strong>{geometry.effectiveHouseDepth} m</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Cumeeira</span>
              <strong>{geometry.ridgeHeight} m</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Terreo util</span>
              <strong>{geometry.groundUsefulArea} m2</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Pav. superior util</span>
              <strong>{geometry.upperFloorUsefulArea} m2</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Cabe no lote</span>
              <strong>{geometry.fitsTerrain ? "Sim" : "Nao"}</strong>
            </div>
            <div className="pt-2">
              {geometry.warnings.map((warning) => (
                <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950" key={warning.id}>
                  {warning.message}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </form>
  );
}
