"use client";

import { AlertCircle, CheckCircle2, Home, Package, Ruler, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/MetricCard";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { calculateBudget } from "@/lib/calculations/budget";
import { calculatePanelLayout } from "@/lib/calculations/materials";
import { estimateSteelStructure } from "@/lib/calculations/structure";
import { formatCompactNumber, formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const layout = calculatePanelLayout(scenario, geometry, panel, project.materialAssumptions.sparePanelCount);
  const budget = calculateBudget(project, scenario);
  const structural = estimateSteelStructure(project, scenario);
  const warnings = budget.warnings.filter((warning) => warning.level !== "info");

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
        <Badge variant={geometry.fitsTerrain ? "default" : "destructive"} className="w-fit">
          {geometry.fitsTerrain ? "Cabe no lote com os recuos" : "Revisar implantacao"}
        </Badge>
      </div>

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
    </div>
  );
}
