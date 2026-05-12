"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, FileWarning, PencilLine, ShieldAlert, WalletCards } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdvancedDisclosure, BudgetGroupCard, InlineHelp, MetricCard, PageFrame, PageHeader, StatusPill } from "@/components/shared/design-system";
import { GuidedActionPanel } from "@/components/shared/GuidedActionPanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { estimateRadierFoundation } from "@/lib/calculations/foundation";
import { calculateScenarioBudget, calculateScenarioGeometry } from "@/lib/construction-methods/scenario-calculations";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import type { GuidedActionItem } from "@/lib/ux/guided-actions";
import type { BudgetItem, BudgetSummary, FoundationAssumptions, MaterialCategory, Project } from "@/types/project";

const BudgetCategoryChart = dynamic(
  () => import("@/components/charts/BudgetCategoryChart").then((mod) => mod.BudgetCategoryChart),
  {
    ssr: false,
    loading: () => <div className="h-full rounded-2xl bg-muted" />,
  }
);

const foundationMaterialIds = new Set([
  "foundation-concrete",
  "foundation-fiber",
  "foundation-subbase",
  "foundation-vapor-barrier",
  "foundation-formwork",
]);

const foundationLaborIds = new Set(["foundation-soil-prep", "foundation-labor"]);
const foundationEquipmentIds = new Set(["foundation-pump"]);

const categoryLabels: Record<MaterialCategory, string> = {
  panels: "Paredes e painéis",
  fasteners: "Fixação",
  flashings: "Arremates",
  sealants: "Vedação",
  facade: "Aberturas e fachada",
  steel: "Estrutura",
  civil: "Civil e fundação",
  labor: "Mão de obra",
  technical: "Técnico",
  freight: "Frete",
  contingency: "Contingência",
  other: "Outros",
};

