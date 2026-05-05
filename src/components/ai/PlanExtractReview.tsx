"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, PencilLine, RotateCcw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
type PlanExtractReviewValue = string | number | ConstructionMethodId | string[] | undefined;

export type PlanExtractModifiedValues = Partial<Record<PlanExtractEditableField, string | number | ConstructionMethodId>>;
export type PlanExtractCurrentValues = Partial<Record<PlanExtractEditableField, string | number | ConstructionMethodId>>;

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
  floors: [["pavimento"], ["andar"]],
  doorCount: [["porta"]],
  windowCount: [["janela"]],
};

const confidenceLabels: Record<PlanExtractConfidence, string> = {
  high: "alta",
  medium: "media",
  low: "baixa",
};

function confidenceClass(confidence: PlanExtractConfidence) {
  return cn(
    confidence === "high" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
    confidence === "medium" && "border-amber-500/25 bg-amber-500/10 text-amber-700",
    confidence === "low" && "border-destructive/25 bg-destructive/10 text-destructive"
  );
}

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

export function getPlanExtractFieldEvidence(result: PlanExtractResult, field: PlanExtractEditableField) {
  const phrases = [[fieldLabels[field]], ...(fieldEvidencePhrases[field] ?? [])];
  const candidates = [...(result.extracted.notes ?? []), ...result.assumptions].filter(Boolean);
  return candidates.find((candidate) => {
    const candidateTokens = tokenizeEvidence(candidate);
    return phrases.some((phrase) => candidateHasPhrase(candidateTokens, phrase));
  });
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
  isApplying?: boolean;
  onSelectedFieldsChange: (fields: PlanExtractSelectedFields) => void;
  onModifiedValuesChange: (values: PlanExtractModifiedValues) => void;
  onApply: () => void;
  onDismiss: () => void;
  onBackToManual?: () => void;
};

export function PlanExtractReview({
  result,
  selectedFields,
  currentValues,
  modifiedValues,
  isApplying,
  onSelectedFieldsChange,
  onModifiedValuesChange,
  onApply,
  onDismiss,
  onBackToManual,
}: PlanExtractReviewProps) {
  const currentMethod = typeof currentValues.constructionMethod === "string" ? (currentValues.constructionMethod as ConstructionMethodId) : undefined;
  const reviewedMethod =
    typeof modifiedValues.constructionMethod === "string" ? (modifiedValues.constructionMethod as ConstructionMethodId) : result.extracted.constructionMethod;
  const effectiveMethod = selectedFields.constructionMethod ? reviewedMethod ?? currentMethod : currentMethod;
  const fields = orderedApplicableFields(result, effectiveMethod);
  const groupedFields = getGroupedFields(fields);
  const selectedCount = fields.filter((field) => selectedFields[field]).length;
  const notes = (result.extracted.notes ?? []).filter(Boolean);
  const uncertainties = [...result.missingInformation, ...result.assumptions].filter(Boolean);
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

  return (
    <div className="mt-4 rounded-lg border bg-background/90 p-4 shadow-sm shadow-foreground/5">
      <div className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Revisao da importacao</h3>
            <Badge variant="outline" className={confidenceClass(result.confidence)}>
              confianca {confidenceLabels[result.confidence]}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.summary}</p>
          {hasUncertainMethod ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Metodo sugerido com confianca {confidenceLabels[methodConfidence]}; ele fica desmarcado ate voce confirmar.</span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{selectedCount} campos selecionados</Badge>
          <Badge variant="outline">revisao humana obrigatoria</Badge>
        </div>
      </div>

      {groupedFields.length > 0 ? (
        <div className="mt-4 space-y-4">
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
                  return (
                    <article key={field} className={cn("rounded-lg border bg-card p-3", selectedFields[field] && "border-primary/35 bg-primary/[0.035]")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <Checkbox
                            id={checkboxId}
                            checked={Boolean(selectedFields[field])}
                            onCheckedChange={(checked) => onSelectedFieldsChange({ ...selectedFields, [field]: checked === true })}
                            aria-label={`Aplicar ${fieldLabels[field]}`}
                          />
                          <div className="min-w-0">
                            <label htmlFor={checkboxId} className="block cursor-pointer text-sm font-semibold">
                              {fieldLabels[field]}
                            </label>
                            {confidence === "low" ? <p className="mt-1 text-xs text-destructive">Baixa confianca; desmarcado por padrao.</p> : null}
                            {field === "constructionMethod" && confidence !== "high" ? (
                              <p className="mt-1 text-xs text-muted-foreground">Sugestao revisavel; nao altera o metodo sozinha.</p>
                            ) : null}
                          </div>
                        </div>
                        <Badge variant="outline" className={cn("shrink-0", confidenceClass(confidence))}>
                          {confidenceLabels[confidence]}
                        </Badge>
                      </div>

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
                        <p className="mt-3 rounded-lg border bg-muted/25 p-2 text-xs leading-5 text-muted-foreground">
                          <span className="font-medium text-foreground">Evidencia:</span> {evidence}
                        </p>
                      ) : null}
                    </article>
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

      {(notes.length > 0 || uncertainties.length > 0 || result.warnings.length > 0) && (
        <div className="mt-4 grid gap-3 text-sm lg:grid-cols-3">
          {notes.length > 0 ? <ExtractList title="Observacoes" items={notes} icon="notes" /> : null}
          {uncertainties.length > 0 ? <ExtractList title="Incertezas" items={uncertainties} icon="uncertainty" /> : null}
          {result.warnings.length > 0 ? <ExtractList title="Alertas" items={result.warnings} icon="warning" /> : null}
        </div>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDismiss} disabled={isApplying}>
          <XCircle className="h-4 w-4" />
          Descartar extracao
        </Button>
        <Button type="button" variant="outline" onClick={onBackToManual ?? onDismiss} disabled={isApplying}>
          <RotateCcw className="h-4 w-4" />
          Voltar para manual
        </Button>
        <Button type="button" onClick={onApply} disabled={isApplying || selectedCount === 0}>
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
