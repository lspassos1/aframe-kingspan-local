"use client";

import { FormEvent, useMemo, useState } from "react";
import { BadgeDollarSign, CircleAlert, FileCheck2, Link2, MapPin, Plus, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceBaseImportCard } from "@/components/budget-assistant/PriceBaseImportCard";
import { BrazilLocationSelectFields } from "@/components/shared/BrazilLocationSelectFields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createBudgetAssistantViewModel,
  createManualCostItem,
  createManualCostSource,
  suggestBudgetMatches,
  type BudgetConfidenceLevel,
  type PriceSourceType,
} from "@/lib/budget-assistant";
import { formatLocalDateInputValue } from "@/lib/date";
import { formatCompactNumber, formatCurrency, formatDate } from "@/lib/format";
import { isBrazilCityInState, isBrazilState, normalizeBrazilStateName } from "@/lib/locations/brazil";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

const confidenceOptions: Array<{ value: BudgetConfidenceLevel; label: string }> = [
  { value: "unverified", label: "Sem revisão" },
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

const sourceTypeOptions: Array<{ value: PriceSourceType; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "supplier_quote", label: "Cotação de fornecedor" },
  { value: "sinapi", label: "SINAPI" },
  { value: "tcpo", label: "TCPO" },
  { value: "historical", label: "Histórico" },
  { value: "web_reference", label: "Referência web" },
];

interface SourceLocationFormState {
  locationKey: string;
  city: string;
  state: string;
}

