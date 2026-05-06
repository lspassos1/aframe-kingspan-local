"use client";

import { AlertTriangle, Boxes, Plus, Trash2 } from "lucide-react";
import type { MaterialCategory, MaterialLine, MaterialUnit } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdvancedDisclosure, BudgetGroupCard, MetricCard, PageFrame, PageHeader, StatusPill } from "@/components/shared/design-system";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculatePanelLayout, splitLengthByAvailability } from "@/lib/calculations/materials";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { calculateScenarioGeometry, calculateScenarioMaterials } from "@/lib/construction-methods/scenario-calculations";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

const categoryLabels: Record<MaterialCategory, string> = {
  panels: "Paredes e painéis",
  fasteners: "Fixação",
  flashings: "Arremates",
  sealants: "Vedação",
  facade: "Aberturas e fachada",
  steel: "Estrutura",
  civil: "Fundação e civil",
  labor: "Mão de obra",
  technical: "Técnico",
  freight: "Frete",
  contingency: "Contingência",
  other: "Outros",
};

const materialSystems: Array<{ id: string; title: string; categories: MaterialCategory[]; description: string }> = [
  { id: "walls", title: "Paredes e sistemas", categories: ["panels", "fasteners", "flashings", "sealants"], description: "Painéis, blocos, fixação, arremates e vedação." },
  { id: "foundation", title: "Fundação e civil", categories: ["civil"], description: "Base preliminar, contrapiso, argamassas e complementos civis." },
  { id: "openings", title: "Aberturas e fachada", categories: ["facade"], description: "Portas, janelas, fechamentos e fachada." },
  { id: "structure", title: "Estrutura", categories: ["steel"], description: "Estrutura visível ou preliminar por método." },
  { id: "labor", title: "Mão de obra e logística", categories: ["labor", "freight"], description: "Execução, equipamentos, frete e mobilização." },
  { id: "pending", title: "Pendências e outros", categories: ["technical", "contingency", "other"], description: "Itens técnicos, contingência e linhas sem sistema específico." },
];

function groupSystemLines(lines: MaterialLine[]) {
  return materialSystems.map((system) => {
    const systemLines = lines.filter((line) => system.categories.includes(line.category));
    return {
      ...system,
      lines: systemLines,
      total: systemLines.reduce((sum, line) => sum + line.netTotalBRL, 0),
      pending: systemLines.filter((line) => line.requiresConfirmation).length,
    };
  });
}

