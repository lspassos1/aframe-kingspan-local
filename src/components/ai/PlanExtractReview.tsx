"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, PencilLine, RotateCcw, XCircle } from "lucide-react";
import { ConfidenceBadge, EvidenceCard, InlineHelp, QuestionCard, ReviewCard, StatusPill } from "@/components/shared/design-system";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getPlanExtractApplicableFields,
  getPlanExtractNumberFieldMin,
  normalizePlanExtractNumberField,
  type PlanExtractSelectedFields,
} from "@/lib/ai/apply-plan-extract";
import type { PlanExtractConfidence, PlanExtractResult } from "@/lib/ai/plan-extract-schema";
import { constructionMethodDefinitions, type ConstructionMethodId } from "@/lib/construction-methods";
import { cn } from "@/lib/utils";

type PlanExtractField = keyof PlanExtractResult["extracted"];
type PlanExtractEditableField = Exclude<PlanExtractField, "notes">;
export type PlanExtractReviewValue = string | number | ConstructionMethodId | string[] | undefined;

export type PlanExtractModifiedValues = Partial<Record<PlanExtractEditableField, string | number | ConstructionMethodId>>;
export type PlanExtractCurrentValues = Partial<Record<PlanExtractEditableField, string | number | ConstructionMethodId>>;
export type PlanExtractQuestionAnswers = Record<string, string>;

const fieldOrder: PlanExtractEditableField[] = [
  "constructionMethod",
  "projectName",
  "address",
  "city",
  "state",
  "country",
  "terrainWidthM",
  "terrainDepthM",
  "houseWidthM",
  "houseDepthM",
  "builtAreaM2",
  "floorHeightM",
  "floors",
  "doorCount",
  "windowCount",
];

const fieldGroups: Array<{
  id: string;
  title: string;
  description: string;
  fields: PlanExtractEditableField[];
}> = [
  {
    id: "method",
    title: "Metodo sugerido",
    description: "Confirme apenas se a planta deixar o sistema claro.",
    fields: ["constructionMethod"],
  },
  {
    id: "location",
    title: "Localizacao",
    description: "Nome, endereco e UF usados no estudo.",
    fields: ["projectName", "address", "city", "state", "country"],
  },
  {
    id: "dimensions",
    title: "Area e dimensoes",
    description: "Medidas que alimentam geometria e quantitativos.",
    fields: ["terrainWidthM", "terrainDepthM", "houseWidthM", "houseDepthM", "builtAreaM2", "floorHeightM"],
  },
  {
    id: "rooms",
    title: "Ambientes",
    description: "Pavimentos e dados gerais detectados.",
    fields: ["floors"],
  },
  {
    id: "openings",
    title: "Portas e janelas",
    description: "Contagens preliminares para revisar.",
    fields: ["doorCount", "windowCount"],
  },
];

const numberFields = new Set<PlanExtractEditableField>([
  "terrainWidthM",
  "terrainDepthM",
  "houseWidthM",
  "houseDepthM",
  "builtAreaM2",
  "floorHeightM",
  "floors",
  "doorCount",
  "windowCount",
]);

const integerFields = new Set<PlanExtractEditableField>(["floors", "doorCount", "windowCount"]);

const fieldLabels: Record<PlanExtractField, string> = {
  projectName: "Nome do projeto",
  address: "Endereco",
  city: "Cidade",
  state: "Estado",
  country: "Pais",
  constructionMethod: "Metodo construtivo",
  terrainWidthM: "Largura do terreno",
  terrainDepthM: "Profundidade do terreno",
  houseWidthM: "Largura da casa",
  houseDepthM: "Profundidade da casa",
  builtAreaM2: "Area construida",
  floorHeightM: "Pe-direito",
  floors: "Pavimentos",
  doorCount: "Portas",
  windowCount: "Janelas",
  notes: "Observacoes detectadas",
};