export default function BudgetAssistantPage() {
  const project = useProjectStore((state) => state.project);
  const addBudgetCostSource = useProjectStore((state) => state.addBudgetCostSource);
  const addBudgetImportedPriceBase = useProjectStore((state) => state.addBudgetImportedPriceBase);
  const addBudgetCostItem = useProjectStore((state) => state.addBudgetCostItem);
  const addBudgetMatchSuggestion = useProjectStore((state) => state.addBudgetMatchSuggestion);
  const approveBudgetMatch = useProjectStore((state) => state.approveBudgetMatch);
  const rejectBudgetMatch = useProjectStore((state) => state.rejectBudgetMatch);
  const scenario = useSelectedScenario();
  const baseViewModel = useMemo(() => createBudgetAssistantViewModel(project, scenario), [project, scenario]);
  const firstQuantity = baseViewModel.pendingPriceItems[0] ?? baseViewModel.quantityItems[0];
  const scenarioState = normalizeBrazilStateName(scenario.location.state) || scenario.location.state;
  const scenarioLocationKey = `${scenario.id}:${scenario.location.city}:${scenarioState}`;
  const [selectedQuantityId, setSelectedQuantityId] = useState(firstQuantity?.id ?? "");
  const [selectedSourceId, setSelectedSourceId] = useState(baseViewModel.applicableCostSources[0]?.source.id ?? "");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceType, setSourceType] = useState<PriceSourceType>("manual");
  const [sourceSupplier, setSourceSupplier] = useState("");
  const [sourceLocation, setSourceLocation] = useState<SourceLocationFormState>(() => ({
    locationKey: scenarioLocationKey,
    city: scenario.location.city,
    state: scenarioState,
  }));
  const [sourceDate, setSourceDate] = useState(formatLocalDateInputValue);
  const [sourceNotes, setSourceNotes] = useState("");
  const [itemDescription, setItemDescription] = useState(firstQuantity?.description ?? "");
  const [unitPrice, setUnitPrice] = useState("");
  const [confidence, setConfidence] = useState<BudgetConfidenceLevel>("unverified");
  const [itemNotes, setItemNotes] = useState("");
  const viewModel = useMemo(() => createBudgetAssistantViewModel(project, scenario), [project, scenario]);
  const selectedQuantity = viewModel.quantityItems.find((item) => item.id === selectedQuantityId) ?? viewModel.pendingPriceItems[0] ?? viewModel.quantityItems[0];
  const applicableSourceById = new Map(viewModel.applicableCostSources.map((item) => [item.source.id, item]));
  const selectedPriceSourceIds = new Set(viewModel.selectedPriceSourceIds);
  const sourceSelectValue = selectedSourceId && applicableSourceById.has(selectedSourceId) ? selectedSourceId : viewModel.applicableCostSources[0]?.source.id ?? "";
  const sourceById = new Map(viewModel.costSources.map((source) => [source.id, source]));
  const availableCostItems = (project.budgetAssistant?.costItems ?? []).filter(
    (item) => item.constructionMethod === scenario.constructionMethod && selectedPriceSourceIds.has(item.sourceId)
  );
  const costItemById = new Map(availableCostItems.map((item) => [item.id, item]));
  const suggestedMatches = viewModel.matches.filter((match) => !match.approvedByUser);
  const scenarioHasValidRegion = Boolean(scenario.location.city.trim() && scenarioState.trim());
  const sourceCity = sourceLocation.locationKey === scenarioLocationKey ? sourceLocation.city : scenario.location.city;
  const sourceState = sourceLocation.locationKey === scenarioLocationKey ? normalizeBrazilStateName(sourceLocation.state) || sourceLocation.state : scenarioState;
  const sourceStateIsValid = isBrazilState(sourceState);
  const sourceCityIsValid = isBrazilCityInState(sourceState, sourceCity);
  const priceNumber = Number(unitPrice.replace(",", "."));
  const canAddSource = Boolean(
    scenarioHasValidRegion && sourceTitle.trim() && sourceType && sourceSupplier.trim() && sourceDate && sourceStateIsValid && sourceCityIsValid
  );
  const canAddManualPrice = Boolean(
    scenarioHasValidRegion && selectedQuantity && sourceSelectValue && itemDescription.trim() && Number.isFinite(priceNumber) && priceNumber > 0
  );

  const handleSelectQuantity = (quantityId: string) => {
    setSelectedQuantityId(quantityId);
    const quantity = viewModel.quantityItems.find((item) => item.id === quantityId);
    if (quantity) setItemDescription(quantity.description);
  };

  const handleSourceCityChange = (city: string) => {
    setSourceLocation((current) => ({
      locationKey: scenarioLocationKey,
      city,
      state: current.locationKey === scenarioLocationKey ? current.state : sourceState,
    }));
  };

  const handleSourceStateChange = (state: string) => {
    const normalizedState = normalizeBrazilStateName(state) || state;
    setSourceLocation({
      locationKey: scenarioLocationKey,
      city: isBrazilCityInState(normalizedState, sourceCity) ? sourceCity : "",
      state: normalizedState,
    });
  };

  const handleAddSource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAddSource) return;

    const source = createManualCostSource({
      title: sourceTitle,
      type: sourceType,
      supplier: sourceSupplier,
      city: sourceCity,
      state: sourceState,
      referenceDate: sourceDate,
      notes: sourceNotes,
    });

    addBudgetCostSource(source);
    setSelectedSourceId(source.id);
    setSourceTitle("");
    setSourceSupplier("");
    setSourceNotes("");
  };

  const handleAddManualPrice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedQuantity || !canAddManualPrice) return;

    const entry = createManualCostItem({
      quantityItem: selectedQuantity,
      sourceId: sourceSelectValue,
      description: itemDescription,
      category: selectedQuantity.category,
      quantity: selectedQuantity.quantity,
      unit: selectedQuantity.unit,
      unitPrice: priceNumber,
      confidence,
      notes: itemNotes,
    });

    addBudgetCostItem(entry.costItem, entry.match);
    setUnitPrice("");
    setItemNotes("");
  };

  const handleSuggestMatches = () => {
    const suggestions = suggestBudgetMatches({
      quantityItems: viewModel.pendingPriceItems,
      costItems: availableCostItems,
      existingMatches: viewModel.matches,
    });

    suggestions.forEach(addBudgetMatchSuggestion);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Assistente de orçamento</p>
          <h1 className="text-3xl font-semibold tracking-normal">Orçamento assistido</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Quantitativos do cenário atual, fontes cadastradas, preços pendentes e confiança. Nenhum preço é criado automaticamente.
          </p>
        </div>
        <Badge variant="outline" className="w-fit text-sm">
          {viewModel.methodName}
        </Badge>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={<FileCheck2 className="h-4 w-4" />} label="Quantitativos" value={viewModel.quantityItems.length} />
        <Metric icon={<CircleAlert className="h-4 w-4" />} label="Sem preço" value={viewModel.unpricedCount} />
        <Metric icon={<BadgeDollarSign className="h-4 w-4" />} label="Baixa confiança" value={viewModel.lowConfidenceCount} />
        <Metric icon={<Link2 className="h-4 w-4" />} label="Fontes" value={viewModel.costSources.length} />
      </section>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Filtro regional de preços
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">
                {scenario.location.city || "Cidade não informada"}
                {scenarioState ? `/${scenarioState}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">Prioridade: cidade, UF, base nacional e fallback manual revisável.</p>
            </div>
            <Badge variant={viewModel.applicableCostSources.length > 0 ? "outline" : "secondary"}>{viewModel.applicableCostSources.length} fontes aplicáveis</Badge>
          </div>
          {!scenarioHasValidRegion ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Informe cidade e estado no cenário para aplicar filtro regional de preços.
            </p>
          ) : null}
          {viewModel.regionalFallbackWarnings.map((warning) => (
            <p key={warning} className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900">
              {warning}
            </p>
          ))}
          {viewModel.applicableCostSources.length === 0 ? (
            <p className="rounded-md border p-3 text-sm text-muted-foreground">
              Nenhuma fonte compatível com a região do cenário. Cadastre uma fonte local, estadual, nacional ou manual revisável antes de vincular preços.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {viewModel.applicableCostSources.map(({ source, label, scope }) => (
                <div key={source.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{source.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.supplier} | {formatDate(source.referenceDate)}
                      </p>
                    </div>
                    <Badge variant={scope === "manual" ? "secondary" : "outline"}>{label}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PriceBaseImportCard
        scenarioId={scenario.id}
        scenarioCity={scenario.location.city}
        scenarioState={scenarioState}
        defaultConstructionMethod={scenario.constructionMethod}
        importedSourceCount={project.budgetAssistant.priceSources.length}
        importedCompositionCount={project.budgetAssistant.serviceCompositions.length}
        onImport={addBudgetImportedPriceBase}
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Cadastrar fonte de preço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSource} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="source-title">Nome da fonte</Label>
                <Input id="source-title" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Tabela, fornecedor ou cotação" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-type">Tipo</Label>
                <Select value={sourceType} onValueChange={(value) => setSourceType(value as PriceSourceType)}>
                  <SelectTrigger id="source-type" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-supplier">Fornecedor</Label>
                <Input id="source-supplier" value={sourceSupplier} onChange={(event) => setSourceSupplier(event.target.value)} placeholder="Empresa ou responsável" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-date">Data de referência</Label>
                <Input id="source-date" type="date" value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} />
              </div>
              <BrazilLocationSelectFields
                className="md:col-span-2"
                stateId="source-state"
                cityId="source-city"
                stateValue={sourceState}
                cityValue={sourceCity}
                onStateChange={handleSourceStateChange}
                onCityChange={handleSourceCityChange}
                stateError={sourceStateIsValid ? undefined : "Estado obrigatório"}
                cityError={sourceCityIsValid ? undefined : "Cidade obrigatória"}
              />
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="source-notes">Observações</Label>
                <Textarea id="source-notes" value={sourceNotes} onChange={(event) => setSourceNotes(event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={!canAddSource}>
                  Adicionar fonte
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Vincular preço manual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddManualPrice} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="quantity-item">Quantitativo</Label>
                <Select value={selectedQuantity?.id ?? ""} onValueChange={handleSelectQuantity}>
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
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="source-id">Fonte</Label>
                <Select value={sourceSelectValue} onValueChange={setSelectedSourceId}>
                  <SelectTrigger id="source-id" className="h-10 w-full">
                    <SelectValue placeholder="Cadastrar fonte primeiro" />
                  </SelectTrigger>
                  <SelectContent>
                    {viewModel.applicableCostSources.map(({ source, label }) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.title} - {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {viewModel.costSources.length > 0 && viewModel.applicableCostSources.length === 0 ? (
                  <p className="text-xs text-destructive">As fontes cadastradas não correspondem à região do cenário.</p>
                ) : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="item-description">Descrição do item</Label>
                <Input id="item-description" value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} />
              </div>
              <ReadOnlyField label="Categoria" value={selectedQuantity?.category ?? "-"} />
              <ReadOnlyField label="Unidade" value={selectedQuantity?.unit ?? "-"} />
              <ReadOnlyField label="Quantidade" value={selectedQuantity ? formatCompactNumber(selectedQuantity.quantity) : "-"} />
              <div className="space-y-2">
                <Label htmlFor="unit-price">Preço unitário</Label>
                <Input id="unit-price" inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confidence">Confiança</Label>
                <Select value={confidence} onValueChange={(value) => setConfidence(value as BudgetConfidenceLevel)}>
                  <SelectTrigger id="confidence" className="h-10 w-full">
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
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="item-notes">Notas do item</Label>
                <Textarea id="item-notes" value={itemNotes} onChange={(event) => setItemNotes(event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={!canAddManualPrice}>
                  Vincular preço
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5" />
            Matching assistido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">{suggestedMatches.length} sugestões pendentes</p>
              <p className="text-xs text-muted-foreground">Sugestões usam apenas itens de preço já cadastrados e sempre ficam pendentes de revisão humana.</p>
            </div>
            <Button
              type="button"
              onClick={handleSuggestMatches}
              disabled={!scenarioHasValidRegion || availableCostItems.length === 0 || viewModel.pendingPriceItems.length === 0}
            >
              Gerar sugestões
            </Button>
          </div>
          {suggestedMatches.length === 0 ? null : (
            <div className="grid gap-3 lg:grid-cols-2">
              {suggestedMatches.map((match) => {
                const quantityItem = viewModel.quantityItems.find((item) => item.id === match.quantityItemId);
                const costItem = costItemById.get(match.costItemId);
                const source = costItem ? sourceById.get(costItem.sourceId) : undefined;
                return (
                  <div key={match.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{quantityItem?.description ?? "Quantitativo não encontrado"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{costItem?.description ?? "Item de preço não encontrado"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {source?.title ?? "Fonte removida"} | {match.unitCompatible ? "unidade compatível" : "unidade divergente"}
                        </p>
                      </div>
                      <Badge variant={match.confidence === "high" || match.confidence === "medium" ? "outline" : "secondary"}>{match.confidence}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{match.reason}</p>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" size="sm" onClick={() => approveBudgetMatch(match.id)}>
                        Aprovar
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => rejectBudgetMatch(match.id)}>
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                  <TableHead className="w-[340px]">Descrição</TableHead>
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
                        {item.requiresPriceSource ? "sem fonte revisada" : "parâmetro"}
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
                <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada para este projeto.</p>
              ) : (
                viewModel.costSources.map((source) => {
                  const regionalSource = applicableSourceById.get(source.id);
                  return (
                    <div key={source.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{source.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {source.supplier} | {source.city}, {source.state} | {formatDate(source.referenceDate)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Badge variant="outline">{source.reliability}</Badge>
                          <Badge variant={regionalSource ? "outline" : "secondary"}>{regionalSource?.label ?? "fora da região"}</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="rounded-md shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletCards className="h-5 w-5" />
                Relatório de revisão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {viewModel.costItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Itens com preço manual aparecem aqui com fonte, data, unidade e confiança.</p>
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

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="rounded-md shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex h-10 items-center rounded-md border px-3 text-sm text-muted-foreground">{value}</div>
    </div>
  );
}
