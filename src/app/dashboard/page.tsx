"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, FolderOpen, Home, Package, PlusCircle, Ruler, Save, Trash2, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/MetricCard";
import { getSavedProjectSummary, useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { calculateBudget } from "@/lib/calculations/budget";
import { calculatePanelLayout } from "@/lib/calculations/materials";
import { estimateSteelStructure } from "@/lib/calculations/structure";
import { calculateConventionalMasonryBudget } from "@/lib/construction-methods/conventional-masonry/budget";
import { calculateConventionalMasonryGeometry } from "@/lib/construction-methods/conventional-masonry/geometry";
import { calculateConventionalMasonryMaterialList } from "@/lib/construction-methods/conventional-masonry/materials";
import { calculateEcoBlockBudget } from "@/lib/construction-methods/eco-block/budget";
import { calculateEcoBlockGeometry } from "@/lib/construction-methods/eco-block/geometry";
import { calculateEcoBlockMaterialList } from "@/lib/construction-methods/eco-block/materials";
import { formatCompactNumber, formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const project = useProjectStore((state) => state.project);
  const savedProjects = useProjectStore((state) => state.savedProjects);
  const openSavedProject = useProjectStore((state) => state.openSavedProject);
  const saveCurrentProject = useProjectStore((state) => state.saveCurrentProject);
  const resetProject = useProjectStore((state) => state.resetProject);
  const deleteSavedProject = useProjectStore((state) => state.deleteSavedProject);
  const scenario = useSelectedScenario();
  const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const layout = calculatePanelLayout(scenario, geometry, panel, project.materialAssumptions.sparePanelCount);
  const budget = calculateBudget(project, scenario);
  const structural = estimateSteelStructure(project, scenario);
  const isConventionalMasonry = scenario.constructionMethod === "conventional-masonry";
  const isEcoBlock = scenario.constructionMethod === "eco-block";
  const conventionalGeometry = isConventionalMasonry ? calculateConventionalMasonryGeometry({ project, scenario }) : null;
  const conventionalBudget = isConventionalMasonry ? calculateConventionalMasonryBudget({ project, scenario }) : null;
  const conventionalMaterials = isConventionalMasonry ? calculateConventionalMasonryMaterialList({ project, scenario }) : [];
  const ecoGeometry = isEcoBlock ? calculateEcoBlockGeometry({ project, scenario }) : null;
  const ecoBudget = isEcoBlock ? calculateEcoBlockBudget({ project, scenario }) : null;
  const ecoMaterials = isEcoBlock ? calculateEcoBlockMaterialList({ project, scenario }) : [];
  const warnings = (ecoBudget?.warnings ?? conventionalBudget?.warnings ?? budget.warnings).filter((warning) => warning.level !== "info");
  const pendingConventionalPrices = conventionalBudget?.items.filter((item) => item.requiresConfirmation).length ?? 0;
  const pendingEcoPrices = ecoBudget?.items.filter((item) => item.requiresConfirmation).length ?? 0;
  const savedSummaries = savedProjects.map(getSavedProjectSummary);
  const activeProjectSaved = savedProjects.some((item) => item.id === project.id);

  const addProject = () => {
    saveCurrentProject();
    resetProject();
    setDetailsOpen(true);
  };

  const deleteProject = (projectId: string, projectName: string) => {
    if (!window.confirm(`Excluir "${projectName}" dos projetos salvos neste navegador?`)) return;
    deleteSavedProject(projectId);
    setDetailsOpen(true);
  };

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
          <Button variant="outline" onClick={addProject}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar projeto
          </Button>
          {detailsOpen ? (
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Fechar detalhes
            </Button>
          ) : null}
          <Badge variant={isConventionalMasonry || isEcoBlock ? "outline" : geometry.fitsTerrain ? "default" : "destructive"} className="h-9 px-3">
            {isEcoBlock ? "Bloco ecologico preliminar" : isConventionalMasonry ? "Alvenaria preliminar" : geometry.fitsTerrain ? "Cabe no lote com os recuos" : "Revisar implantacao"}
          </Badge>
        </div>
      </div>

      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Projetos salvos</h2>
            <p className="text-sm text-muted-foreground">Salve, abra ou exclua projetos mantidos neste navegador.</p>
          </div>
          <Badge variant={activeProjectSaved ? "default" : "outline"}>
            {activeProjectSaved ? "Atual salvo" : `${savedSummaries.length} salvo${savedSummaries.length === 1 ? "" : "s"}`}
          </Badge>
        </div>
        <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
          {savedSummaries.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum projeto salvo ainda. Preencha o inicio do projeto ou use “Salvar projeto atual”.
            </div>
          ) : (
            savedSummaries.map((item) => (
              <div
                key={item.id}
                className="rounded-md border bg-background p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.city || "Cidade nao informada"}{item.state ? `, ${item.state}` : ""} · {item.scenarioCount} cenario
                      {item.scenarioCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  {item.id === project.id ? <Badge variant="secondary">Aberto</Badge> : null}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Atualizado {item.updatedAt ? new Date(item.updatedAt).toLocaleString("pt-BR") : "sem data"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      openSavedProject(item.id);
                      setDetailsOpen(true);
                    }}
                  >
                    <FolderOpen className="mr-2 h-3.5 w-3.5" />
                    Abrir
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteProject(item.id, item.name)}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Excluir
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {!detailsOpen ? null : (
        isEcoBlock && ecoGeometry && ecoBudget ? (
          <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Lote" value={`${scenario.terrain.width} x ${scenario.terrain.depth} m`} detail="Dimensoes e endereco editaveis" icon={<Ruler className="h-5 w-5" />} />
        <MetricCard label="Area construida" value={`${formatCompactNumber(ecoGeometry.builtAreaM2)} m2`} detail={`Pe-direito ${ecoGeometry.floorHeightM} m | perimetro ${ecoGeometry.perimeterM} m`} icon={<Home className="h-5 w-5" />} />
        <MetricCard label="Blocos" value={`${formatCompactNumber(ecoGeometry.totalBlocks)} un`} detail={`${ecoGeometry.specialBlocks} especiais/canaletas`} icon={<Package className="h-5 w-5" />} />
        <MetricCard label="Custo preliminar" value={formatCurrency(ecoBudget.totalEstimatedCostBRL)} detail={`${pendingEcoPrices} itens dependem de preco/fonte`} icon={<Wallet className="h-5 w-5" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle>Quantitativos de bloco ecologico</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Parede bruta" value={`${formatCompactNumber(ecoGeometry.grossWallAreaM2)} m2`} />
            <MetricCard label="Aberturas" value={`${formatCompactNumber(ecoGeometry.openingsAreaM2)} m2`} />
            <MetricCard label="Parede liquida" value={`${formatCompactNumber(ecoGeometry.netWallAreaM2)} m2`} />
            <MetricCard label="Argamassa/cola" value={`${formatCompactNumber(ecoGeometry.adhesiveMortarKg)} kg`} />
            <MetricCard label="Graute" value={`${formatCompactNumber(ecoGeometry.groutM3)} m3`} />
            <MetricCard label="Aco preliminar" value={`${formatCompactNumber(ecoGeometry.verticalSteelKg + ecoGeometry.horizontalSteelKg)} kg`} />
          </CardContent>
        </Card>

        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Metodo selecionado</p>
              <p className="text-muted-foreground">Bloco ecologico / solo-cimento com quantitativos preliminares.</p>
            </div>
            <div>
              <p className="font-medium">Materiais gerados</p>
              <p className="text-muted-foreground">{ecoMaterials.length} linhas iniciais, todas marcadas para confirmacao de preco e fonte.</p>
            </div>
            <div>
              <p className="font-medium">Alertas</p>
              <div className="mt-2 space-y-2">
                {warnings.slice(0, 6).map((warning) => (
                  <div key={warning.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    {warning.message}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
          </>
        ) : isConventionalMasonry && conventionalGeometry && conventionalBudget ? (
          <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Lote"
          value={`${scenario.terrain.width} x ${scenario.terrain.depth} m`}
          detail="Dimensoes e endereco editaveis"
          icon={<Ruler className="h-5 w-5" />}
        />
        <MetricCard
          label="Area construida"
          value={`${formatCompactNumber(conventionalGeometry.builtAreaM2)} m2`}
          detail={`${conventionalGeometry.floors} pav. | pe-direito ${conventionalGeometry.floorHeightM} m`}
          icon={<Home className="h-5 w-5" />}
        />
        <MetricCard
          label="Blocos"
          value={`${formatCompactNumber(conventionalGeometry.totalBlocks)} un`}
          detail={`${conventionalGeometry.blocksPerM2} blocos/m2 | ${conventionalGeometry.netMasonryAreaM2} m2 liquidos`}
          icon={<Package className="h-5 w-5" />}
        />
        <MetricCard
          label="Custo preliminar"
          value={formatCurrency(conventionalBudget.totalEstimatedCostBRL)}
          detail={`${pendingConventionalPrices} itens dependem de preco/fonte`}
          icon={<Wallet className="h-5 w-5" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle>Quantitativos de alvenaria</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Perimetro externo" value={`${formatCompactNumber(conventionalGeometry.perimeterM)} m`} />
            <MetricCard label="Parede externa bruta" value={`${formatCompactNumber(conventionalGeometry.externalWallGrossAreaM2)} m2`} />
            <MetricCard label="Paredes internas" value={`${formatCompactNumber(conventionalGeometry.internalWallGrossAreaM2)} m2`} />
            <MetricCard label="Aberturas" value={`${formatCompactNumber(conventionalGeometry.openingsAreaM2)} m2`} />
            <MetricCard label="Alvenaria liquida" value={`${formatCompactNumber(conventionalGeometry.netMasonryAreaM2)} m2`} />
            <MetricCard label="Argamassa" value={`${formatCompactNumber(conventionalGeometry.layingMortarM3)} m3`} />
          </CardContent>
        </Card>

        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Metodo selecionado</p>
              <p className="text-muted-foreground">Alvenaria convencional com quantitativos preliminares.</p>
            </div>
            <div>
              <p className="font-medium">Materiais gerados</p>
              <p className="text-muted-foreground">
                {conventionalMaterials.length} linhas iniciais, todas marcadas para confirmacao de preco e fonte.
              </p>
            </div>
            <div>
              <p className="font-medium">Alertas</p>
              <div className="mt-2 space-y-2">
                {warnings.slice(0, 5).map((warning) => (
                  <div key={warning.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    {warning.message}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
          </>
        ) : (
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
        )
      )}
    </div>
  );
}
