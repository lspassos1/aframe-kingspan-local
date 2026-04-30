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
