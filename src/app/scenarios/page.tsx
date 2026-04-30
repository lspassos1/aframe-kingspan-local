"use client";

import dynamic from "next/dynamic";
import { Copy, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { compareScenarios } from "@/lib/calculations/scenarios";
import { formatCurrency } from "@/lib/format";
import { useProjectStore } from "@/lib/store/project-store";

const ScenarioComparisonChart = dynamic(
  () => import("@/components/charts/ScenarioComparisonChart").then((mod) => mod.ScenarioComparisonChart),
  {
    ssr: false,
    loading: () => <div className="h-full rounded-md bg-muted" />,
  }
);

export default function ScenariosPage() {
  const project = useProjectStore((state) => state.project);
  const selectScenario = useProjectStore((state) => state.selectScenario);
  const duplicateSelectedScenario = useProjectStore((state) => state.duplicateSelectedScenario);
  const deleteScenario = useProjectStore((state) => state.deleteScenario);
  const rows = compareScenarios(project);
  const selected = project.selectedScenarioId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Cenarios</p>
          <h1 className="text-3xl font-semibold tracking-normal">Comparacao de alternativas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Compare angulos, comprimentos de painel, area util, quantidade de paineis, peso de aco e custo preliminar.
          </p>
        </div>
        <Button onClick={duplicateSelectedScenario}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicar cenario atual
        </Button>
      </div>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle>Custo por m2 util</CardTitle>
        </CardHeader>
        <CardContent className="h-[340px]">
          <ScenarioComparisonChart data={rows} />
        </CardContent>
      </Card>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle>Tabela comparativa</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cenario</TableHead>
                <TableHead>Largura</TableHead>
                <TableHead>Prof.</TableHead>
                <TableHead>Altura</TableHead>
                <TableHead>Terreo util</TableHead>
                <TableHead>Pav. sup. util</TableHead>
                <TableHead>Paineis</TableHead>
                <TableHead>Aco kg</TableHead>
                <TableHead>Paineis R$</TableHead>
                <TableHead>Total R$</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acoes</TableHead>
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
                  <TableCell>{row.groundUsefulArea} m2</TableCell>
                  <TableCell>{row.mezzanineUsefulArea} m2</TableCell>
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
                      aria-label="Excluir cenario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
