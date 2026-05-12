"use client";

import { FormEvent, useMemo, useState } from "react";
import { BadgeDollarSign, CheckSquare2, CircleAlert, Database, FileCheck2, FileUp, Link2, MapPin, Plus, SearchCheck, TableProperties, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ActionCard,
  AdvancedDisclosure,
  EmptyState,
  FormSection,
  MetricCard,
  PageFrame,
  PageHeader,
  ReviewCard,
  SectionHeader,
  SourceBadge,
  ConfidenceBadge,
  StatusPill,
} from "@/components/shared/design-system";
import { GuidedActionPanel } from "@/components/shared/GuidedActionPanel";
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
import { createBudgetAssistantGuidance } from "@/lib/ux/guided-actions";

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
  const guidedActions = createBudgetAssistantGuidance({
    hasValidRegion: scenarioHasValidRegion,
    costSourceCount: viewModel.costSources.length,
    applicableCostSourceCount: viewModel.applicableCostSources.length,
    pendingPriceCount: viewModel.pendingPriceItems.length,
    lowConfidenceCount: viewModel.lowConfidenceCount,
    remotePriceDbConfigured: false,
  });
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
  const workflowSteps = [
    {
      title: "Importar base",
      description: "Suba CSV/XLSX/JSON/ZIP ou cadastre fonte manual.",
      icon: FileUp,
      status: viewModel.costSources.length > 0 ? "feito" : "pendente",
      tone: viewModel.costSources.length > 0 ? "success" : "warning",
    },
    {
      title: "Confirmar região",
      description: `${scenario.location.city || "Cidade ausente"}${scenarioState ? `/${scenarioState}` : ""}`,
      icon: MapPin,
      status: scenarioHasValidRegion ? "ok" : "pendente",
      tone: scenarioHasValidRegion ? "success" : "warning",
    },
    {
      title: "Revisar colunas",
      description: "Fonte, data-base, unidade e confiança ficam explícitas.",
      icon: TableProperties,
      status: viewModel.costItems.length > 0 ? "em uso" : "aguardando",
      tone: viewModel.costItems.length > 0 ? "success" : "pending",
    },
    {
      title: "Vincular composições",
      description: "Sugestões usam apenas candidatos existentes.",
      icon: SearchCheck,
      status: viewModel.matches.length > 0 ? "sugerido" : "pendente",
      tone: viewModel.matches.length > 0 ? "success" : "warning",
    },
    {
      title: "Aprovar",
      description: "Somente usuário aprova vínculos e preços revisados.",
      icon: CheckSquare2,
      status: viewModel.unpricedCount === 0 ? "pronto" : "bloqueado",
      tone: viewModel.unpricedCount === 0 ? "success" : "warning",
    },
  ] as const;

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
    <PageFrame>
      <PageHeader
        eyebrow="Assistente de orçamento"
        title="Base de preços e vínculos"
        description="Quantitativos do cenário atual, fontes cadastradas, preços pendentes e confiança. Nenhum preço é criado automaticamente."
        status={<StatusPill tone="info" icon={false}>{viewModel.methodName}</StatusPill>}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<FileCheck2 className="h-4 w-4" />} label="Quantitativos" value={viewModel.quantityItems.length} detail="Itens do cenário" />
        <MetricCard icon={<CircleAlert className="h-4 w-4" />} label="Sem preço" value={viewModel.unpricedCount} detail="Pendentes de fonte" tone={viewModel.unpricedCount > 0 ? "warning" : "success"} />
        <MetricCard icon={<BadgeDollarSign className="h-4 w-4" />} label="Baixa confiança" value={viewModel.lowConfidenceCount} detail="Revisão necessária" tone={viewModel.lowConfidenceCount > 0 ? "warning" : "neutral"} />
        <MetricCard icon={<Link2 className="h-4 w-4" />} label="Fontes" value={viewModel.costSources.length} detail="Cadastradas/importadas" />
      </section>

      <GuidedActionPanel items={guidedActions} />

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Fluxo da base"
          title="Importar, revisar, vincular e aprovar"
          description="A tela deixa claro onde a base está pronta e onde ainda existe bloqueio antes do orçamento."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {workflowSteps.map((step) => (
            <ActionCard
              key={step.title}
              icon={step.icon}
              title={step.title}
              description={step.description}
              badge={<StatusPill tone={step.tone} icon={false}>{step.status}</StatusPill>}
              className="min-h-44"
            />
          ))}
        </div>
      </section>

      <Card id="regional-price-filter" className="rounded-2xl border bg-card/90 shadow-sm shadow-foreground/5">
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
                    <SourceBadge muted={scope === "manual"}>{label}</SourceBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div id="price-base-import">
        <PriceBaseImportCard
          scenarioId={scenario.id}
          scenarioCity={scenario.location.city}
          scenarioState={scenarioState}
          defaultConstructionMethod={scenario.constructionMethod}
          importedSourceCount={project.budgetAssistant.priceSources.length}
          importedCompositionCount={project.budgetAssistant.serviceCompositions.length}
          onImport={addBudgetImportedPriceBase}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <div id="manual-price-source">
          <FormSection
            title={
              <span className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Cadastrar fonte de preço
              </span>
            }
            description="Fonte, região e data de referência ficam explícitas antes do vínculo."
          >
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
          </FormSection>
        </div>

        <div id="manual-price-link">
          <FormSection
            title={
              <span className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Vincular preço manual
              </span>
            }
            description="Preço manual sempre nasce como item revisável com fonte e confiança."
          >
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
          </FormSection>
        </div>
      </section>

      <Card id="matching-assisted" className="rounded-2xl border bg-card/90 shadow-sm shadow-foreground/5">
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
                      <ConfidenceBadge level={match.confidence} />
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
        <div className="space-y-4">
          <SectionHeader
            title="Quantitativos para vincular"
            description="Cards mostram quantidade, status e ação antes da tabela técnica."
            action={<StatusPill tone={viewModel.pendingPriceItems.length > 0 ? "warning" : "success"}>{viewModel.pendingPriceItems.length} sem fonte</StatusPill>}
          />
          <div className="grid gap-3">
            {viewModel.quantityItems.slice(0, 6).map((item) => (
              <ReviewCard
                key={item.id}
                title={item.description}
                description={`${item.category} · ${formatCompactNumber(item.quantity)} ${item.unit}`}
                status={<StatusPill tone={item.requiresPriceSource ? "warning" : "success"} icon={false}>{item.requiresPriceSource ? "sem fonte" : "parâmetro"}</StatusPill>}
              >
                <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>{item.notes || "Sem observação adicional."}</span>
                  <strong className="text-foreground">{formatCurrency(item.estimatedTotalBRL)}</strong>
                </div>
              </ReviewCard>
            ))}
          </div>
          <AdvancedDisclosure
            title="Tabela técnica de quantitativos"
            description="Use para conferir todos os itens quando precisar de leitura tabular."
            icon={Database}
            badge={<StatusPill tone="neutral" icon={false}>{viewModel.quantityItems.length} itens</StatusPill>}
          >
            <div className="overflow-x-auto rounded-2xl border bg-background/70">
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
            </div>
          </AdvancedDisclosure>
        </div>

        <div className="space-y-4">
          <Card id="review-report" className="rounded-2xl border bg-card/90 shadow-sm shadow-foreground/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Fontes cadastradas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {viewModel.costSources.length === 0 ? (
                <EmptyState
                  title="Nenhuma fonte cadastrada"
                  description="Cadastre uma fonte local, estadual, nacional ou manual revisável antes de aprovar preços."
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <a href="#price-base-import">Importar base</a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href="#manual-price-source">Cadastrar fonte</a>
                      </Button>
                    </div>
                  }
                />
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
                          <SourceBadge muted={!regionalSource}>{regionalSource?.label ?? "fora da região"}</SourceBadge>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card/90 shadow-sm shadow-foreground/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletCards className="h-5 w-5" />
                Relatório de revisão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {viewModel.costItems.length === 0 ? (
                <EmptyState
                  title="Sem itens revisados"
                  description="Itens com preço manual aparecem aqui com fonte, data, unidade e confiança."
                  action={
                    <Button asChild size="sm">
                      <a href="#manual-price-link">Preencher preço</a>
                    </Button>
                  }
                />
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
                        <ConfidenceBadge level={item.confidence} />
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
    </PageFrame>
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
