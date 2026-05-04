"use client";

import { FormEvent, useMemo, useState } from "react";
import { BadgeDollarSign, CircleAlert, FileCheck2, Link2, Plus, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createBudgetAssistantViewModel,
  createManualCostEntry,
  type BudgetConfidenceLevel,
  type BudgetMatch,
  type CostItem,
  type CostSource,
} from "@/lib/budget-assistant";
import { formatCompactNumber, formatCurrency, formatDate } from "@/lib/format";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

const confidenceOptions: Array<{ value: BudgetConfidenceLevel; label: string }> = [
  { value: "unverified", label: "Sem revisao" },
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

export default function BudgetAssistantPage() {
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const [costSources, setCostSources] = useState<CostSource[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [matches, setMatches] = useState<BudgetMatch[]>([]);
  const baseViewModel = useMemo(() => createBudgetAssistantViewModel(project, scenario), [project, scenario]);
  const [selectedQuantityId, setSelectedQuantityId] = useState(baseViewModel.pendingPriceItems[0]?.id ?? baseViewModel.quantityItems[0]?.id ?? "");
  const [sourceTitle, setSourceTitle] = useState("");
  const [referenceDate, setReferenceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [unitPrice, setUnitPrice] = useState("");
  const [confidence, setConfidence] = useState<BudgetConfidenceLevel>("unverified");
  const viewModel = useMemo(
    () => createBudgetAssistantViewModel(project, scenario, { costSources, costItems, matches }),
    [costItems, costSources, matches, project, scenario]
  );
  const selectedQuantity = viewModel.quantityItems.find((item) => item.id === selectedQuantityId) ?? viewModel.pendingPriceItems[0] ?? viewModel.quantityItems[0];
  const sourceById = new Map(viewModel.costSources.map((source) => [source.id, source]));
  const priceNumber = Number(unitPrice.replace(",", "."));
  const canAddManualPrice = Boolean(selectedQuantity && sourceTitle.trim() && referenceDate && Number.isFinite(priceNumber) && priceNumber > 0);

  const handleAddManualPrice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedQuantity || !canAddManualPrice) return;

    const entry = createManualCostEntry({
      quantityItem: selectedQuantity,
      sourceTitle,
      referenceDate,
      unitPrice: priceNumber,
      confidence,
      city: scenario.location.city,
      state: scenario.location.state,
    });

    setCostSources((current) => [...current, entry.source]);
    setCostItems((current) => [...current, entry.costItem]);
    setMatches((current) => [...current, entry.match]);
    setSourceTitle("");
    setUnitPrice("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Budget Assistant</p>
          <h1 className="text-3xl font-semibold tracking-normal">Orcamento assistido</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Quantitativos do cenario atual, fontes cadastradas, precos pendentes e confianca. Nenhum preco e criado automaticamente.
          </p>
        </div>
        <Badge variant="outline" className="w-fit text-sm">
          {viewModel.methodName}
        </Badge>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileCheck2 className="h-4 w-4" />
              Quantitativos
            </div>
            <p className="mt-2 text-2xl font-semibold">{viewModel.quantityItems.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleAlert className="h-4 w-4" />
              Sem preco
            </div>
            <p className="mt-2 text-2xl font-semibold">{viewModel.unpricedCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BadgeDollarSign className="h-4 w-4" />
              Baixa confianca
            </div>
            <p className="mt-2 text-2xl font-semibold">{viewModel.lowConfidenceCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link2 className="h-4 w-4" />
              Fontes
            </div>
            <p className="mt-2 text-2xl font-semibold">{viewModel.costSources.length}</p>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Adicionar preco manual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddManualPrice} className="grid gap-4 lg:grid-cols-[minmax(260px,1.4fr)_minmax(180px,0.8fr)_minmax(150px,0.6fr)_minmax(150px,0.6fr)_auto]">
            <div className="space-y-2">
              <Label htmlFor="quantity-item">Quantitativo</Label>
              <Select value={selectedQuantity?.id ?? ""} onValueChange={setSelectedQuantityId}>
                <SelectTrigger id="quantity-item" className="h-10 w-full">
                  <SelectValue placeholder="Selecionar item" />
                </SelectTrigger>
                <SelectContent>
                  {viewModel.quantityItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-title">Fonte</Label>
              <Input id="source-title" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Fornecedor ou tabela" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference-date">Data</Label>
              <Input id="reference-date" type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-price">Preco unit.</Label>
              <Input id="unit-price" inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confidence">Confianca</Label>
              <div className="flex gap-2">
                <Select value={confidence} onValueChange={(value) => setConfidence(value as BudgetConfidenceLevel)}>
                  <SelectTrigger id="confidence" className="h-10 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {confidenceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={!canAddManualPrice} className="h-10">
                  Adicionar
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5" />
              Quantitativos detectados
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[880px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[340px]">Descricao</TableHead>
                  <TableHead className="w-28">Categoria</TableHead>
                  <TableHead className="w-24 text-right">Qtd.</TableHead>
                  <TableHead className="w-20">Un.</TableHead>
                  <TableHead className="w-32 text-right">Estimado</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewModel.quantityItems.map((item) => (
                  <TableRow key={item.id} className="align-top">
                    <TableCell className="whitespace-normal break-words align-top">
                      <div className="font-medium">{item.description}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.notes}</div>
                    </TableCell>
                    <TableCell className="align-top">{item.category}</TableCell>
                    <TableCell className="align-top text-right">{formatCompactNumber(item.quantity)}</TableCell>
                    <TableCell className="align-top">{item.unit}</TableCell>
                    <TableCell className="align-top text-right">{formatCurrency(item.estimatedTotalBRL)}</TableCell>
                    <TableCell className="align-top">
                      <Badge variant={item.requiresPriceSource ? "secondary" : "outline"}>
                        {item.requiresPriceSource ? "sem fonte revisada" : "parametro"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-md shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Fontes cadastradas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {viewModel.costSources.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada para este cenario.</p>
              ) : (
                viewModel.costSources.map((source) => (
                  <div key={source.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{source.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {source.city}, {source.state} | {formatDate(source.referenceDate)}
                        </p>
                      </div>
                      <Badge variant="outline">{source.reliability}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-md shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletCards className="h-5 w-5" />
                Relatorio de revisao
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {viewModel.costItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Itens com preco manual aparecem aqui com fonte, data, unidade e confianca.</p>
              ) : (
                viewModel.costItems.map((item) => {
                  const source = sourceById.get(item.sourceId);
                  return (
                    <div key={item.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.quantity} {item.unit} x {formatCurrency(item.unitPrice)} | {source?.title ?? "Fonte removida"} |{" "}
                            {source ? formatDate(source.referenceDate) : "sem data"}
                          </p>
                        </div>
                        <Badge variant={item.confidence === "low" || item.confidence === "unverified" ? "secondary" : "outline"}>{item.confidence}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium">{formatCurrency(item.total)}</p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