function readNumber(geometry: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = geometry[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function formatMeasure(value: number | null, unit: string) {
  return value === null ? "A confirmar" : `${formatCompactNumber(value)} ${unit}`;
}

export default function MaterialsPage() {
  const project = useProjectStore((state) => state.project);
  const updatePanelProduct = useProjectStore((state) => state.updatePanelProduct);
  const updateAccessory = useProjectStore((state) => state.updateAccessory);
  const updateCustomMaterial = useProjectStore((state) => state.updateCustomMaterial);
  const addCustomMaterial = useProjectStore((state) => state.addCustomMaterial);
  const deleteCustomMaterial = useProjectStore((state) => state.deleteCustomMaterial);
  const scenario = useSelectedScenario();
  const method = getConstructionMethodDefinition(scenario.constructionMethod);
  const geometry = calculateScenarioGeometry(project, scenario) as Record<string, unknown>;
  const materials = calculateScenarioMaterials(project, scenario);
  const systems = groupSystemLines(materials);
  const total = materials.reduce((sum, line) => sum + line.netTotalBRL, 0);
  const pendingItems = materials.filter((line) => line.requiresConfirmation).length;
  const isAFrame = scenario.constructionMethod === "aframe";
  const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
  const aFrameGeometry = isAFrame ? calculateAFrameGeometry(scenario.terrain, scenario.aFrame) : null;
  const layout = isAFrame && aFrameGeometry ? calculatePanelLayout(scenario, aFrameGeometry, panel, project.materialAssumptions.sparePanelCount) : null;
  const primaryArea = readNumber(geometry, ["netPanelAreaM2", "netWallAreaM2", "netMasonryAreaM2", "builtAreaM2", "combinedTotalArea"]);
  const primaryUnits = readNumber(geometry, ["panelCount", "totalBlocks"]);
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
    <PageFrame>
      <PageHeader
        eyebrow="Materiais"
        title="Quantitativos por sistema"
        description="A tela mostra primeiro sistemas, pendências e fonte. A tabela técnica e o catálogo editável ficam sob demanda."
        status={
          <>
            <StatusPill tone="info" icon={false}>{method.name}</StatusPill>
            <StatusPill tone={pendingItems > 0 ? "warning" : "success"}>{pendingItems > 0 ? `${pendingItems} pendentes` : "Sem pendência"}</StatusPill>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Área principal" value={formatMeasure(primaryArea, "m2")} detail="Referência do método atual" icon={<Boxes className="h-4 w-4" />} />
        <MetricCard label={layout ? "Painéis" : "Unidades"} value={layout ? layout.totalPanels : formatMeasure(primaryUnits, "un")} detail={layout ? `${formatCompactNumber(layout.totalPanelAreaM2)} m2` : "Blocos, painéis ou itens"} />
        <MetricCard label="Total líquido" value={formatCurrency(total)} detail="Itens com preço informado" tone={total > 0 ? "info" : "warning"} />
        <MetricCard label="A precificar" value={pendingItems} detail="Exigem fonte ou fornecedor" tone={pendingItems > 0 ? "warning" : "success"} icon={<AlertTriangle className="h-4 w-4" />} />
      </section>

      <BudgetGroupCard
        title="Sistemas do takeoff"
        description="Agrupamento para revisar o que entra no orçamento sem depender de uma planilha larga."
        contentClassName="grid gap-4 lg:grid-cols-2"
      >
        {systems.map((system) => (
          <article key={system.id} className="rounded-2xl border bg-background/75 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{system.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{system.description}</p>
              </div>
              <StatusPill tone={system.pending > 0 ? "warning" : system.lines.length > 0 ? "success" : "neutral"} icon={false}>
                {system.lines.length === 0 ? "Sem itens" : system.pending > 0 ? `${system.pending} pend.` : "Revisado"}
              </StatusPill>
            </div>
            <div className="mt-4 space-y-3">
              {system.lines.slice(0, 3).map((line) => (
                <MaterialLineCard key={line.id} line={line} />
              ))}
              {system.lines.length === 0 ? <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Nenhum item deste sistema no cenário atual.</p> : null}
              {system.lines.length > 3 ? <p className="text-xs text-muted-foreground">+ {system.lines.length - 3} item(ns) na tabela técnica.</p> : null}
            </div>
          </article>
        ))}
      </BudgetGroupCard>

      {isAFrame ? (
        <AdvancedDisclosure
          title="Catálogo configurável"
          description="Materiais manuais e preços de acessórios A-frame continuam editáveis, mas não são a leitura principal."
          badge={<StatusPill tone="neutral" icon={false}>{project.customMaterials.length} itens</StatusPill>}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold">Materiais configuráveis</h3>
              <p className="text-sm text-muted-foreground">Adicione telhas, acabamentos ou outros materiais e informe medidas/preços quando houver fonte.</p>
            </div>
            <Button type="button" onClick={addCustomMaterial}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar material
            </Button>
          </div>
          <CustomMaterialsTable
            materials={project.customMaterials}
            onUpdate={updateCustomMaterial}
            onDelete={deleteCustomMaterial}
            numberOrUndefined={numberOrUndefined}
          />
        </AdvancedDisclosure>
      ) : null}

      <AdvancedDisclosure
        title="Tabela técnica de materiais"
        description="Tabela completa para auditoria, edição pontual de preço A-frame e cópia para planilhas."
        badge={<StatusPill tone="info" icon={false}>{materials.length} linhas</StatusPill>}
      >
        <MaterialsTable lines={materials} editablePrice={isAFrame} onPriceBlur={updateLinePrice} />
      </AdvancedDisclosure>
    </PageFrame>
  );
}

function MaterialLineCard({ line }: { line: MaterialLine }) {
  return (
    <div className="rounded-xl border bg-card/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-5">{line.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {line.code} · {formatCompactNumber(line.quantity)} {line.unit} · {formatCurrency(line.netTotalBRL)}
          </p>
        </div>
        <StatusPill tone={line.requiresConfirmation ? "warning" : "success"} icon={false}>
          {line.requiresConfirmation ? "Fonte pendente" : "Calculado"}
        </StatusPill>
      </div>
      {line.notes ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{line.notes}</p> : null}
    </div>
  );
}

function MaterialsTable({
  lines,
  editablePrice,
  onPriceBlur,
}: {
  lines: MaterialLine[];
  editablePrice: boolean;
  onPriceBlur: (lineId: string, value: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-background/70">
      <Table className="min-w-[1180px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-56">Código</TableHead>
            <TableHead className="w-[360px]">Descrição</TableHead>
            <TableHead className="w-32">Sistema</TableHead>
            <TableHead className="w-24 text-right">Qtd.</TableHead>
            <TableHead className="w-20">Un.</TableHead>
            <TableHead className="w-36">Preço un.</TableHead>
            <TableHead className="w-32 text-right">Líquido</TableHead>
            <TableHead className="w-44">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id} className="align-top">
              <TableCell className="whitespace-normal break-words align-top font-mono text-xs leading-relaxed">{line.code}</TableCell>
              <TableCell className="whitespace-normal break-words align-top">
                <div className="font-medium">{line.description}</div>
                <div className="mt-1 text-xs text-muted-foreground">{line.notes}</div>
              </TableCell>
              <TableCell className="whitespace-normal break-words align-top">{categoryLabels[line.category]}</TableCell>
              <TableCell className="align-top text-right">{formatCompactNumber(line.quantity)}</TableCell>
              <TableCell className="align-top">{line.unit}</TableCell>
              <TableCell className="align-top">
                {editablePrice ? (
                  <Input type="number" step="0.01" defaultValue={line.unitPriceBRL ?? ""} onBlur={(event) => onPriceBlur(line.id, event.target.value)} className="h-8 w-28" />
                ) : (
                  <span className="text-sm text-muted-foreground">{line.unitPriceBRL ? formatCurrency(line.unitPriceBRL) : "A confirmar"}</span>
                )}
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
    </div>
  );
}

function CustomMaterialsTable({
  materials,
  onUpdate,
  onDelete,
  numberOrUndefined,
}: {
  materials: Array<{
    id: string;
    code: string;
    description: string;
    category: MaterialCategory;
    supplier: string;
    unit: MaterialUnit;
    quantity: number;
    lengthM?: number;
    widthM?: number;
    maxLengthM?: number;
    lengthIncrementM?: number;
    unitPriceBRL?: number;
    internalFinish?: string;
    enabled: boolean;
  }>;
  onUpdate: (id: string, updates: Partial<(typeof materials)[number]>) => void;
  onDelete: (id: string) => void;
  numberOrUndefined: (value: string) => number | undefined;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-background/70">
      <Table className="min-w-[1480px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Usar</TableHead>
            <TableHead className="w-44">Código</TableHead>
            <TableHead className="w-72">Descrição</TableHead>
            <TableHead className="w-32">Sistema</TableHead>
            <TableHead className="w-24">Un.</TableHead>
            <TableHead className="w-24">Qtd.</TableHead>
            <TableHead className="w-24">Comp.</TableHead>
            <TableHead className="w-24">Larg.</TableHead>
            <TableHead className="w-28">Máx.</TableHead>
            <TableHead className="w-28">Preço</TableHead>
            <TableHead className="w-36">Acab. interno</TableHead>
            <TableHead className="w-56">Status</TableHead>
            <TableHead className="w-14"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((item) => {
            const split = splitLengthByAvailability(item.lengthM ?? 0, item.maxLengthM, item.lengthIncrementM ?? 1);
            return (
              <TableRow key={item.id} className="align-top">
                <TableCell className="align-top">
                  <Checkbox checked={item.enabled} onCheckedChange={(checked) => onUpdate(item.id, { enabled: Boolean(checked) })} />
                </TableCell>
                <TableCell className="align-top">
                  <Input value={item.code} onChange={(event) => onUpdate(item.id, { code: event.target.value })} />
                </TableCell>
                <TableCell className="align-top">
                  <Input value={item.description} onChange={(event) => onUpdate(item.id, { description: event.target.value })} />
                  <Label className="mt-2 block text-xs text-muted-foreground">Fornecedor</Label>
                  <Input value={item.supplier} onChange={(event) => onUpdate(item.id, { supplier: event.target.value })} />
                </TableCell>
                <TableCell className="align-top">
                  <Select value={item.category} onValueChange={(value) => onUpdate(item.id, { category: value as MaterialCategory })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(categoryLabels).map((value) => (
                        <SelectItem value={value} key={value}>
                          {categoryLabels[value as MaterialCategory]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="align-top">
                  <Select value={item.unit} onValueChange={(value) => onUpdate(item.id, { unit: value as MaterialUnit })}>
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
                  <Input type="number" step="0.01" value={item.quantity} onChange={(event) => onUpdate(item.id, { quantity: Number(event.target.value) })} />
                </TableCell>
                <TableCell className="align-top">
                  <Input type="number" step="0.01" value={item.lengthM ?? ""} onChange={(event) => onUpdate(item.id, { lengthM: numberOrUndefined(event.target.value) })} />
                </TableCell>
                <TableCell className="align-top">
                  <Input type="number" step="0.01" value={item.widthM ?? ""} onChange={(event) => onUpdate(item.id, { widthM: numberOrUndefined(event.target.value) })} />
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    type="number"
                    step="0.01"
                    value={item.maxLengthM ?? ""}
                    onChange={(event) => onUpdate(item.id, { maxLengthM: numberOrUndefined(event.target.value), lengthIncrementM: item.lengthIncrementM ?? 1 })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">mult. {item.lengthIncrementM ?? 1} m</p>
                </TableCell>
                <TableCell className="align-top">
                  <Input type="number" step="0.01" value={item.unitPriceBRL ?? ""} onChange={(event) => onUpdate(item.id, { unitPriceBRL: numberOrUndefined(event.target.value) })} />
                </TableCell>
                <TableCell className="align-top">
                  <Input value={item.internalFinish ?? ""} onChange={(event) => onUpdate(item.id, { internalFinish: event.target.value })} />
                </TableCell>
                <TableCell className="whitespace-normal align-top text-xs">
                  {split.exceeded ? (
                    <Badge variant="secondary" className="whitespace-normal text-left leading-tight">
                      excede máximo; usar {split.segments} peças de {split.segmentLengthM} m
                    </Badge>
                  ) : (
                    <Badge variant="outline">ok</Badge>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(item.id)} aria-label="Excluir material">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