const fieldEvidencePhrases: Partial<Record<PlanExtractEditableField, string[][]>> = {
  projectName: [["nome", "projeto"], ["projeto"]],
  address: [["endereco"], ["rua"], ["logradouro"]],
  city: [["cidade"], ["municipio"]],
  state: [["estado"], ["uf"]],
  country: [["pais"]],
  constructionMethod: [["metodo"], ["sistema", "construtivo"]],
  terrainWidthM: [["largura", "terreno"]],
  terrainDepthM: [["profundidade", "terreno"]],
  houseWidthM: [["largura", "casa"], ["fachada"]],
  houseDepthM: [["profundidade", "casa"]],
  builtAreaM2: [["area", "construida"]],
  floorHeightM: [["pe", "direito"], ["altura"]],
  floors: [["pavimento"], ["pavimentos"], ["andar"], ["andares"]],
  doorCount: [["porta"], ["portas"]],
  windowCount: [["janela"], ["janelas"]],
};

const confidenceLabels: Record<PlanExtractConfidence, string> = {
  high: "alta",
  medium: "media",
  low: "baixa",
};

function normalizeTextForSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeEvidence(value: string) {
  return normalizeTextForSearch(value).match(/[a-z0-9]+/g) ?? [];
}

function candidateHasPhrase(candidateTokens: string[], phrase: string[]) {
  const phraseTokens = phrase.flatMap(tokenizeEvidence);
  return phraseTokens.length > 0 && phraseTokens.every((token) => candidateTokens.includes(token));
}

export function isInvalidPlanExtractNumericDraft(field: PlanExtractEditableField, value: PlanExtractReviewValue) {
  return numberFields.has(field) && value !== undefined && typeof value !== "number";
}

export function prunePlanExtractReviewState({
  fields,
  selectedFields,
  modifiedValues,
}: {
  fields: PlanExtractEditableField[];
  selectedFields: PlanExtractSelectedFields;
  modifiedValues: PlanExtractModifiedValues;
}) {
  const fieldSet = new Set<PlanExtractField>(fields);
  const nextSelectedFields = Object.fromEntries(
    Object.entries(selectedFields).filter(([field]) => fieldSet.has(field as PlanExtractField))
  ) as PlanExtractSelectedFields;
  const nextModifiedValues = Object.fromEntries(
    Object.entries(modifiedValues).filter(([field]) => fieldSet.has(field as PlanExtractField))
  ) as PlanExtractModifiedValues;

  return { selectedFields: nextSelectedFields, modifiedValues: nextModifiedValues };
}

export function getPlanExtractFieldEvidence(result: PlanExtractResult, field: PlanExtractEditableField) {
  const directEvidence = result.fieldEvidence?.[field];
  if (directEvidence) return directEvidence;

  const phrases = [[fieldLabels[field]], ...(fieldEvidencePhrases[field] ?? [])];
  const candidates = [...(result.extracted.notes ?? []), ...result.assumptions].filter(Boolean);
  return candidates.find((candidate) => {
    const candidateTokens = tokenizeEvidence(candidate);
    return phrases.some((phrase) => candidateHasPhrase(candidateTokens, phrase));
  });
}

export function getPlanExtractAdvancedHighlights(result: PlanExtractResult) {
  const highlights: Array<{ label: string; value: string; tone: "neutral" | "info" | "warning" | "pending" }> = [];

  if (result.extractionStatus) {
    const statusLabels = {
      complete: "Completa",
      partial: "Parcial",
      insufficient: "Insuficiente",
    } as const;
    highlights.push({
      label: "Leitura",
      value: statusLabels[result.extractionStatus],
      tone: result.extractionStatus === "complete" ? "info" : result.extractionStatus === "partial" ? "pending" : "warning",
    });
  }
  if (result.rooms?.length) highlights.push({ label: "Ambientes", value: String(result.rooms.length), tone: "info" });
  if (result.quantitySeeds?.length) highlights.push({ label: "Quantitativos sugeridos", value: String(result.quantitySeeds.length), tone: "pending" });
  if (result.questions?.length) highlights.push({ label: "Perguntas", value: String(result.questions.length), tone: "warning" });
  if (result.extractionWarnings?.length) highlights.push({ label: "Alertas", value: String(result.extractionWarnings.length), tone: "warning" });

  return highlights;
}

