"use client";

import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateBudget } from "@/lib/calculations/budget";
import { estimateRadierFoundation } from "@/lib/calculations/foundation";
import { formatCurrency } from "@/lib/format";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

const BudgetCategoryChart = dynamic(
  () => import("@/components/charts/BudgetCategoryChart").then((mod) => mod.BudgetCategoryChart),
  {
    ssr: false,
    loading: () => <div className="h-full rounded-md bg-muted" />,
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

export default function BudgetPage() {
  const project = useProjectStore((state) => state.project);
  const updateBudgetAssumptions = useProjectStore((state) => state.updateBudgetAssumptions);
  const updateFoundationAssumptions = useProjectStore((state) => state.updateFoundationAssumptions);
  const scenario = useSelectedScenario();
  const budget = calculateBudget(project, scenario);
  const foundation = estimateRadierFoundation(scenario, project.foundationAssumptions);
  const chartData = [
    { name: "Paineis", value: budget.panelPackageCostBRL },
    { name: "Acessorios", value: budget.accessoriesCostBRL },
    { name: "Frete", value: budget.freightBRL },
    { name: "Aco", value: budget.steelStructureCostBRL },
    { name: "Radier", value: budget.foundationCostBRL },
    { name: "Civil compl.", value: budget.civilPlaceholderBRL },
    { name: "Mao obra", value: budget.laborEquipmentBRL },
    { name: "Tecnico", value: budget.technicalLegalBRL },
    { name: "Conting.", value: budget.contingencyBRL },
  ];
  const foundationMaterialCostBRL = foundation.items
    .filter((item) => foundationMaterialIds.has(item.id))
    .reduce((sum, item) => sum + item.netTotalBRL, 0);
  const foundationLaborCostBRL = foundation.items
    .filter((item) => foundationLaborIds.has(item.id))
    .reduce((sum, item) => sum + item.netTotalBRL, 0);
  const foundationEquipmentCostBRL = foundation.items
    .filter((item) => foundationEquipmentIds.has(item.id))
    .reduce((sum, item) => sum + item.netTotalBRL, 0);
  const foundationFormulaRows = [
    {
      label: "Area orcada",
      formula: `(${foundation.widthM} m x ${foundation.depthM} m)`,
      result: `${foundation.areaM2} m2`,
    },
    {
      label: "Concreto da placa",
      formula: `${foundation.areaM2} m2 x ${project.foundationAssumptions.slabThicknessM} m`,
      result: `${foundation.slabConcreteM3} m3`,
    },
    {
      label: "Concreto da viga de borda",
      formula: `${foundation.perimeterM} m x ${project.foundationAssumptions.edgeBeamWidthM} m x ${project.foundationAssumptions.edgeBeamDepthM} m`,
      result: `${foundation.edgeBeamConcreteM3} m3`,
    },
    {
      label: "Concreto total com perda",
      formula: `(placa + borda) x ${100 + project.foundationAssumptions.wastePercent}%`,
      result: `${foundation.concreteM3} m3`,
    },
    {
      label: "Fibra",
      formula: `${foundation.concreteM3} m3 x ${project.foundationAssumptions.fiberDosageKgM3} kg/m3`,
      result: `${foundation.fiberKg} kg`,
    },
    {
      label: "Sub-base",
      formula: `${foundation.areaM2} m2 x ${project.foundationAssumptions.subbaseThicknessM} m`,
      result: `${foundation.subbaseM3} m3`,
    },
    {
      label: "Lona/barreira",
      formula: `${foundation.areaM2} m2 x 1,05`,
      result: `${foundation.vaporBarrierM2} m2`,
    },
    {
      label: "Forma lateral",
      formula: "perimetro externo do radier",
      result: `${foundation.formworkM} m`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Orcamento</p>
        <h1 className="text-3xl font-semibold tracking-normal">Estimativa separada por categoria</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pacote de paineis, frete, estrutura metalica, civil, fachadas, mao de obra e custos tecnicos ficam separados.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total estimado</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(budget.totalEstimatedCostBRL)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Custo/m2 total</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(budget.costPerTotalM2)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Custo/m2 util</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(budget.costPerUsefulM2)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Radier c/ fibras</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(budget.foundationCostBRL)}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-md shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Radier com fibras</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Estimativa interativa pela largura/profundidade da casa. Nao substitui sondagem nem projeto de fundacao.
                </p>
              </div>
              <Badge variant="outline">{foundation.areaM2} m2</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div>
                <Label>Incluir radier no orcamento</Label>
                <p className="text-xs text-muted-foreground">Usa a implantacao da casa com folga perimetral.</p>
              </div>
              <Checkbox
                checked={project.foundationAssumptions.enabled}
                onCheckedChange={(checked) => updateFoundationAssumptions({ enabled: Boolean(checked) })}
              />
            </div>
            <div className="rounded-md border bg-background p-3">
              <div className="mb-3">
                <p className="text-sm font-medium">Como este valor foi orcado</p>
                <p className="text-xs text-muted-foreground">
                  Area da casa + folga perimetral, concreto da placa, viga de borda, fibra, sub-base, lona, formas,
                  preparo do solo, mao de obra e bomba/mobilizacao.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Materiais</p>
                  <p className="font-semibold">{formatCurrency(foundationMaterialCostBRL)}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Mao de obra</p>
                  <p className="font-semibold">{formatCurrency(foundationLaborCostBRL)}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Equipamento</p>
                  <p className="font-semibold">{formatCurrency(foundationEquipmentCostBRL)}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Total radier</p>
                  <p className="font-semibold">{formatCurrency(foundation.totalBRL)}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["extraPerimeterM", "Folga perimetral (m)"],
                ["slabThicknessM", "Esp. placa (m)"],
                ["edgeBeamWidthM", "Viga borda larg. (m)"],
                ["edgeBeamDepthM", "Viga borda alt. (m)"],
                ["subbaseThicknessM", "Sub-base (m)"],
                ["wastePercent", "Perda (%)"],
                ["concreteUnitPriceBRLM3", "Concreto (R$/m3)"],
                ["fiberDosageKgM3", "Fibra (kg/m3)"],
                ["fiberUnitPriceBRLKg", "Fibra (R$/kg)"],
                ["subbaseUnitPriceBRLM3", "Sub-base (R$/m3)"],
                ["vaporBarrierUnitPriceBRLM2", "Lona (R$/m2)"],
                ["formworkUnitPriceBRLM", "Forma (R$/m)"],
                ["laborUnitPriceBRLM2", "MO radier (R$/m2)"],
                ["soilPrepUnitPriceBRLM2", "Preparo solo (R$/m2)"],
                ["pumpBRL", "Bomba/mob. (R$)"],
              ].map(([key, label]) => (
                <div className="space-y-2" key={key}>
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(project.foundationAssumptions[key as keyof typeof project.foundationAssumptions] as number | undefined) ?? ""}
                    onChange={(event) => updateFoundationAssumptions({ [key]: event.target.value === "" ? undefined : Number(event.target.value) })}
                  />
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Concreto</p>
                <p className="font-semibold">{foundation.concreteM3} m3</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Fibra</p>
                <p className="font-semibold">{foundation.fiberKg} kg</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Sub-base</p>
                <p className="font-semibold">{foundation.subbaseM3} m3</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Perimetro</p>
                <p className="font-semibold">{foundation.perimeterM} m</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Referencias seed: SINAPI Bahia 03/2026 para concreto bombeavel C25 e preparo com brita. Valores de fibra, lona, forma e mao de obra sao parametros editaveis para cotacao local.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle>Placeholders editaveis</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["foundationPlaceholderBRL", "Fundacao extra (R$)"],
              ["slabPlaceholderBRL", "Laje extra (R$)"],
              ["drainagePlaceholderBRL", "Drenagem (R$)"],
              ["frontFacadePlaceholderBRL", "Fachada frontal (R$)"],
              ["rearClosurePlaceholderBRL", "Fechamento posterior (R$)"],
              ["doorsWindowsPlaceholderBRL", "Portas/janelas (R$)"],
              ["panelInstallationLaborBRLM2", "Instalacao paineis (R$/m2)"],
              ["liftingEquipmentBRL", "Içamento (R$)"],
              ["scaffoldingBRL", "Andaimes (R$)"],
              ["architectPlaceholderBRL", "Arquiteto (R$)"],
              ["engineerPlaceholderBRL", "Engenheiro/ART (R$)"],
              ["municipalApprovalPlaceholderBRL", "Aprovacao (R$)"],
              ["contingencyPercent", "Contingencia (%)"],
            ].map(([key, label]) => (
              <div className="space-y-2" key={key}>
                <Label>{label}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={(project.budgetAssumptions[key as keyof typeof project.budgetAssumptions] as number | undefined) ?? ""}
                  onChange={(event) => updateBudgetAssumptions({ [key]: event.target.value === "" ? undefined : Number(event.target.value) })}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-md shadow-none xl:col-span-2">
          <CardHeader>
            <CardTitle>Composicao do radier</CardTitle>
            <p className="text-sm text-muted-foreground">
              Detalhamento da fundacao incluida no orcamento: memoria de calculo, materiais, mao de obra e equipamento.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Total radier</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(foundation.totalBRL)}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Materiais</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(foundationMaterialCostBRL)}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Mao de obra/servicos</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(foundationLaborCostBRL)}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Equipamento</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(foundationEquipmentCostBRL)}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-md border">
                <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">Memoria de calculo</div>
                <div className="divide-y">
                  {foundationFormulaRows.map((row) => (
                    <div className="grid gap-1 px-3 py-2 text-sm" key={row.label}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{row.label}</span>
                        <span className="font-semibold">{row.result}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{row.formula}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead>Un.</TableHead>
                      <TableHead className="text-right">Preco unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {foundation.items.map((item) => {
                      const type = foundationMaterialIds.has(item.id)
                        ? "Material"
                        : foundationLaborIds.has(item.id)
                          ? "Mao de obra"
                          : "Equipamento";
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{type}</TableCell>
                          <TableCell className="min-w-64 font-medium">{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unitPriceBRL ?? 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.netTotalBRL)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              O calculo usa a pegada da casa com folga perimetral. Nao inclui sondagem, armaduras especificas, drenagem definitiva, aterramento estrutural, impermeabilizacao detalhada ou projeto executivo.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-md shadow-none xl:col-span-2">
          <CardHeader>
            <CardTitle>Custo por categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[420px]">
            <BudgetCategoryChart data={chartData} />
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle>Itens do orcamento</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Descricao</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead>Un.</TableHead>
                <TableHead className="text-right">Liquido</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budget.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="min-w-72 font-medium">{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.netTotalBRL)}</TableCell>
                  <TableCell>{item.supplier}</TableCell>
                  <TableCell className="min-w-72 text-xs text-muted-foreground">{item.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
