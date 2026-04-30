"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateBudget } from "@/lib/calculations/budget";
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
  const scenario = useSelectedScenario();
  const budget = calculateBudget(project, scenario);
  const chartData = [
    { name: "Paineis", value: budget.panelPackageCostBRL },
    { name: "Acessorios", value: budget.accessoriesCostBRL },
    { name: "Frete", value: budget.freightBRL },
    { name: "Aco", value: budget.steelStructureCostBRL },
    { name: "Civil", value: budget.civilPlaceholderBRL },
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
            <p className="text-sm text-muted-foreground">Pacote paineis</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(budget.panelPackageCostBRL)}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle>Placeholders editaveis</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["foundationPlaceholderBRL", "Fundacao (R$)"],
              ["slabPlaceholderBRL", "Radier/laje (R$)"],
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

        <Card className="rounded-md shadow-none">
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