type AdvancedReviewItem = {
  label: string;
  value: string;
  evidence?: string;
  source?: string;
  confidence?: string;
  pendingReason?: string;
  requiresReview?: boolean;
};

type AdvancedReviewBlock = {
  id: string;
  title: string;
  current: string;
  status: string;
  tone: "neutral" | "info" | "warning" | "pending";
  items: AdvancedReviewItem[];
};

const advancedBlockDefinitions: Array<{ id: string; title: string; current: string; values: (result: PlanExtractResult) => unknown[] }> = [
  { id: "document-scale", title: "Documento e escala", current: "Escala e documento ainda nao aplicados.", values: (result) => [result.document, result.scale] },
  { id: "location", title: "Localizacao", current: "Local atual aparece nos campos aplicaveis.", values: (result) => [result.location] },
  { id: "lot", title: "Lote e implantacao", current: "Implantacao atual fica no estudo da obra.", values: (result) => [result.lot] },
  { id: "dimensions", title: "Area e dimensoes", current: "Dimensoes atuais aparecem nos campos aplicaveis.", values: (result) => [result.building] },
  { id: "rooms", title: "Ambientes", current: "Ambientes detalhados ainda nao alteram o estudo.", values: (result) => [result.rooms] },
  { id: "walls", title: "Paredes", current: "Paredes permanecem pendentes ate revisao.", values: (result) => [result.walls] },
  { id: "openings", title: "Portas e janelas", current: "Contagens atuais aparecem nos campos aplicaveis.", values: (result) => [result.openings] },
  { id: "foundation-roof", title: "Fundacao e cobertura", current: "Itens tecnicos exigem revisao antes do orcamento.", values: (result) => [result.foundation, result.roof, result.structure] },
  { id: "systems", title: "Eletrica e hidraulica", current: "Estimativas por media ficam pendentes ate confirmacao.", values: (result) => [result.electrical, result.plumbing, result.fixtures] },
  { id: "quantities", title: "Quantitativos", current: "Seeds sugeridas ainda nao viraram orcamento revisado.", values: (result) => [result.quantitySeeds] },
];

