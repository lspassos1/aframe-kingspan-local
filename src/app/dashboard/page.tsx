"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, FolderOpen, Home, Package, Ruler, Save, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/MetricCard";
import { getSavedProjectSummary, useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { calculateBudget } from "@/lib/calculations/budget";
import { calculatePanelLayout } from "@/lib/calculations/materials";
import { estimateSteelStructure } from "@/lib/calculations/structure";
import { formatCompactNumber, formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const project = useProjectStore((state) => state.project);
  const savedProjects = useProjectStore((state) => state.savedProjects);
  const openSavedProject = useProjectStore((state) => state.openSavedProject);
  const saveCurrentProject = useProjectStore((state) => state.saveCurrentProject);
  const scenario = useSelectedScenario();
  const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const layout = calculatePanelLayout(scenario, geometry, panel, project.materialAssumptions.sparePanelCount);
  const budget = calculateBudget(project, scenario);
  const structural = estimateSteelStructure(project, scenario);
  const warnings = budget.warnings.filter((warning) => warning.level !== "info");
  const savedSummaries = savedProjects.map(getSavedProjectSummary);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Dashboard</p>
          <h1 className="text-3xl font-semibold tracking-normal">{project.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {scenario.location.city}, {scenario.location.state} | {scenario.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={saveCurrentProject}>
            <Save className="mr-2 h-4 w-4" />
            Salvar projeto atual
          </Button>
          {detailsOpen ? (
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Fechar detalhes
            </Button>
          ) : null}
          <Badge variant={geometry.fitsTerrain ? "default" : "destructive"} className="h-9 px-3">
            {geometry.fitsTerrain ? "Cabe no lote com os recuos" : "Revisar implantacao"}
          </Badge>
        </div>
      </div>

      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Projetos salvos</h2>
            <p className="text-sm text-muted-foreground">Selecione um projeto para abrir os detalhes no dashboard.</p>
          </div>
          {!detailsOpen ? (
            <Badge variant="outline">{savedSummaries.length} salvo{savedSummaries.length === 1 ? "" : "s"}</Badge>
          ) : null}
        </div>
        <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
          {savedSummaries.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum projeto salvo ainda. Preencha o inicio do projeto ou use “Salvar projeto atual”.
            </div>
          ) : (
            savedSummaries.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  openSavedProject(item.id);
                  setDetailsOpen(true);
                }}
                className="rounded-md border bg-background p-4 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.city || "Cidade nao informada"}{item.state ? `, ${item.state}` : ""} · {item.scenarioCount} cenario
                      {item.scenarioCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Atualizado {item.updatedAt ? new Date(item.updatedAt).toLocaleString("pt-BR") : "sem data"}
                </p>
              </button>
            ))
          )}
        </div>
      </section>

      {!detailsOpen ? null : (
        <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Lote"
          value={`${scenario.terrain.width} x ${scenario.terrain.depth} m`}
          detail="Dimensoes e endereco editaveis"
          icon={<Ruler className="h-5 w-5" />}
        />
        <MetricCard
          label="Casa"
          value={`${geometry.baseWidth} x ${geometry.effectiveHouseDepth} m`}
          detail={`Cumeeira ${geometry.ridgeHeight} m | angulo ${scenario.aFrame.baseAngleDeg} graus`}
          icon={<Home className="h-5 w-5" />}
        />
        <MetricCard
          label="Paineis"
          value={`${layout.totalPanels} un`}
          detail={`${layout.panelsPerSlope} por agua | ${layout.totalPanelAreaM2} m2`}
          icon={<Package className="h-5 w-5" />}
        />
        <MetricCard
          label="Custo estimado"
          value={formatCurrency(budget.totalEstimatedCostBRL)}
          detail={`Paineis ${formatCurrency(budget.panelPackageCostBRL)} | Aco ${formatCurrency(budget.steelStructureCostBRL)}`}
          icon={<Wallet className="h-5 w-5" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle>Areas e aproveitamento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Terreo total" value={`${formatCompactNumber(geometry.groundFloorTotalArea)} m2`} />
            <MetricCard label="Terreo util" value={`${formatCompactNumber(geometry.groundUsefulArea)} m2`} />
            <MetricCard label="Pav. superior total" value={`${formatCompactNumber(geometry.upperFloorTotalArea)} m2`} />
            <MetricCard label="Pav. superior util" value={`${formatCompactNumber(geometry.upperFloorUsefulArea)} m2`} />
            <MetricCard label="Area total" value={`${formatCompactNumber(geometry.combinedTotalArea)} m2`} />
            <MetricCard label="Area util total" value={`${formatCompactNumber(geometry.combinedUsefulArea)} m2`} />
          </CardContent>
        </Card>

        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              {geometry.fitsTerrain ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
              )}
              <div>
                <p className="font-medium">Implantacao</p>
                <p className="text-muted-foreground">
                  Sobras: frente {geometry.clearances.front} m, fundo {geometry.clearances.rear} m, laterais {geometry.clearances.left} m.
                </p>
              </div>
            </div>
            <div>
              <p className="font-medium">Painel selecionado</p>
              <p className="text-muted-foreground">{panel.productName}</p>
            </div>
            <div>
              <p className="font-medium">Estrutura preliminar</p>
              <p className="text-muted-foreground">
                {structural.totalSteelKg} kg estimados | {structural.steelKgM2} kg/m2 | perfil principal {structural.selectedMainProfile.name}.
              </p>
            </div>
            <div>
              <p className="font-medium">Alertas</p>
              <div className="mt-2 space-y-2">
                {warnings.length === 0 ? (
                  <p className="text-muted-foreground">Sem alertas criticos no cenario atual.</p>
                ) : (
                  warnings.slice(0, 4).map((warning) => (
                    <div key={warning.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      {warning.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
        </>
      )}
    </div>
  );
}
