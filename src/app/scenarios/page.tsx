"use client";

import dynamic from "next/dynamic";
import { BarChart3, Copy, Home, Ruler, Trash2, WalletCards } from "lucide-react";
import { AdvancedDisclosure, BudgetGroupCard, MetricCard, PageFrame, PageHeader, SectionHeader, StatusPill } from "@/components/shared/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { compareScenarios } from "@/lib/calculations/scenarios";
import { formatCurrency } from "@/lib/format";
import { useProjectStore } from "@/lib/store/project-store";

const ScenarioComparisonChart = dynamic(
  () => import("@/components/charts/ScenarioComparisonChart").then((mod) => mod.ScenarioComparisonChart),
  {
    ssr: false,
    loading: () => <div className="h-full rounded-2xl bg-muted" />,
  }
);

export default function ScenariosPage() {
  const project = useProjectStore((state) => state.project);
  const selectScenario = useProjectStore((state) => state.selectScenario);
  const duplicateSelectedScenario = useProjectStore((state) => state.duplicateSelectedScenario);
  const deleteScenario = useProjectStore((state) => state.deleteScenario);
  const rows = compareScenarios(project);
  const selected = project.selectedScenarioId;
  const selectedRow = rows.find((row) => row.id === selected) ?? rows[0];
  const lowestCostRow = rows.length > 0 ? rows.reduce((current, row) => (row.totalCostBRL < current.totalCostBRL ? row : current)) : undefined;
  const terrainWarnings = rows.filter((row) => !row.fitsTerrain).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Cenários"
        title="Comparação de alternativas"
        description="Resumo de decisão entre dimensões, área útil, painéis, aço e custo preliminar. A tabela completa fica sob demanda."
        status={<StatusPill tone="info">{rows.length} cenário(s)</StatusPill>}
        actions={
          <Button onClick={duplicateSelectedScenario}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicar cenário atual
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Atual" value={selectedRow?.name ?? "Sem cenário"} detail="Base de comparação" icon={<Home className="h-4 w-4" />} />
        <MetricCard label="Menor custo" value={lowestCostRow ? formatCurrency(lowestCostRow.totalCostBRL) : "-"} detail={lowestCostRow?.name} icon={<WalletCards className="h-4 w-4" />} />
        <MetricCard label="Área útil atual" value={selectedRow ? `${selectedRow.groundUsefulArea + selectedRow.mezzanineUsefulArea} m²` : "-"} detail="Térreo + pav. superior" icon={<Ruler className="h-4 w-4" />} />
        <MetricCard label="Revisar terreno" value={terrainWarnings} detail="Cenários que não cabem" tone={terrainWarnings > 0 ? "warning" : "success"} icon={<BarChart3 className="h-4 w-4" />} />
      </section>

      {selectedRow ? (
        <BudgetGroupCard
          title="Cenário selecionado"
          description="Use este bloco para decidir se duplica, mantém ou ajusta a alternativa ativa antes de avançar para orçamento."
          status={<StatusPill tone={selectedRow.fitsTerrain ? "success" : "warning"}>{selectedRow.fitsTerrain ? "Cabe no lote" : "Revisar recuos"}</StatusPill>}
        >
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Dimensões</p>
              <p className="mt-2 text-sm font-medium">{selectedRow.width} x {selectedRow.depth} x {selectedRow.height} m</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Painéis</p>
              <p className="mt-2 text-sm font-medium">{selectedRow.totalPanels} un.</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Aço</p>
              <p className="mt-2 text-sm font-medium">{selectedRow.steelKg} kg</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total preliminar</p>
              <p className="mt-2 text-sm font-medium">{formatCurrency(selectedRow.totalCostBRL)}</p>
            </div>
          </div>
        </BudgetGroupCard>
      ) : null}

      <BudgetGroupCard title="Custo por m² útil" description="Gráfico para comparar rapidamente custo preliminar entre alternativas.">
        <div className="h-[320px]">
          <ScenarioComparisonChart data={rows} />
        </div>
      </BudgetGroupCard>

      <section className="space-y-4">
        <SectionHeader title="Tabela completa" description="Abra a memória comparativa quando precisar validar todos os campos técnicos." />
        <AdvancedDisclosure
          title="Comparativo detalhado"
          description="Dimensões, áreas, materiais, custo e ações por cenário."
          badge={<StatusPill tone="neutral">{rows.length} linha(s)</StatusPill>}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cenário</TableHead>
                  <TableHead>Largura</TableHead>
                  <TableHead>Prof.</TableHead>
                  <TableHead>Altura</TableHead>
                  <TableHead>Térreo útil</TableHead>
                  <TableHead>Pav. sup. útil</TableHead>
                  <TableHead>Painéis</TableHead>
                  <TableHead>Aço kg</TableHead>
                  <TableHead>Painéis R$</TableHead>
                  <TableHead>Total R$</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className={row.id === selected ? "bg-accent/60" : undefined}>
                    <TableCell className="min-w-72 font-medium">
                      <button type="button" onClick={() => selectScenario(row.id)} className="text-left hover:underline">
                        {row.name}
                      </button>
                    </TableCell>
                    <TableCell>{row.width} m</TableCell>
                    <TableCell>{row.depth} m</TableCell>
                    <TableCell>{row.height} m</TableCell>
                    <TableCell>{row.groundUsefulArea} m²</TableCell>
                    <TableCell>{row.mezzanineUsefulArea} m²</TableCell>
                    <TableCell>{row.totalPanels}</TableCell>
                    <TableCell>{row.steelKg}</TableCell>
                    <TableCell>{formatCurrency(row.panelPackageCostBRL)}</TableCell>
                    <TableCell>{formatCurrency(row.totalCostBRL)}</TableCell>
                    <TableCell>
                      <Badge variant={row.fitsTerrain ? "default" : "destructive"}>{row.fitsTerrain ? "cabe" : "revisar"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={project.scenarios.length <= 1}
                        onClick={() => deleteScenario(row.id)}
                        aria-label="Excluir cenário"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </AdvancedDisclosure>
      </section>
    </PageFrame>
  );
}
