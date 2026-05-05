"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { FileUp, TableProperties } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BrazilLocationSelectFields } from "@/components/shared/BrazilLocationSelectFields";
import { constructionMethodDefinitions, type ConstructionMethodId } from "@/lib/construction-methods";
import {
  createImportedPriceSource,
  defaultPriceBaseColumnMapping,
  importPriceBaseRows,
  parsePriceBaseCsv,
  parsePriceBaseJson,
  parsePriceBaseXlsx,
  priceBaseColumnLabels,
  type PriceBaseColumnKey,
  type PriceBaseColumnMapping,
  type PriceBaseImportIssue,
  type PriceBaseRawRow,
  type PriceSource,
  type PriceSourceType,
  type ServiceComposition,
} from "@/lib/budget-assistant";
import { formatLocalDateInputValue } from "@/lib/date";
import { isBrazilCityInState, isBrazilState, normalizeBrazilStateName } from "@/lib/locations/brazil";
import {
  importSinapiPriceBase,
  parseSinapiRowsFromFile,
  type SinapiColumnMapping,
  type SinapiImportIssue,
  type SinapiPriceStatus,
  type SinapiRegime,
} from "@/lib/sinapi";

const sourceTypeOptions: Array<{ value: PriceSourceType; label: string }> = [
  { value: "sinapi", label: "SINAPI" },
  { value: "tcpo", label: "TCPO" },
  { value: "supplier_quote", label: "Cotacao fornecedor" },
  { value: "manual", label: "Manual" },
  { value: "historical", label: "Historico" },
  { value: "web_reference", label: "Referencia web" },
];

const reliabilityOptions: Array<{ value: PriceSource["reliability"]; label: string }> = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baixa" },
];

const sinapiRegimeOptions: Array<{ value: SinapiRegime; label: string }> = [
  { value: "desonerado", label: "Desonerado" },
  { value: "nao_desonerado", label: "Nao desonerado" },
  { value: "onerado", label: "Onerado" },
  { value: "unknown", label: "Nao informado" },
];

const sinapiStatusLabels: Record<SinapiPriceStatus, string> = {
  valid: "validos",
  zeroed: "zerados",
  missing: "sem preco",
  requires_review: "revisao",
  invalid_unit: "unidade invalida",
  out_of_region: "fora da UF",
  invalid: "invalidos",
};

const columnKeys = Object.keys(defaultPriceBaseColumnMapping) as PriceBaseColumnKey[];
type ImportIssue = PriceBaseImportIssue | SinapiImportIssue;

interface PriceBaseImportCardProps {
  scenarioId: string;
  scenarioCity: string;
  scenarioState: string;
  defaultConstructionMethod: ConstructionMethodId;
  importedSourceCount: number;
  importedCompositionCount: number;
  onImport: (source: PriceSource, serviceCompositions: ServiceComposition[]) => void;
}

