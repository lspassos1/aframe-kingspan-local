"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderOpen,
  Home,
  Layers3,
  Package,
  PlusCircle,
  Ruler,
  Save,
  Trash2,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionCard, AdvancedDisclosure, EmptyState, MetricCard, PageFrame, PageHeader, SectionHeader, StatusPill } from "@/components/shared/design-system";
import { getSavedProjectSummary, useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { calculatePanelLayout } from "@/lib/calculations/materials";
import { estimateSteelStructure } from "@/lib/calculations/structure";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import {
  calculateScenarioBudget,
  calculateScenarioGeometry,
  calculateScenarioMaterials,
  generateScenarioTechnicalSummary,
} from "@/lib/construction-methods/scenario-calculations";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import type { MaterialLine, Project, Scenario } from "@/types/project";

type GeometryRecord = Record<string, unknown>;

function readNumber(geometry: GeometryRecord, keys: string[]) {
  for (const key of keys) {
    const value = geometry[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function formatMeters(value: number | null) {
  return value === null ? "A confirmar" : `${formatCompactNumber(value)} m`;
}

function formatArea(value: number | null) {
  return value === null ? "A confirmar" : `${formatCompactNumber(value)} m2`;
}

function getPrimaryQuantity(project: Project, scenario: Scenario, geometry: GeometryRecord, materials: MaterialLine[]) {
  if (scenario.constructionMethod === "aframe") {
    const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
    const aFrameGeometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
    const layout = calculatePanelLayout(scenario, aFrameGeometry, panel, project.materialAssumptions.sparePanelCount);
    return {
      label: "Paineis",
      value: `${layout.totalPanels} un`,
      detail: `${formatCompactNumber(layout.totalPanelAreaM2)} m2 de painel`,
    };
  }

  const panelCount = readNumber(geometry, ["panelCount"]);
  if (panelCount !== null) {
    return {
      label: "Paineis",
      value: `${formatCompactNumber(panelCount)} un`,
      detail: `${formatArea(readNumber(geometry, ["netPanelAreaM2"]))} liquidos`,
    };
  }

  const totalBlocks = readNumber(geometry, ["totalBlocks"]);
  if (totalBlocks !== null) {
    return {
      label: "Blocos",
      value: `${formatCompactNumber(totalBlocks)} un`,
      detail: `${formatArea(readNumber(geometry, ["netMasonryAreaM2", "netWallAreaM2"]))} liquidos`,
    };
  }

  return {
    label: "Materiais",
    value: `${materials.length} linhas`,
    detail: "Quantitativos preliminares",
  };
}

function getNextSteps(scenario: Scenario, pendingPriceCount: number) {
  const shared = [
    "Confirmar medidas, aberturas e implantacao com projeto executivo.",
    pendingPriceCount > 0 ? "Cadastrar fontes de preco com data, unidade e confianca." : "Revisar validade das fontes de preco cadastradas.",
    "Exportar relatorio preliminar para cotacao e revisao tecnica.",
  ];

  if (scenario.constructionMethod === "aframe") {
    return ["Validar painel, estrutura, fundacao e fornecimento com responsaveis tecnicos.", ...shared];
  }

  return ["Validar o sistema construtivo com fornecedor, projetista e ART/RRT.", ...shared];
}

function getBudgetConfidence(pendingPriceCount: number, totalEstimatedCostBRL: number) {
  if (totalEstimatedCostBRL <= 0) return { label: "Sem precos", variant: "outline" as const };
  if (pendingPriceCount > 0) return { label: "Baixa", variant: "outline" as const };
  return { label: "Media", variant: "default" as const };
}

export default function DashboardPage() {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const project = useProjectStore((state) => state.project);
  const savedProjects = useProjectStore((state) => state.savedProjects);
  const openSavedProject = useProjectStore((state) => state.openSavedProject);
  const saveCurrentProject = useProjectStore((state) => state.saveCurrentProject);
  const resetProject = useProjectStore((state) => state.resetProject);
  const deleteSavedProject = useProjectStore((state) => state.deleteSavedProject);
  const scenario = useSelectedScenario();
  const method = getConstructionMethodDefinition(scenario.constructionMethod);
  const geometry = calculateScenarioGeometry(project, scenario) as GeometryRecord;
  const materials = calculateScenarioMaterials(project, scenario);
  const budget = calculateScenarioBudget(project, scenario);
  const technicalSummary = generateScenarioTechnicalSummary(project, scenario);
  const warnings = budget.warnings.filter((warning) => warning.level !== "info");
  const pendingPriceCount = budget.items.filter((item) => item.requiresConfirmation).length;
  const savedSummaries = savedProjects.map(getSavedProjectSummary);
  const activeProjectSaved = savedProjects.some((item) => item.id === project.id);
  const area = readNumber(geometry, ["combinedTotalArea", "builtAreaM2", "groundFloorTotalArea"]);
  const usefulArea = readNumber(geometry, ["combinedUsefulArea", "netMasonryAreaM2", "netWallAreaM2", "netPanelAreaM2", "groundUsefulArea"]);
  const width = readNumber(geometry, ["baseWidth", "widthM"]);
  const depth = readNumber(geometry, ["effectiveHouseDepth", "depthM"]);
  const height = readNumber(geometry, ["ridgeHeight", "floorHeightM"]);
  const primaryQuantity = getPrimaryQuantity(project, scenario, geometry, materials);
  const budgetConfidence = getBudgetConfidence(pendingPriceCount, budget.totalEstimatedCostBRL);
  const nextSteps = getNextSteps(scenario, pendingPriceCount);
  const mainMaterials = materials.slice(0, 5);
  const aFrameGeometry = scenario.constructionMethod === "aframe" ? calculateAFrameGeometry(scenario.terrain, scenario.aFrame) : null;
  const structural = scenario.constructionMethod === "aframe" ? estimateSteelStructure(project, scenario) : null;
  const primaryAction = pendingPriceCount > 0 ? { href: "/budget-assistant", label: "Resolver fontes" } : { href: "/export", label: "Exportar estudo" };
  const decisionCards = [
    {
      title: "Revisar dados da obra",
      description: width === null || depth === null ? "Complete medidas, lote e premissas antes de avançar." : "Medidas base disponíveis para revisão.",
      href: "/edit",
      icon: Ruler,
      tone: width === null || depth === null ? "warning" : "success",
      cta: "Abrir dados",
    },
    {
      title: "Conferir quantitativos",
      description: materials.length === 0 ? "Nenhum quantitativo gerado para o cenário atual." : `${materials.length} linhas prontas para análise por sistema.`,
      href: "/materials",
      icon: Package,
      tone: materials.length === 0 ? "warning" : "info",
      cta: "Ver materiais",
    },
    {
      title: "Aprovar fontes de preço",
      description: pendingPriceCount > 0 ? `${pendingPriceCount} item(ns) precisam de fonte ou confirmação.` : "Fontes cadastradas não apresentam pendência crítica.",
      href: "/budget-assistant",
      icon: Wallet,
      tone: pendingPriceCount > 0 ? "warning" : "success",
      cta: "Abrir base",
    },
    {
      title: "Gerar pacote de revisão",
      description: "Exporte JSON, planilhas e relatórios preliminares com pendências visíveis.",
      href: "/export",
      icon: FileText,
      tone: "pending",
      cta: "Exportar",
    },
  ] as const;

  const addProject = () => {
    saveCurrentProject();
    resetProject();
    setDetailsOpen(false);
  };

  const deleteProject = (projectId: string, projectName: string) => {
    if (!window.confirm(`Excluir "${projectName}" dos projetos salvos neste navegador?`)) return;
    deleteSavedProject(projectId);
    setDetailsOpen(false);
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Painel"
        title={project.name}
        status={
          <>
            <StatusPill tone="info" icon={false}>{method.name}</StatusPill>
            <StatusPill tone={activeProjectSaved ? "success" : "warning"}>{activeProjectSaved ? "Salvo" : "Não salvo"}</StatusPill>
          </>
        }
        description={<>{[scenario.location.city, scenario.location.state].filter(Boolean).join(", ") || "Local a confirmar"} | {scenario.name}</>}
        actions={
          <>
          <Button asChild>
            <Link href={primaryAction.href}>{primaryAction.label}</Link>
          </Button>
          <Button variant="outline" onClick={saveCurrentProject}>
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
          <Button variant="outline" onClick={addProject}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo projeto
          </Button>
          <Button variant="outline" onClick={() => setDetailsOpen((current) => !current)}>
            <ClipboardList className="mr-2 h-4 w-4" />
            {detailsOpen ? "Ocultar técnico" : "Ver técnico"}
          </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Area principal" value={formatArea(area)} detail={usefulArea ? `${formatArea(usefulArea)} de area util/liquida` : "Area preliminar"} icon={<Home className="h-5 w-5" />} />
        <MetricCard label="Implantacao" value={`${formatMeters(width)} x ${formatMeters(depth)}`} detail={`Altura ${formatMeters(height)}`} icon={<Ruler className="h-5 w-5" />} />
        <MetricCard label={primaryQuantity.label} value={primaryQuantity.value} detail={primaryQuantity.detail} icon={<Package className="h-5 w-5" />} />
        <MetricCard
          label="Orcamento preliminar"
          value={formatCurrency(budget.totalEstimatedCostBRL)}
          detail={`${pendingPriceCount} pendencia${pendingPriceCount === 1 ? "" : "s"} de preco/fonte`}
          icon={<Wallet className="h-5 w-5" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--background)))] p-5 shadow-sm shadow-foreground/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status do estudo</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal">Centro de decisão</h2>
            </div>
            <Badge variant={budgetConfidence.variant}>Confianca {budgetConfidence.label}</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatusItem label="Método" value={method.name} tone="neutral" />
            <StatusItem label="Pendências" value={pendingPriceCount === 0 ? "Sem preço pendente" : `${pendingPriceCount} de preço`} tone={pendingPriceCount === 0 ? "success" : "warning"} />
            <StatusItem label="Alertas técnicos" value={warnings.length === 0 ? "Sem críticos" : `${warnings.length} para revisar`} tone={warnings.length === 0 ? "success" : "warning"} />
          </div>
          <div className="mt-5 rounded-2xl border bg-background/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Próximo passo recomendado</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {pendingPriceCount > 0 ? "Resolva fontes de preço antes de tratar o orçamento como revisado." : "Gere o pacote preliminar com fontes, quantitativos e avisos técnicos."}
                </p>
              </div>
              <Button asChild className="shrink-0">
                <Link href={primaryAction.href}>{primaryAction.label}</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-card/90 p-5 shadow-sm shadow-foreground/5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Sequência guiada</h2>
          </div>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            {nextSteps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Fluxo do estudo"
          title="Do dado revisado ao orçamento com fonte"
          description="Cada bloco abre uma tarefa objetiva. Detalhes técnicos permanecem disponíveis, mas não disputam a primeira leitura."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {decisionCards.map((item) => (
            <ActionCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              description={item.description}
              badge={<StatusPill tone={item.tone} icon={false}>{item.cta}</StatusPill>}
              footer={
                <Button asChild variant={item.tone === "warning" ? "default" : "outline"} className="w-full">
                  <Link href={item.href}>{item.cta}</Link>
                </Button>
              }
            />
          ))}
        </div>
      </section>

      <AdvancedDisclosure
        icon={AlertCircle}
        title="Alertas técnicos"
        description={
          warnings.length === 0 ? "Nenhum alerta crítico no cenário atual." : `${warnings.length} alerta${warnings.length === 1 ? "" : "s"} disponível${warnings.length === 1 ? "" : "s"} para revisão.`
        }
        badge={<StatusPill tone={warnings.length === 0 ? "success" : "warning"} icon={false}>{warnings.length}</StatusPill>}
      >
          {warnings.length === 0 ? (
            <EmptyState title="Sem alertas críticos" description="Nenhum alerta crítico no cenário atual." />
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {warnings.map((warning) => (
                <div key={warning.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {warning.message}
                </div>
              ))}
            </div>
          )}
      </AdvancedDisclosure>

      {detailsOpen && (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border bg-card/90 p-5 shadow-sm shadow-foreground/5">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Detalhes tecnicos</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {technicalSummary.metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 font-semibold">{metric.value}</p>
                </div>
              ))}
              {aFrameGeometry && (
                <div className="rounded-xl border bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">Implantacao A-frame</p>
                  <p className="mt-1 font-semibold">{aFrameGeometry.fitsTerrain ? "Cabe no lote" : "Revisar recuos"}</p>
                </div>
              )}
              {structural && (
                <div className="rounded-xl border bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">Estrutura preliminar A-frame</p>
                  <p className="mt-1 font-semibold">
                    {formatCompactNumber(structural.totalSteelKg)} kg | {structural.selectedMainProfile.name}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-card/90 p-5 shadow-sm shadow-foreground/5">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Materiais principais</h2>
            </div>
            <div className="mt-4 divide-y rounded-xl border bg-background/70">
              {mainMaterials.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Nenhum material gerado para o cenario atual.</p>
              ) : (
                mainMaterials.map((line) => (
                  <div key={line.id} className="grid gap-1 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{line.description}</p>
                      <Badge variant={line.requiresConfirmation ? "outline" : "secondary"}>{line.requiresConfirmation ? "Revisar" : "Com fonte"}</Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {formatCompactNumber(line.quantity)} {line.unit} | {line.supplier}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border bg-card/90 shadow-sm shadow-foreground/5">
        <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Projetos salvos</h2>
            <p className="text-sm text-muted-foreground">Projetos mantidos neste navegador.</p>
          </div>
          <Badge variant={activeProjectSaved ? "default" : "outline"}>
            {activeProjectSaved ? "Atual salvo" : `${savedSummaries.length} salvo${savedSummaries.length === 1 ? "" : "s"}`}
          </Badge>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {savedSummaries.length === 0 ? (
            <EmptyState title="Nenhum projeto salvo" description="Use Salvar para manter este estudo no navegador." />
          ) : (
            savedSummaries.map((item) => (
              <article key={item.id} className="rounded-xl border bg-background/75 p-4 transition-colors hover:bg-muted/35">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.city || "Cidade nao informada"}
                      {item.state ? `, ${item.state}` : ""} | {item.scenarioCount} cenario{item.scenarioCount === 1 ? "" : "s"}
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
                      setDetailsOpen(false);
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
              </article>
            ))
          )}
        </div>
      </section>
    </PageFrame>
  );
}

function StatusItem({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" }) {
  return (
    <div className="rounded-2xl border bg-background/65 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2">
        <StatusPill tone={tone} icon={false}>{value}</StatusPill>
      </div>
    </div>
  );
}