function readNumber(geometry: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = geometry[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function formatArea(value: number | null) {
  return value === null ? "A confirmar" : `${formatCompactNumber(value)} m2`;
}

function groupItems(items: BudgetItem[]) {
  const groups = new Map<MaterialCategory, BudgetItem[]>();
  items.forEach((item) => {
    const current = groups.get(item.category) ?? [];
    current.push(item);
    groups.set(item.category, current);
  });

  return Array.from(groups.entries()).map(([category, lines]) => ({
    category,
    label: categoryLabels[category],
    lines,
    total: lines.reduce((sum, item) => sum + item.netTotalBRL, 0),
    pending: lines.filter((item) => item.requiresConfirmation).length,
  }));
}

function chartDataForBudget(budget: BudgetSummary) {
  return [
    { name: "Painéis", value: budget.panelPackageCostBRL },
    { name: "Acessórios", value: budget.accessoriesCostBRL },
    { name: "Frete", value: budget.freightBRL },
    { name: "Aço", value: budget.steelStructureCostBRL },
    { name: "Fundação", value: budget.foundationCostBRL },
    { name: "Civil compl.", value: budget.civilPlaceholderBRL },
    { name: "Mão obra", value: budget.laborEquipmentBRL },
    { name: "Técnico", value: budget.technicalLegalBRL },
    { name: "Conting.", value: budget.contingencyBRL },
  ].filter((item) => item.value > 0);
}

function statusForItem(item: BudgetItem) {
  if (item.requiresConfirmation) {
    return { tone: "warning" as const, label: "Fonte pendente", action: "Informar fonte, data-base e confiança" };
  }
  return { tone: "success" as const, label: "Calculado", action: "Conferir revisão humana" };
}

export default function BudgetPage() {
  const project = useProjectStore((state) => state.project);
  const updateBudgetAssumptions = useProjectStore((state) => state.updateBudgetAssumptions);
  const updateFoundationAssumptions = useProjectStore((state) => state.updateFoundationAssumptions);
  const scenario = useSelectedScenario();
  const method = getConstructionMethodDefinition(scenario.constructionMethod);
  const geometry = calculateScenarioGeometry(project, scenario) as Record<string, unknown>;
  const budget = calculateScenarioBudget(project, scenario);
  const groups = groupItems(budget.items);
  const pendingItems = budget.items.filter((item) => item.requiresConfirmation);
  const warningItems = budget.warnings.filter((warning) => warning.level !== "info");
  const builtArea = readNumber(geometry, ["builtAreaM2", "combinedTotalArea", "groundFloorTotalArea"]);
  const chartData = chartDataForBudget(budget);
  const isAFrame = scenario.constructionMethod === "aframe";
  const budgetGuidedActions: GuidedActionItem[] = [
    ...(pendingItems.length > 0
      ? [
          {
            id: "budget-pending-prices",
            kind: "manual-price" as const,
            title: "Preços pendentes",
            description: "Revise fonte, unidade e região antes de tratar qualquer linha como orçamento revisado.",
            status: `${pendingItems.length} pendente(s)`,
            tone: "warning" as const,
            actions: [
              { label: "Revisar fonte", href: "/budget-assistant" },
              { label: "Preencher preço", href: "/budget-assistant#manual-price-link", variant: "outline" as const },
            ],
          },
        ]
      : []),
    ...(warningItems.length > 0
      ? [
          {
            id: "budget-technical-alerts",
            kind: "review" as const,
            title: "Avisos técnicos",
            description: "Premissas técnicas devem acompanhar o estudo e ser revisadas antes de decisão de obra.",
            status: `${warningItems.length} aviso(s)`,
            tone: "pending" as const,
            actions: [
              { label: "Abrir projeto técnico", href: "/technical-project" },
              { label: "Exportar preliminar", href: "/export", variant: "outline" as const },
            ],
          },
        ]
      : []),
  ];
  const foundation = isAFrame ? estimateRadierFoundation(scenario, project.foundationAssumptions) : null;
  const foundationMaterialCostBRL = foundation
    ? foundation.items.filter((item) => foundationMaterialIds.has(item.id)).reduce((sum, item) => sum + item.netTotalBRL, 0)
    : 0;
  const foundationLaborCostBRL = foundation
    ? foundation.items.filter((item) => foundationLaborIds.has(item.id)).reduce((sum, item) => sum + item.netTotalBRL, 0)
    : 0;
  const foundationEquipmentCostBRL = foundation
    ? foundation.items.filter((item) => foundationEquipmentIds.has(item.id)).reduce((sum, item) => sum + item.netTotalBRL, 0)
    : 0;
  const foundationFormulaRows = foundation
    ? [
        { label: "Área orçada", formula: `(${foundation.widthM} m x ${foundation.depthM} m)`, result: `${foundation.areaM2} m2` },
        { label: "Concreto da placa", formula: `${foundation.areaM2} m2 x ${project.foundationAssumptions.slabThicknessM} m`, result: `${foundation.slabConcreteM3} m3` },
        {
          label: "Concreto da viga de borda",
          formula: `${foundation.perimeterM} m x ${project.foundationAssumptions.edgeBeamWidthM} m x ${project.foundationAssumptions.edgeBeamDepthM} m`,
          result: `${foundation.edgeBeamConcreteM3} m3`,
        },
        { label: "Concreto total com perda", formula: `(placa + borda) x ${100 + project.foundationAssumptions.wastePercent}%`, result: `${foundation.concreteM3} m3` },
        { label: "Fibra", formula: `${foundation.concreteM3} m3 x ${project.foundationAssumptions.fiberDosageKgM3} kg/m3`, result: `${foundation.fiberKg} kg` },
        { label: "Sub-base", formula: `${foundation.areaM2} m2 x ${project.foundationAssumptions.subbaseThicknessM} m`, result: `${foundation.subbaseM3} m3` },
        { label: "Lona/barreira", formula: `${foundation.areaM2} m2 x 1,05`, result: `${foundation.vaporBarrierM2} m2` },
        { label: "Forma lateral", formula: "perímetro externo do radier", result: `${foundation.formworkM} m` },
      ]
    : [];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Orçamento"
        title="Orçamento preliminar com rastreabilidade"
        description="A tela prioriza decisão: total, custo por área, fonte, pendência e ação necessária. Tabelas técnicas ficam sob demanda."
        status={
          <>
            <StatusPill tone="warning">Preliminar</StatusPill>
            <StatusPill tone="info" icon={false}>{method.name}</StatusPill>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total preliminar" value={formatCurrency(budget.totalEstimatedCostBRL)} detail="Não é orçamento final" tone="warning" icon={<WalletCards className="h-4 w-4" />} />
        <MetricCard label="Custo/m2" value={formatCurrency(budget.costPerTotalM2)} detail={`Área: ${formatArea(builtArea)}`} />
        <MetricCard label="Itens com pendência" value={pendingItems.length} detail="Fonte, unidade ou revisão" tone={pendingItems.length > 0 ? "warning" : "success"} icon={<FileWarning className="h-4 w-4" />} />
        <MetricCard label="Alertas técnicos" value={warningItems.length} detail="Fundação, estrutura e premissas" tone={warningItems.length > 0 ? "warning" : "success"} icon={<ShieldAlert className="h-4 w-4" />} />
      </section>

      <GuidedActionPanel items={budgetGuidedActions} />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <BudgetGroupCard
          title="Prontidão para orçamento"
          description="O sistema calcula, mas a aprovação depende de revisão humana e fonte rastreável."
          status={<StatusPill tone={pendingItems.length > 0 || warningItems.length > 0 ? "warning" : "success"}>{pendingItems.length > 0 ? "Resolver pendências" : "Sem bloqueio crítico"}</StatusPill>}
          contentClassName="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadinessItem
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Quantidades calculadas"
              detail={`${budget.items.length} item(ns) de orçamento gerados pelo método atual.`}
              tone={budget.items.length > 0 ? "success" : "warning"}
            />
            <ReadinessItem
              icon={<PencilLine className="h-4 w-4" />}
              title="Revisão pendente"
              detail={pendingItems.length > 0 ? "Itens sem fonte revisada continuam bloqueados." : "Itens não exigem confirmação imediata."}
              tone={pendingItems.length > 0 ? "warning" : "success"}
            />
            <ReadinessItem
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Alertas técnicos"
              detail={warningItems.length > 0 ? "Há premissas que exigem responsável técnico." : "Sem alerta crítico no cálculo atual."}
              tone={warningItems.length > 0 ? "warning" : "success"}
            />
            <ReadinessItem
              icon={<WalletCards className="h-4 w-4" />}
              title="Fonte de preço"
              detail="Use Base de preços para vincular SINAPI/cotações antes de aprovar."
              tone="pending"
            />
          </div>
          {pendingItems.length > 0 ? (
            <InlineHelp tone="warning">
              Preço sem fonte, unidade incompatível, região divergente ou revisão técnica pendente não deve entrar como orçamento revisado.
            </InlineHelp>
          ) : null}
        </BudgetGroupCard>

        <BudgetGroupCard title="Distribuição do custo" description="Leitura visual do orçamento preliminar por grupo." contentClassName="h-[360px]">
          {chartData.length > 0 ? <BudgetCategoryChart data={chartData} /> : <div className="grid h-full place-items-center rounded-2xl border border-dashed text-sm text-muted-foreground">Sem valores suficientes para gráfico.</div>}
        </BudgetGroupCard>
      </section>

      <BudgetGroupCard
        title="Itens por sistema"
        description="Cards de decisão substituem a tabela como leitura principal. Cada grupo mostra total, pendência e próximas ações."
        status={<StatusPill tone="info" icon={false}>{groups.length} grupos</StatusPill>}
        contentClassName="grid gap-4 lg:grid-cols-2"
      >
        {groups.map((group) => (
          <article key={group.category} className="rounded-2xl border bg-background/75 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{group.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{group.lines.length} item(ns) · {formatCurrency(group.total)}</p>
              </div>
              <StatusPill tone={group.pending > 0 ? "warning" : "success"} icon={false}>
                {group.pending > 0 ? `${group.pending} pendente(s)` : "Calculado"}
              </StatusPill>
            </div>
            <div className="mt-4 space-y-3">
              {group.lines.slice(0, 3).map((item) => {
                const status = statusForItem(item);
                return (
                  <div key={item.id} className="rounded-xl border bg-card/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium leading-5">{item.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCompactNumber(item.quantity)} {item.unit} · {formatCurrency(item.netTotalBRL)}
                        </p>
                      </div>
                      <StatusPill tone={status.tone} icon={false}>{status.label}</StatusPill>
                    </div>
                    {item.requiresConfirmation ? <p className="mt-2 text-xs text-amber-800">{status.action}</p> : null}
                  </div>
                );
              })}
              {group.lines.length > 3 ? <p className="text-xs text-muted-foreground">+ {group.lines.length - 3} item(ns) na tabela técnica.</p> : null}
            </div>
          </article>
        ))}
      </BudgetGroupCard>

      {foundation ? (
        <BudgetGroupCard
          title="Fundação preliminar"
          description="Radier com fibras permanece premissa editável, sempre com alerta técnico."
          status={<StatusPill tone="warning">Revisão técnica</StatusPill>}
          contentClassName="space-y-5"
        >
          <div className="flex items-center justify-between rounded-2xl border bg-background/75 p-4">
            <div>
              <Label>Incluir radier no orçamento</Label>
              <p className="text-sm text-muted-foreground">Usa a implantação da casa com folga perimetral.</p>
            </div>
            <Checkbox checked={project.foundationAssumptions.enabled} onCheckedChange={(checked) => updateFoundationAssumptions({ enabled: Boolean(checked) })} />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Total radier" value={formatCurrency(foundation.totalBRL)} detail={`${foundation.areaM2} m2`} tone="warning" />
            <MetricCard label="Materiais" value={formatCurrency(foundationMaterialCostBRL)} detail="Concreto, fibra, sub-base" />
            <MetricCard label="Mão de obra" value={formatCurrency(foundationLaborCostBRL)} detail="Preparação e execução" />
            <MetricCard label="Equipamento" value={formatCurrency(foundationEquipmentCostBRL)} detail="Bomba/mobilização" />
          </div>
          <AdvancedDisclosure title="Parâmetros editáveis da fundação" description="Campos técnicos ficam sob demanda para não dominar a leitura do orçamento.">
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
              {foundationInputRows.map(({ key, label }) => (
                <NumberInput
                  key={key}
                  label={label}
                  value={project.foundationAssumptions[key]}
                  onChange={(value) => updateFoundationAssumptions({ [key]: value } as Partial<FoundationAssumptions>)}
                />
              ))}
            </div>
          </AdvancedDisclosure>
          <AdvancedDisclosure title="Memória de cálculo do radier" description="Fórmulas auditáveis usadas para a estimativa preliminar.">
            <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="divide-y rounded-2xl border bg-background/70">
                {foundationFormulaRows.map((row) => (
                  <div className="grid gap-1 px-4 py-3 text-sm" key={row.label}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{row.label}</span>
                      <span className="font-semibold">{row.result}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{row.formula}</p>
                  </div>
                ))}
              </div>
              <BudgetLinesTable
                items={foundation.items.map((item) => ({
                  id: item.id,
                  category: foundationMaterialIds.has(item.id) ? "civil" : foundationLaborIds.has(item.id) ? "labor" : "other",
                  description: item.description,
                  quantity: item.quantity,
                  unit: item.unit,
                  unitPriceBRL: item.unitPriceBRL,
                  grossTotalBRL: item.netTotalBRL,
                  discountBRL: 0,
                  netTotalBRL: item.netTotalBRL,
                  supplier: foundationMaterialIds.has(item.id) ? "Parâmetro material" : foundationLaborIds.has(item.id) ? "Parâmetro mão de obra" : "Parâmetro equipamento",
                  notes: item.notes,
                  requiresConfirmation: true,
                }))}
                compact
              />
            </div>
          </AdvancedDisclosure>
        </BudgetGroupCard>
      ) : null}

      {isAFrame ? (
        <BudgetGroupCard title="Complementos editáveis" description="Valores complementares ficam explícitos, mas fora da primeira leitura." contentClassName="space-y-4">
          <AdvancedDisclosure title="Premissas financeiras complementares" description="Use somente valores com fonte ou cotação. Campos vazios continuam pendentes.">
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
              {budgetAssumptionRows.map(({ key, label }) => (
                <NumberInput
                  key={key}
                  label={label}
                  value={project.budgetAssumptions[key] as number | undefined}
                  onChange={(value) => updateBudgetAssumptions({ [key]: value } as Partial<Project["budgetAssumptions"]>)}
                />
              ))}
            </div>
          </AdvancedDisclosure>
        </BudgetGroupCard>
      ) : null}

      <AdvancedDisclosure
        title="Tabela técnica do orçamento"
        description="Use a tabela para conferência detalhada, auditoria ou cópia. A leitura principal fica nos cards acima."
        badge={<StatusPill tone="neutral" icon={false}>{budget.items.length} itens</StatusPill>}
      >
        <BudgetLinesTable items={budget.items} />
      </AdvancedDisclosure>
    </PageFrame>
  );
}

type NumericFoundationAssumptionKey = {
  [Key in keyof FoundationAssumptions]: FoundationAssumptions[Key] extends number ? Key : never;
}[keyof FoundationAssumptions];

type BudgetAssumptionKey = keyof Project["budgetAssumptions"];

const foundationInputRows: Array<{ key: NumericFoundationAssumptionKey; label: string }> = [
  { key: "extraPerimeterM", label: "Folga perimetral (m)" },
  { key: "slabThicknessM", label: "Esp. placa (m)" },
  { key: "edgeBeamWidthM", label: "Viga borda larg. (m)" },
  { key: "edgeBeamDepthM", label: "Viga borda alt. (m)" },
  { key: "subbaseThicknessM", label: "Sub-base (m)" },
  { key: "wastePercent", label: "Perda (%)" },
  { key: "concreteUnitPriceBRLM3", label: "Concreto (R$/m3)" },
  { key: "fiberDosageKgM3", label: "Fibra (kg/m3)" },
  { key: "fiberUnitPriceBRLKg", label: "Fibra (R$/kg)" },
  { key: "subbaseUnitPriceBRLM3", label: "Sub-base (R$/m3)" },
  { key: "vaporBarrierUnitPriceBRLM2", label: "Lona (R$/m2)" },
  { key: "formworkUnitPriceBRLM", label: "Forma (R$/m)" },
  { key: "laborUnitPriceBRLM2", label: "MO radier (R$/m2)" },
  { key: "soilPrepUnitPriceBRLM2", label: "Preparo solo (R$/m2)" },
  { key: "pumpBRL", label: "Bomba/mob. (R$)" },
];

const budgetAssumptionRows: Array<{ key: BudgetAssumptionKey; label: string }> = [
  { key: "foundationPlaceholderBRL", label: "Fundação extra (R$)" },
  { key: "slabPlaceholderBRL", label: "Laje extra (R$)" },
  { key: "drainagePlaceholderBRL", label: "Drenagem (R$)" },
  { key: "frontFacadePlaceholderBRL", label: "Fachada frontal (R$)" },
  { key: "rearClosurePlaceholderBRL", label: "Fechamento posterior (R$)" },
  { key: "doorsWindowsPlaceholderBRL", label: "Portas/janelas (R$)" },
  { key: "panelInstallationLaborBRLM2", label: "Instalação painéis (R$/m2)" },
  { key: "liftingEquipmentBRL", label: "Içamento (R$)" },
  { key: "scaffoldingBRL", label: "Andaimes (R$)" },
  { key: "architectPlaceholderBRL", label: "Arquiteto (R$)" },
  { key: "engineerPlaceholderBRL", label: "Engenheiro/ART (R$)" },
  { key: "municipalApprovalPlaceholderBRL", label: "Aprovação (R$)" },
  { key: "contingencyPercent", label: "Contingência (%)" },
];

function NumberInput({ label, value, onChange }: { label: string; value: number | undefined; onChange: (value: number | undefined) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        step="0.01"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      />
    </div>
  );
}

function ReadinessItem({
  icon,
  title,
  detail,
  tone,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  tone: "success" | "warning" | "pending";
}) {
  return (
    <div className="rounded-2xl border bg-background/75 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border bg-card text-muted-foreground">{icon}</span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{title}</p>
            <StatusPill tone={tone} icon={false}>{tone === "success" ? "ok" : tone === "warning" ? "ação" : "próximo"}</StatusPill>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function BudgetLinesTable({ items, compact = false }: { items: BudgetItem[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-background/70">
      <Table className={compact ? "min-w-[820px]" : "min-w-[1120px] table-fixed"}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">Sistema</TableHead>
            <TableHead className="w-[340px]">Descrição</TableHead>
            <TableHead className="w-24 text-right">Qtd.</TableHead>
            <TableHead className="w-20">Un.</TableHead>
            <TableHead className="w-32 text-right">Preço unit.</TableHead>
            <TableHead className="w-32 text-right">Total</TableHead>
            <TableHead className="w-44">Fonte/status</TableHead>
            {!compact ? <TableHead className="w-[320px]">Notas</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const status = statusForItem(item);
            return (
              <TableRow key={item.id} className="align-top">
                <TableCell className="align-top">{categoryLabels[item.category]}</TableCell>
                <TableCell className="whitespace-normal break-words align-top font-medium">{item.description}</TableCell>
                <TableCell className="align-top text-right">{formatCompactNumber(item.quantity)}</TableCell>
                <TableCell className="align-top">{item.unit}</TableCell>
                <TableCell className="align-top text-right">{item.unitPriceBRL ? formatCurrency(item.unitPriceBRL) : "A confirmar"}</TableCell>
                <TableCell className="align-top text-right">{formatCurrency(item.netTotalBRL)}</TableCell>
                <TableCell className="align-top">
                  <StatusPill tone={status.tone} icon={false}>{item.supplier || status.label}</StatusPill>
                </TableCell>
                {!compact ? <TableCell className="whitespace-normal break-words align-top text-xs text-muted-foreground">{item.notes}</TableCell> : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