function humanizeKey(key: string) {
  const labels: Record<string, string> = {
    areaM2: "Area",
    backSetbackM: "Recuo fundo",
    builtAreaM2: "Area construida",
    ceilingAreaM2: "Forro",
    city: "Cidade",
    depthM: "Profundidade",
    doorCount: "Portas",
    dryAreaM2: "Piso seco",
    externalCoatingAreaM2: "Revestimento externo",
    externalPaintingAreaM2: "Pintura externa",
    floorHeightM: "Pe-direito",
    frontSetbackM: "Recuo frontal",
    hasCeilingPlan: "Planta de forro",
    hasElectricalPlan: "Projeto eletrico",
    hasPlumbingPlan: "Projeto hidraulico",
    internalCoatingAreaM2: "Revestimento interno",
    internalLengthM: "Parede interna",
    internalPaintingAreaM2: "Pintura interna",
    leftSetbackM: "Recuo esquerdo",
    name: "Nome",
    netAreaM2: "Area liquida",
    pageCount: "Folhas",
    ratio: "Escala",
    referenceMeasureM: "Medida referencia",
    rightSetbackM: "Recuo direito",
    roofAreaM2: "Area de cobertura",
    scaleText: "Escala",
    sinks: "Lavatorios",
    state: "UF",
    toilets: "Bacias sanitarias",
    type: "Tipo",
    visibleSystem: "Sistema visivel",
    wetAreaWallTileM2: "Revestimento areas molhadas",
    widthM: "Largura",
    windowCount: "Janelas",
  };
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function isExtractedValue(value: unknown): value is {
  value: unknown;
  unit?: string;
  confidence?: string;
  evidence?: string;
  source?: string;
  requiresReview?: boolean;
  pendingReason?: string;
} {
  return Boolean(value && typeof value === "object" && "value" in value && "confidence" in value && "source" in value && "requiresReview" in value);
}

function formatExtractedPrimitiveValue(value: unknown, unit?: string) {
  if (typeof value === "number") {
    return unit && unit !== "un" ? `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit}` : value.toLocaleString("pt-BR");
  }
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  if (value === undefined || value === null || value === "") return "Nao informado";
  return String(value);
}

function collectAdvancedReviewItems(value: unknown, label = "", depth = 0): AdvancedReviewItem[] {
  if (!value || depth > 4) return [];
  if (isExtractedValue(value)) {
    return [
      {
        label,
        value: formatExtractedPrimitiveValue(value.value, value.unit),
        evidence: value.evidence,
        source: value.source,
        confidence: value.confidence,
        pendingReason: value.pendingReason,
        requiresReview: value.requiresReview,
      },
    ];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectAdvancedReviewItems(item, label ? `${label} ${index + 1}` : `Item ${index + 1}`, depth + 1));
  }
  if (typeof value === "object") {
    if ("description" in value && "quantity" in value && "unit" in value) {
      const seed = value as { description?: unknown; quantity?: unknown; unit?: unknown; source?: unknown; confidence?: unknown; evidence?: unknown; pendingReason?: unknown; requiresReview?: unknown };
      return [
        {
          label: typeof seed.description === "string" ? seed.description : label,
          value: formatExtractedPrimitiveValue(seed.quantity, typeof seed.unit === "string" ? seed.unit : undefined),
          source: typeof seed.source === "string" ? seed.source : undefined,
          confidence: typeof seed.confidence === "string" ? seed.confidence : undefined,
          evidence: typeof seed.evidence === "string" ? seed.evidence : undefined,
          pendingReason: typeof seed.pendingReason === "string" ? seed.pendingReason : undefined,
          requiresReview: typeof seed.requiresReview === "boolean" ? seed.requiresReview : undefined,
        },
      ];
    }
    return Object.entries(value).flatMap(([key, nested]) => collectAdvancedReviewItems(nested, humanizeKey(key), depth + 1));
  }
  return [];
}

export function getPlanExtractDecisionBlocks(result: PlanExtractResult): AdvancedReviewBlock[] {
  return advancedBlockDefinitions
    .map((definition) => {
      const items = definition.values(result).flatMap((value) => collectAdvancedReviewItems(value)).filter((item) => item.value !== "Nao informado");
      const hasPending = items.some((item) => item.pendingReason);
      const hasLowConfidence = items.some((item) => item.confidence === "low" || item.confidence === "unknown");
      const hasReview = items.some((item) => item.requiresReview);
      return {
        id: definition.id,
        title: definition.title,
        current: definition.current,
        status: hasPending ? "pendente" : hasLowConfidence ? "baixa confianca" : hasReview ? "revisar" : "informativo",
        tone: hasPending || hasLowConfidence ? "warning" : hasReview ? "pending" : "info",
        items,
      } satisfies AdvancedReviewBlock;
    })
    .filter((block) => block.items.length > 0);
}

function formatFieldValue(field: PlanExtractField, value: PlanExtractReviewValue) {
  if (value === undefined) return "";
  if (field === "constructionMethod" && typeof value === "string") {
    return constructionMethodDefinitions.find((definition) => definition.id === value)?.name ?? value;
  }
  if (field.endsWith("M") && typeof value === "number") {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m`;
  }
  if (field === "builtAreaM2" && typeof value === "number") {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m2`;
  }
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
  if (Array.isArray(value)) {
    return value.join("; ");
  }
  return value;
}

function formatCurrentFieldValue(field: PlanExtractEditableField, value: PlanExtractReviewValue) {
  return formatFieldValue(field, value) || "Nao informado";
}