export function PriceBaseImportCard({
  scenarioCity,
  scenarioState,
  defaultConstructionMethod,
  importedSourceCount,
  importedCompositionCount,
  onImport,
}: PriceBaseImportCardProps) {
  const normalizedScenarioState = normalizeBrazilStateName(scenarioState) || scenarioState;
  const [rows, setRows] = useState<PriceBaseRawRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceType, setSourceType] = useState<PriceSourceType>("sinapi");
  const [sourceSupplier, setSourceSupplier] = useState("CAIXA");
  const [sourceDate, setSourceDate] = useState(formatLocalDateInputValue);
  const [sourceCity, setSourceCity] = useState(scenarioCity);
  const [sourceState, setSourceState] = useState(normalizedScenarioState);
  const [sourceReliability, setSourceReliability] = useState<PriceSource["reliability"]>("medium");
  const [sourceRegime, setSourceRegime] = useState<SinapiRegime>("unknown");
  const [sourceNotes, setSourceNotes] = useState("");
  const [methodId, setMethodId] = useState<ConstructionMethodId>(defaultConstructionMethod);
  const [mapping, setMapping] = useState<PriceBaseColumnMapping>(defaultPriceBaseColumnMapping);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [summary, setSummary] = useState("");

  const normalizedSourceState = normalizeBrazilStateName(sourceState) || sourceState;
  const sourceStateIsValid = isBrazilState(normalizedSourceState);
  const sourceCityIsValid = sourceType === "sinapi" && !sourceCity ? true : isBrazilCityInState(normalizedSourceState, sourceCity);
  const canImport = Boolean(
    rows.length > 0 &&
      sourceTitle.trim() &&
      sourceSupplier.trim() &&
      sourceDate &&
      sourceStateIsValid &&
      sourceCityIsValid &&
      sourceType &&
      sourceReliability
  );

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setIssues([]);
    setSummary("");
    setRows([]);
    setFileName(file?.name ?? "");
    if (!file) return;

    try {
      const extension = getFileExtension(file.name);
      const fileData = extension === "xlsx" || extension === "xls" || extension === "zip" ? await file.arrayBuffer() : await file.text();
      const parsedRows =
        sourceType === "sinapi" || extension === "zip"
          ? await parseSinapiRowsFromFile(file.name, fileData)
          : extension === "json"
            ? parsePriceBaseJson(fileData as string)
            : extension === "xlsx" || extension === "xls"
              ? parsePriceBaseXlsx(fileData as ArrayBuffer)
              : parsePriceBaseCsv(fileData as string);
      setRows(parsedRows);
      setSummary(`${parsedRows.length} linhas lidas de ${file.name}. Revise o mapeamento antes de importar.`);
      if (!sourceTitle.trim()) setSourceTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (error) {
      setIssues([{ code: "empty-file", message: error instanceof Error ? error.message : "Nao foi possivel ler o arquivo." }]);
    }
  };

  const handleStateChange = (state: string) => {
    const normalizedState = normalizeBrazilStateName(state) || state;
    setSourceState(normalizedState);
    setSourceCity(isBrazilCityInState(normalizedState, sourceCity) ? sourceCity : "");
  };

  const handleMappingChange = (columnKey: PriceBaseColumnKey, value: string) => {
    setMapping((current) => ({ ...current, [columnKey]: value }));
  };

  const handleSourceTypeChange = (value: string) => {
    const nextType = value as PriceSourceType;
    setSourceType(nextType);
    if (nextType === "sinapi" && !sourceSupplier.trim()) setSourceSupplier("CAIXA");
  };

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canImport) return;

    if (sourceType === "sinapi") {
      const result = await importSinapiPriceBase({
        rows,
        fileName,
        mapping: mapPriceBaseMappingToSinapi(mapping),
        source: {
          title: sourceTitle,
          supplier: sourceSupplier,
          state: normalizedSourceState,
          city: sourceCity,
          referenceDate: sourceDate,
          uploadedFileName: fileName,
          reliability: sourceReliability,
          regime: sourceRegime,
          notes: sourceNotes,
        },
        defaultConstructionMethod: methodId,
        expectedState: normalizedSourceState,
      });
      setIssues(result.issues);
      setSummary(
        `${result.importedRows} composicoes SINAPI importadas; ${result.reviewRows} ficaram pendentes de revisao. ${formatSinapiStatusSummary(
          result.statusCounts
        )}`
      );
      if (result.importedRows > 0) onImport(result.priceSource, result.serviceCompositions);
      return;
    }

    const source = createImportedPriceSource({
      type: sourceType,
      title: sourceTitle,
      supplier: sourceSupplier,
      state: normalizedSourceState,
      city: sourceCity,
      referenceDate: sourceDate,
      uploadedFileName: fileName,
      reliability: sourceReliability,
      notes: sourceNotes,
    });
    const result = importPriceBaseRows({
      rows,
      mapping,
      source,
      defaultConstructionMethod: methodId,
    });
    setIssues(result.issues);
    setSummary(`${result.importedRows} composicoes importadas; ${result.reviewRows} ficaram pendentes de revisao.`);
    if (result.importedRows > 0) onImport(result.source, result.serviceCompositions);
  };

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5" />
          Importar base de preco
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Bases importadas" value={importedSourceCount} />
          <Metric label="Composicoes" value={importedCompositionCount} />
          <Metric label="Linhas carregadas" value={rows.length} />
        </div>
        <form onSubmit={handleImport} className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="price-base-file">Arquivo CSV, XLSX, JSON ou ZIP</Label>
            <Input id="price-base-file" type="file" accept=".csv,.xlsx,.xls,.json,.zip" onChange={handleFileChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-base-title">Nome da base</Label>
            <Input id="price-base-title" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="SINAPI BA 2026-05" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-base-type">Tipo da fonte</Label>
            <Select value={sourceType} onValueChange={handleSourceTypeChange}>
              <SelectTrigger id="price-base-type" className="h-10 w-full">
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
          {sourceType === "sinapi" ? (
            <div className="space-y-2">
              <Label htmlFor="price-base-regime">Regime SINAPI</Label>
              <Select value={sourceRegime} onValueChange={(value) => setSourceRegime(value as SinapiRegime)}>
                <SelectTrigger id="price-base-regime" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sinapiRegimeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="price-base-supplier">Fornecedor/origem</Label>
            <Input id="price-base-supplier" value={sourceSupplier} onChange={(event) => setSourceSupplier(event.target.value)} placeholder="CAIXA, fornecedor ou fonte interna" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-base-date">Data-base</Label>
            <Input id="price-base-date" type="date" value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-base-reliability">Confianca da fonte</Label>
            <Select value={sourceReliability} onValueChange={(value) => setSourceReliability(value as PriceSource["reliability"])}>
              <SelectTrigger id="price-base-reliability" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reliabilityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <BrazilLocationSelectFields
            className="lg:col-span-2"
            stateId="price-base-state"
            cityId="price-base-city"
            stateValue={normalizedSourceState}
            cityValue={sourceCity}
            onStateChange={handleStateChange}
            onCityChange={setSourceCity}
            stateError={sourceStateIsValid ? undefined : "Estado obrigatorio"}
            cityError={sourceCityIsValid ? undefined : "Cidade obrigatoria"}
          />
          <div className="space-y-2">
            <Label htmlFor="price-base-method">Metodo padrao</Label>
            <Select value={methodId} onValueChange={(value) => setMethodId(value as ConstructionMethodId)}>
              <SelectTrigger id="price-base-method" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {constructionMethodDefinitions.map((definition) => (
                  <SelectItem key={definition.id} value={definition.id}>
                    {definition.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-base-notes">Observacoes</Label>
            <Textarea id="price-base-notes" value={sourceNotes} onChange={(event) => setSourceNotes(event.target.value)} />
          </div>
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TableProperties className="h-4 w-4" />
              Mapeamento explicito de colunas
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {columnKeys.map((columnKey) => (
                <div key={columnKey} className="space-y-2">
                  <Label htmlFor={`mapping-${columnKey}`}>{priceBaseColumnLabels[columnKey]}</Label>
                  <Input
                    id={`mapping-${columnKey}`}
                    value={mapping[columnKey] ?? ""}
                    onChange={(event) => handleMappingChange(columnKey, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:col-span-2 md:flex-row md:items-center md:justify-between">
            <Button type="submit" disabled={!canImport}>
              Importar base
            </Button>
            {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
          </div>
        </form>
        {issues.length > 0 ? (
          <div className="space-y-2 rounded-md border border-amber-300/70 bg-amber-50 p-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{issues.length} pendencias</Badge>
              <p className="text-sm font-medium text-amber-950">Itens incompletos entram como revisaveis.</p>
            </div>
            <ul className="space-y-1 text-sm text-amber-950">
              {issues.slice(0, 6).map((issue, index) => (
                <li key={`${issue.code}-${issue.rowNumber ?? "file"}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "csv";
}

function mapPriceBaseMappingToSinapi(mapping: PriceBaseColumnMapping): SinapiColumnMapping {
  return {
    code: mapping.sourceCode,
    description: mapping.description,
    unit: mapping.unit,
    totalUnitPrice: mapping.totalUnitPrice,
    materialCostBRL: mapping.materialCostBRL,
    laborCostBRL: mapping.laborCostBRL,
    equipmentCostBRL: mapping.equipmentCostBRL,
    totalLaborHoursPerUnit: mapping.totalLaborHoursPerUnit,
    referenceDate: mapping.referenceDate,
    state: mapping.state,
    city: mapping.city,
    stage: mapping.stage,
    tags: mapping.tags,
    constructionMethod: mapping.constructionMethod,
  };
}

function formatSinapiStatusSummary(statusCounts: Record<SinapiPriceStatus, number>) {
  const parts = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${sinapiStatusLabels[status as SinapiPriceStatus]}`);
  return parts.length > 0 ? `Status: ${parts.join(", ")}.` : "";
}
