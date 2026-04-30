"use client";

import { PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateMaterialList, calculatePanelLayout } from "@/lib/calculations/materials";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { formatCurrency } from "@/lib/format";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

export default function MaterialsPage() {
  const project = useProjectStore((state) => state.project);
  const updatePanelProduct = useProjectStore((state) => state.updatePanelProduct);
  const updateAccessory = useProjectStore((state) => state.updateAccessory);
  const scenario = useSelectedScenario();
  const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const layout = calculatePanelLayout(scenario, geometry, panel, project.materialAssumptions.sparePanelCount);
  const materials = calculateMaterialList(project, scenario);
  const total = materials.reduce((sum, line) => sum + line.netTotalBRL, 0);

  const updateLinePrice = (lineId: string, value: string) => {
    const price = value === "" ? undefined : Number(value);
    if (lineId === "panels") {
      updatePanelProduct(panel.id, { pricePerPanelBRL: price });
      return;
    }
    updateAccessory(lineId, { unitPriceBRL: price });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Materiais</p>
          <h1 className="text-3xl font-semibold tracking-normal">Lista de materiais recalculada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Quantidades derivadas da geometria. Precos sao editaveis e devem ser atualizados por cotacao formal.
          </p>
        </div>
        <Badge variant="outline" className="w-fit text-sm">
          Total liquido: {formatCurrency(total)}
        </Badge>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Paineis por agua</p>
            <p className="mt-2 text-2xl font-semibold">{layout.panelsPerSlope}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total de paineis</p>
            <p className="mt-2 text-2xl font-semibold">{layout.totalPanels}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Area de paineis</p>
            <p className="mt-2 text-2xl font-semibold">{layout.totalPanelAreaM2} m2</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Sobra tecnica</p>
            <p className="mt-2 text-2xl font-semibold">{layout.wasteAreaM2} m2</p>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Material take-off
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[1180px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-56">Codigo</TableHead>
                <TableHead className="w-[360px]">Descricao</TableHead>
                <TableHead className="w-28">Categoria</TableHead>
                <TableHead className="w-24 text-right">Qtd.</TableHead>
                <TableHead className="w-20">Un.</TableHead>
                <TableHead className="w-36">Preco un.</TableHead>
                <TableHead className="w-32 text-right">Liquido</TableHead>
                <TableHead className="w-44">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((line) => (
                <TableRow key={line.id} className="align-top">
                  <TableCell className="whitespace-normal break-words align-top font-mono text-xs leading-relaxed">{line.code}</TableCell>
                  <TableCell className="whitespace-normal break-words align-top">
                    <div className="font-medium">{line.description}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{line.notes}</div>
                  </TableCell>
                  <TableCell className="whitespace-normal break-words align-top">{line.category}</TableCell>
                  <TableCell className="align-top text-right">{line.quantity}</TableCell>
                  <TableCell className="align-top">{line.unit}</TableCell>
                  <TableCell className="align-top">
                    <Input
                      type="number"
                      step="0.01"
                      defaultValue={line.unitPriceBRL ?? ""}
                      onBlur={(event) => updateLinePrice(line.id, event.target.value)}
                      className="h-8 w-28"
                    />
                  </TableCell>
                  <TableCell className="align-top text-right">{formatCurrency(line.netTotalBRL)}</TableCell>
                  <TableCell className="whitespace-normal align-top">
                    {line.requiresConfirmation ? (
                      <Badge variant="secondary" className="whitespace-normal text-center leading-tight">
                        confirmar fornecedor
                      </Badge>
                    ) : (
                      <Badge variant="outline">calculado</Badge>
                    )}
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