function orderedApplicableFields(result: PlanExtractResult, currentMethod?: ConstructionMethodId) {
  const applicable = new Set(getPlanExtractApplicableFields(result, currentMethod));
  return fieldOrder.filter((field) => {
    if (!applicable.has(field)) return false;
    const value = result.extracted[field];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== "";
  });
}

function getGroupedFields(fields: PlanExtractEditableField[]) {
  const fieldSet = new Set(fields);
  return fieldGroups
    .map((group) => ({
      ...group,
      fields: group.fields.filter((field) => fieldSet.has(field)),
    }))
    .filter((group) => group.fields.length > 0);
}

type PlanExtractReviewProps = {
  result: PlanExtractResult;
  selectedFields: PlanExtractSelectedFields;
  currentValues: PlanExtractCurrentValues;
  modifiedValues: PlanExtractModifiedValues;
  questionAnswers?: PlanExtractQuestionAnswers;
  isApplying?: boolean;
  onSelectedFieldsChange: (fields: PlanExtractSelectedFields) => void;
  onModifiedValuesChange: (values: PlanExtractModifiedValues) => void;
  onQuestionAnswersChange?: (answers: PlanExtractQuestionAnswers) => void;
  onApply: (selectedFields?: PlanExtractSelectedFields, modifiedValues?: PlanExtractModifiedValues) => void;
  onDismiss: () => void;
  onBackToManual?: () => void;
};

