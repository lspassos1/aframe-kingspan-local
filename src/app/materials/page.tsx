"use client";

import { PackageCheck, Plus, Trash2 } from "lucide-react";
import type { MaterialCategory, MaterialUnit } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateMaterialList, calculatePanelLayout, splitLengthByAvailability } from "@/lib/calculations/materials";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { calculateConventionalMasonryGeometry } from "@/lib/construction-methods/conventional-masonry/geometry";
import { calculateConventionalMasonryMaterialList } from "@/lib/construction-methods/conventional-masonry/materials";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

export default function MaterialsPage() {
  const project = useProjectStore((state) => state.project);
  const updatePanelProduct = useProjectStore((state) => state.updatePanelProduct);
  const updateAccessory = useProjectStore((state) => state.updateAccessory);
  const updateCustomMaterial = useProjectStore((state) => state.updateCustomMaterial);
  const addCustomMaterial = useProjectStore((state) => state.addCustomMaterial);
  const deleteCustomMaterial = useProjectStore((state) => state.deleteCustomMaterial);
  const scenario = useSelectedScenario();
  const isConventionalMasonry = scenario.constructionMethod === "conventional-masonry";
  if (isConventionalMasonry) {
    const geometry = calculateConventionalMasonryGeometry({ project, scenario });
    const materials = calculateConventionalMasonryMaterialList({ project, scenario });
    const pendingItems = materials.filter((line) => line.requiresConfirmation).length;

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Materiais</p>
            <h1 className="text-3xl font-semibold tracking-normal">Quantitativos preliminares de alvenaria</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Blocos, argamassa, revestimentos, contrapiso e placeholders. Precos devem vir de composicoes ou cotacoes formais.
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-sm">
            {pendingItems} itens a precificar
          </Badge>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-md shadow-none">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Alvenaria liquida</p>
              <p className="mt-2 text-2xl font-semibold">{formatCompactNumber(geometry.netMasonryAreaM2)} m2</p>
            </CardContent>
          </Card>
          <Card className="rounded-md shadow-none">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Blocos</p>
              <p className="mt-2 text-2xl font-semibold">{formatCompactNumber(geometry.totalBlocks)} un</p>
            </CardContent>
          </Card>
          <Card className="rounded-md shadow-none">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Argamassa</p>
              <p className="mt-2 text-2xl font-semibold">{formatCompactNumber(geometry.layingMortarM3)} m3</p>
            </CardContent>
          </Card>
          <Card className="rounded-md shadow-none">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Area construida</p>
              <p className="mt-2 text-2xl font-semibold">{formatCompactNumber(geometry.builtAreaM2)} m2</p>
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
            <Table className="min-w-[980px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Codigo</TableHead>
                  <TableHead className="w-[360px]">Descricao</TableHead>
                  <TableHead className="w-28">Categoria</TableHead>
                  <TableHead className="w-24 text-right">Qtd.</TableHead>
                  <TableHead className="w-20">Un.</TableHead>
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
                      <Badge variant="secondary">preco/fonte pendente</Badge>
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

  const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const layout = calculatePanelLayout(scenario, geometry, panel, project.materialAssumptions.sparePanelCount);
  const materials = calculateMaterialList(project, scenario);
  const total = materials.reduce((sum, line) => sum + line.netTotalBRL, 0);
  const numberOrUndefined = (value: string) => (value === "" ? undefined : Number(value));

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
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Materiais configuraveis</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Adicione telhas, acabamentos ou outros materiais, informe medidas/precos e ative para entrar no orcamento.
            </p>
          </div>
          <Button type="button" onClick={addCustomMaterial}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar material
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[1480px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Usar</TableHead>
                <TableHead className="w-44">Codigo</TableHead>
                <TableHead className="w-72">Descricao</TableHead>
                <TableHead className="w-32">Categoria</TableHead>
                <TableHead className="w-24">Un.</TableHead>
                <TableHead className="w-24">Qtd.</TableHead>
                <TableHead className="w-24">Comp.</TableHead>
                <TableHead className="w-24">Larg.</TableHead>
                <TableHead className="w-28">Max telha</TableHead>
                <TableHead className="w-28">Preco</TableHead>
                <TableHead className="w-36">Acab. interno</TableHead>
                <TableHead className="w-56">Status</TableHead>
                <TableHead className="w-14"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {project.customMaterials.map((item) => {
                const split = splitLengthByAvailability(item.lengthM ?? 0, item.maxLengthM, item.lengthIncrementM ?? 1);
                return (
                  <TableRow key={item.id} className="align-top">
                    <TableCell className="align-top">
                      <Checkbox checked={item.enabled} onCheckedChange={(checked) => updateCustomMaterial(item.id, { enabled: Boolean(checked) })} />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input value={item.code} onChange={(event) => updateCustomMaterial(item.id, { code: event.target.value })} />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input value={item.description} onChange={(event) => updateCustomMaterial(item.id, { description: event.target.value })} />
                      <Label className="mt-2 block text-xs text-muted-foreground">Fornecedor</Label>
                      <Input value={item.supplier} onChange={(event) => updateCustomMaterial(item.id, { supplier: event.target.value })} />
                    </TableCell>
                    <TableCell className="align-top">
                      <Select value={item.category} onValueChange={(value) => updateCustomMaterial(item.id, { category: value as MaterialCategory })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["panels", "flashings", "fasteners", "sealants", "facade", "civil", "labor", "other"].map((value) => (
                            <SelectItem value={value} key={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top">
                      <Select value={item.unit} onValueChange={(value) => updateCustomMaterial(item.id, { unit: value as MaterialUnit })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["un", "m", "m2", "m3", "kg", "package", "lot"].map((value) => (
                            <SelectItem value={value} key={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top">
                      <Input type="number" step="0.01" value={item.quantity} onChange={(event) => updateCustomMaterial(item.id, { quantity: Number(event.target.value) })} />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.lengthM ?? ""}
                        onChange={(event) => updateCustomMaterial(item.id, { lengthM: numberOrUndefined(event.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.widthM ?? ""}
                        onChange={(event) => updateCustomMaterial(item.id, { widthM: numberOrUndefined(event.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.maxLengthM ?? ""}
                        onChange={(event) => updateCustomMaterial(item.id, { maxLengthM: numberOrUndefined(event.target.value), lengthIncrementM: item.lengthIncrementM ?? 1 })}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">mult. {item.lengthIncrementM ?? 1} m</p>
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPriceBRL ?? ""}
                        onChange={(event) => updateCustomMaterial(item.id, { unitPriceBRL: numberOrUndefined(event.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input value={item.internalFinish ?? ""} onChange={(event) => updateCustomMaterial(item.id, { internalFinish: event.target.value })} />
                    </TableCell>
                    <TableCell className="whitespace-normal align-top text-xs">
                      {split.exceeded ? (
                        <Badge variant="secondary" className="whitespace-normal text-left leading-tight">
                          excede max.; usar {split.segments} pecas de {split.segmentLengthM} m
                        </Badge>
                      ) : (
                        <Badge variant="outline">ok</Badge>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <Button type="button" variant="ghost" size="icon" onClick={() => deleteCustomMaterial(item.id)} aria-label="Excluir material">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