export function PlanExtractReview({
  result,
  selectedFields,
  currentValues,
  modifiedValues,
  questionAnswers,
  isApplying,
  onSelectedFieldsChange,
  onModifiedValuesChange,
  onQuestionAnswersChange,
  onApply,
  onDismiss,
  onBackToManual,
}: PlanExtractReviewProps) {
  const [localQuestionAnswers, setLocalQuestionAnswers] = useState<PlanExtractQuestionAnswers>({});
  const currentMethod = typeof currentValues.constructionMethod === "string" ? (currentValues.constructionMethod as ConstructionMethodId) : undefined;
  const reviewedMethod =
    typeof modifiedValues.constructionMethod === "string" ? (modifiedValues.constructionMethod as ConstructionMethodId) : result.extracted.constructionMethod;
  const effectiveMethod = selectedFields.constructionMethod ? reviewedMethod ?? currentMethod : currentMethod;
  const fields = orderedApplicableFields(result, effectiveMethod);
  const groupedFields = getGroupedFields(fields);
  const selectedCount = fields.filter((field) => selectedFields[field]).length;
  const notes = (result.extracted.notes ?? []).filter(Boolean);
  const uncertainties = [...result.missingInformation, ...result.assumptions].filter(Boolean);
  const questions = result.questions ?? [];
  const extractionWarnings = result.extractionWarnings ?? [];
  const structuredWarningItems = extractionWarnings.map((warning) => `${warning.code}: ${warning.message}`);
  const highlights = getPlanExtractAdvancedHighlights(result);
  const decisionBlocks = getPlanExtractDecisionBlocks(result);
  const effectiveQuestionAnswers = questionAnswers ?? localQuestionAnswers;
  const methodConfidence = result.fieldConfidence.constructionMethod ?? result.confidence;
  const hasUncertainMethod = Boolean(result.extracted.constructionMethod && methodConfidence !== "high");

  function updateModifiedValue(
    field: PlanExtractEditableField,
    value: string | number | ConstructionMethodId | undefined,
    shouldSelect = value !== undefined && value !== ""
  ) {
    const nextValues: PlanExtractModifiedValues = { ...modifiedValues };
    if (value === undefined) {
      delete nextValues[field];
    } else {
      nextValues[field] = value;
    }
    onModifiedValuesChange(nextValues);
    onSelectedFieldsChange({ ...selectedFields, [field]: shouldSelect });
  }

  function applyVisibleFields() {
    const prunedState = prunePlanExtractReviewState({ fields, selectedFields, modifiedValues });
    onSelectedFieldsChange(prunedState.selectedFields);
    onModifiedValuesChange(prunedState.modifiedValues);
    onApply(prunedState.selectedFields, prunedState.modifiedValues);
  }

  function updateQuestionAnswer(questionId: string, value: string) {
    const nextAnswers = { ...effectiveQuestionAnswers, [questionId]: value };
    if (onQuestionAnswersChange) {
      onQuestionAnswersChange(nextAnswers);
    } else {
      setLocalQuestionAnswers(nextAnswers);
    }
  }

  return (
    <div className="mt-4 rounded-lg border bg-background/90 p-4 shadow-sm shadow-foreground/5">
      <div className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Revisao da importacao</h3>
            <ConfidenceBadge level={result.confidence} />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.summary}</p>
          {hasUncertainMethod ? (
            <InlineHelp tone="warning" className="mt-3">
              <span>Metodo sugerido com confianca {confidenceLabels[methodConfidence]}; ele fica desmarcado ate voce confirmar.</span>
            </InlineHelp>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="info" icon={false}>
            {selectedCount} campos selecionados
          </StatusPill>
          <StatusPill tone="pending" icon={false}>
            revisao humana obrigatoria
          </StatusPill>
        </div>
      </div>

      <InlineHelp tone="info" className="mt-4">
        A IA apenas sugere. Edite, marque ou descarte cada campo antes de aplicar ao estudo.
      </InlineHelp>

      {highlights.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {highlights.map((highlight) => (
            <div key={highlight.label} className="rounded-xl border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">{highlight.label}</p>
              <div className="mt-1">
                <StatusPill tone={highlight.tone} icon={false}>
                  {highlight.value}
                </StatusPill>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {decisionBlocks.length > 0 ? (
        <section className="mt-5 space-y-3">
          <div>
            <h4 className="text-sm font-semibold">Blocos da planta</h4>
            <p className="mt-1 text-xs text-muted-foreground">Cada bloco mostra o estado atual, os dados extraidos e a acao necessaria antes do orcamento.</p>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {decisionBlocks.map((block) => (
              <ReviewCard
                key={block.id}
                title={block.title}
                description={<span>Atual: {block.current}</span>}
                status={<StatusPill tone={block.tone}>{block.status}</StatusPill>}
                selected={block.tone === "info"}
              >
                <div className="space-y-2">
                  {block.items.slice(0, 4).map((item, index) => (
                    <div key={`${block.id}-${item.label}-${index}`} className="rounded-xl border bg-background/80 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{item.label}</span>
                        {item.confidence ? <ConfidenceBadge level={item.confidence} /> : null}
                      </div>
                      <p className="mt-1 text-foreground">{item.value}</p>
                      {item.evidence || item.pendingReason ? (
                        <EvidenceCard className="mt-2 text-xs" evidence={item.evidence} source={item.source} pending={item.pendingReason} />
                      ) : null}
                    </div>
                  ))}
                  {block.items.length > 4 ? <p className="text-xs text-muted-foreground">+{block.items.length - 4} itens neste bloco.</p> : null}
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href="#campos-aplicaveis">Editar ou confirmar campos aplicaveis</a>
                  </Button>
                </div>
              </ReviewCard>
            ))}
          </div>
        </section>
      ) : null}

      {groupedFields.length > 0 ? (
        <div id="campos-aplicaveis" className="mt-4 scroll-mt-6 space-y-4">
          {groupedFields.map((group) => (
            <section key={group.id} className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold">{group.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {group.fields.map((field) => {
                  const confidence = result.fieldConfidence[field] ?? result.confidence;
                  const checkboxId = `plan-extract-${field}`;
                  const hasModifiedValue = Object.prototype.hasOwnProperty.call(modifiedValues, field);
                  const reviewValue = hasModifiedValue ? modifiedValues[field] : result.extracted[field];
                  const evidence = getPlanExtractFieldEvidence(result, field);
                  const selectionDisabled = isInvalidPlanExtractNumericDraft(field, reviewValue);
                  return (
                    <ReviewCard
                      key={field}
                      selected={Boolean(selectedFields[field])}
                      status={<ConfidenceBadge level={confidence} />}
                      title={
                        <div className="flex min-w-0 items-start gap-2">
                          <Checkbox
                            id={checkboxId}
                            checked={Boolean(selectedFields[field])}
                            disabled={selectionDisabled}
                            onCheckedChange={(checked) => onSelectedFieldsChange({ ...selectedFields, [field]: checked === true })}
                            aria-label={`Aplicar ${fieldLabels[field]}`}
                          />
                          <label htmlFor={checkboxId} className="block cursor-pointer text-sm font-semibold">
                            {fieldLabels[field]}
                          </label>
                        </div>
                      }
                      description={
                        <>
                          {confidence === "low" ? <span className="block text-destructive">Baixa confianca; desmarcado por padrao.</span> : null}
                          {field === "constructionMethod" && confidence !== "high" ? (
                            <span className="block">Sugestao revisavel; nao altera o metodo sozinha.</span>
                          ) : null}
                          {selectionDisabled ? <span className="block text-destructive">Corrija o numero para aplicar este campo.</span> : null}
                        </>
                      }
                    >

                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <div className="rounded-lg border bg-muted/25 p-3">
                          <span className="block text-xs font-medium uppercase tracking-normal text-muted-foreground">Antes</span>
                          <span className="mt-1 block break-words text-sm text-foreground">{formatCurrentFieldValue(field, currentValues[field])}</span>
                        </div>
                        <div className="space-y-2 rounded-lg border bg-background p-3">
                          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-normal text-muted-foreground">
                            <PencilLine className="h-3.5 w-3.5" />
                            Depois
                          </span>
                          <PlanExtractFieldEditor
                            field={field}
                            value={reviewValue}
                            onChange={(value, shouldSelect) => updateModifiedValue(field, value, shouldSelect)}
                          />
                        </div>
                      </div>

                      {evidence ? (
                        <EvidenceCard className="mt-3 text-xs" evidence={evidence} />
                      ) : null}
                    </ReviewCard>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border bg-muted/35 p-3 text-sm text-muted-foreground">
          Nenhum campo acionavel foi detectado. Voce ainda pode preencher manualmente.
        </p>
      )}

      {questions.length > 0 ? (
        <section className="mt-4 space-y-3">
          <div>
            <h4 className="text-sm font-semibold">Perguntas antes do orçamento</h4>
            <p className="mt-1 text-xs text-muted-foreground">Responda o que estiver faltando antes de transformar a leitura em quantitativos.</p>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {questions.map((question) => {
              const answerId = `plan-question-${question.id}`;
              return (
                <QuestionCard key={question.id} question={question.question} reason={question.reason} required={question.requiredBeforeBudget}>
                  <label htmlFor={answerId} className="text-xs font-medium text-amber-950">
                    Resposta
                  </label>
                  <Textarea
                    id={answerId}
                    value={effectiveQuestionAnswers[question.id] ?? ""}
                    onChange={(event) => updateQuestionAnswer(question.id, event.target.value)}
                    className="mt-1 min-h-20 border-amber-200 bg-white/80 text-foreground"
                    aria-label={`Resposta para ${question.question}`}
                  />
                  {(effectiveQuestionAnswers[question.id] ?? "").trim() ? (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-white/70 p-2 text-xs leading-5 text-amber-950">
                      Resposta registrada nesta revisao. Ela ainda fica como pendencia ate ser aplicada nos campos ou no preenchimento manual.
                    </p>
                  ) : null}
                </QuestionCard>
              );
            })}
          </div>
        </section>
      ) : null}

      {(notes.length > 0 || uncertainties.length > 0 || result.warnings.length > 0 || structuredWarningItems.length > 0) && (
        <div className="mt-4 grid gap-3 text-sm lg:grid-cols-3">
          {notes.length > 0 ? <ExtractList title="Observacoes" items={notes} icon="notes" /> : null}
          {uncertainties.length > 0 ? <ExtractList title="Incertezas" items={uncertainties} icon="uncertainty" /> : null}
          {result.warnings.length > 0 ? <ExtractList title="Alertas" items={result.warnings} icon="warning" /> : null}
          {structuredWarningItems.length > 0 ? <ExtractList title="Alertas estruturados" items={structuredWarningItems} icon="warning" /> : null}
        </div>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <InlineHelp tone="pending" className="sm:mr-auto">
          Proximo passo: aplicar somente campos selecionados, responder pendencias e seguir para quantitativos revisaveis.
        </InlineHelp>
        <Button type="button" variant="ghost" onClick={onDismiss} disabled={isApplying}>
          <XCircle className="h-4 w-4" />
          Descartar extracao
        </Button>
        <Button type="button" variant="outline" onClick={onBackToManual ?? onDismiss} disabled={isApplying}>
          <RotateCcw className="h-4 w-4" />
          Voltar para manual
        </Button>
        <Button type="button" onClick={applyVisibleFields} disabled={isApplying || selectedCount === 0}>
          <ClipboardCheck className="h-4 w-4" />
          Aplicar campos selecionados
        </Button>
      </div>
    </div>
  );
}

function PlanExtractFieldEditor({
  field,
  value,
  onChange,
}: {
  field: PlanExtractEditableField;
  value: PlanExtractReviewValue;
  onChange: (value: string | number | ConstructionMethodId | undefined, shouldSelect?: boolean) => void;
}) {
  if (field === "constructionMethod") {
    return (
      <Select value={typeof value === "string" ? value : undefined} onValueChange={(methodId) => onChange(methodId as ConstructionMethodId)}>
        <SelectTrigger className="h-10 w-full rounded-lg bg-background">
          <SelectValue placeholder="Escolha o metodo" />
        </SelectTrigger>
        <SelectContent>
          {constructionMethodDefinitions.map((definition) => (
            <SelectItem key={definition.id} value={definition.id}>
              {definition.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (numberFields.has(field)) {
    const minimum = getPlanExtractNumberFieldMin(field) ?? (field === "doorCount" || field === "windowCount" ? 0 : 0.01);
    return <PlanExtractNumberFieldEditor key={`${field}-${typeof value === "number" || typeof value === "string" ? value : ""}`} field={field} value={value} minimum={minimum} onChange={onChange} />;
  }

  return (
    <Input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => {
        const nextValue = event.target.value;
        onChange(nextValue.trim().length > 0 ? nextValue : undefined);
      }}
    />
  );
}

function PlanExtractNumberFieldEditor({
  field,
  value,
  minimum,
  onChange,
}: {
  field: PlanExtractEditableField;
  value: PlanExtractReviewValue;
  minimum: number;
  onChange: (value: string | number | undefined, shouldSelect?: boolean) => void;
}) {
  const [draftValue, setDraftValue] = useState(typeof value === "number" || typeof value === "string" ? String(value) : "");

  return (
    <Input
      type="number"
      min={minimum}
      step={integerFields.has(field) ? 1 : 0.01}
      value={draftValue}
      onChange={(event) => {
        const rawValue = event.target.value.trim();
        setDraftValue(rawValue);
        if (!rawValue) {
          onChange("", false);
          return;
        }

        const normalizedValue = normalizePlanExtractNumberField(field, Number(rawValue));
        if (normalizedValue !== undefined) {
          if (integerFields.has(field)) setDraftValue(String(normalizedValue));
          onChange(normalizedValue, true);
        } else {
          onChange(rawValue, false);
        }
      }}
    />
  );
}

function ExtractList({ title, items, icon }: { title: string; items: string[]; icon: "notes" | "uncertainty" | "warning" }) {
  const Icon = icon === "warning" ? AlertTriangle : icon === "uncertainty" ? RotateCcw : ClipboardCheck;
  return (
    <div className="rounded-lg border bg-muted/25 p-3">
      <div className="flex items-center gap-2 font-medium">
        <Icon className={cn("h-4 w-4", icon === "warning" && "text-amber-600", icon === "uncertainty" && "text-amber-600")} />
        {title}
      </div>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
