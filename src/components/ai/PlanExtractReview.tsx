"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { constructionMethodDefinitions, type ConstructionMethodId } from "@/lib/construction-methods";
import { getPlanExtractApplicableFields, type PlanExtractSelectedFields } from "@/lib/ai/apply-plan-extract";
import type { PlanExtractConfidence, PlanExtractResult } from "@/lib/ai/plan-extract-schema";

type PlanExtractField = keyof PlanExtractResult["extracted"];
type PlanExtractEditableField = Exclude<PlanExtractField, "notes">;
type PlanExtractReviewValue = string | number | ConstructionMethodId | string[] | undefined;

export type PlanExtractModifiedValues = Partial<Record<PlanExtractEditableField, string | number | ConstructionMethodId>>;
export type PlanExtractCurrentValues = Partial<Record<PlanExtractEditableField, string | number | ConstructionMethodId>>;

const fieldOrder: PlanExtractEditableField[] = [
  "projectName",
  "constructionMethod",
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

function orderedApplicableFields(result: PlanExtractResult) {
  const applicable = new Set(getPlanExtractApplicableFields(result));
  return fieldOrder.filter((field) => {
    if (!applicable.has(field)) return false;
    const value = result.extracted[field];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== "";
  });
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
}: PlanExtractReviewProps) {
  const fields = orderedApplicableFields(result);
  const selectedCount = fields.filter((field) => selectedFields[field]).length;
  const notes = (result.extracted.notes ?? []).filter(Boolean);

  function updateModifiedValue(field: PlanExtractEditableField, value: string | number | ConstructionMethodId | undefined) {
    const nextValues: PlanExtractModifiedValues = { ...modifiedValues };
    if (value === undefined || value === "") {
      delete nextValues[field];
    } else {
      nextValues[field] = value;
    }
    onModifiedValuesChange(nextValues);
    onSelectedFieldsChange({ ...selectedFields, [field]: true });
  }

  return (
    <div className="mt-4 rounded-2xl border bg-background/90 p-4 shadow-sm shadow-foreground/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Revisao da importacao</h3>
            <Badge variant="outline" className={confidenceClass(result.confidence)}>
              confianca {confidenceLabels[result.confidence]}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.summary}</p>
        </div>
        <Badge variant="secondary">{selectedCount} campos selecionados</Badge>
      </div>

      {fields.length > 0 ? (
        <div className="mt-4 divide-y rounded-xl border">
          {fields.map((field) => {
            const confidence = result.fieldConfidence[field] ?? result.confidence;
            const checkboxId = `plan-extract-${field}`;
            const hasModifiedValue = Object.prototype.hasOwnProperty.call(modifiedValues, field);
            const reviewValue = hasModifiedValue ? modifiedValues[field] : result.extracted[field];
            return (
              <div
                key={field}
                className="grid gap-3 p-3 transition-colors hover:bg-muted/45 sm:grid-cols-[auto_1fr_auto]"
              >
                <Checkbox
                  id={checkboxId}
                  checked={Boolean(selectedFields[field])}
                  onCheckedChange={(checked) => onSelectedFieldsChange({ ...selectedFields, [field]: checked === true })}
                  aria-label={`Aplicar ${fieldLabels[field]}`}
                />
                <div className="min-w-0 space-y-3">
                  <label htmlFor={checkboxId} className="block cursor-pointer text-sm font-medium">
                    {fieldLabels[field]}
                  </label>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="rounded-xl border bg-muted/25 p-3">
                      <span className="block text-xs font-medium uppercase tracking-normal text-muted-foreground">Atual</span>
                      <span className="mt-1 block break-words text-sm text-foreground">{formatCurrentFieldValue(field, currentValues[field])}</span>
                    </div>
                    <div className="space-y-2 rounded-xl border bg-background p-3">
                      <span className="block text-xs font-medium uppercase tracking-normal text-muted-foreground">Extraido / revisado</span>
                      <PlanExtractFieldEditor field={field} value={reviewValue} onChange={(value) => updateModifiedValue(field, value)} />
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className={cn("w-fit", confidenceClass(confidence))}>
                  {confidenceLabels[confidence]}
                </Badge>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border bg-muted/35 p-3 text-sm text-muted-foreground">
          Nenhum campo acionavel foi detectado. Voce ainda pode preencher manualmente.
        </p>
      )}

      {(notes.length > 0 || result.assumptions.length > 0 || result.missingInformation.length > 0 || result.warnings.length > 0) && (
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          {notes.length > 0 && <ExtractList title="Observacoes" items={notes} />}
          {result.assumptions.length > 0 && <ExtractList title="Premissas" items={result.assumptions} />}
          {result.missingInformation.length > 0 && <ExtractList title="Faltando" items={result.missingInformation} />}
          {result.warnings.length > 0 && <ExtractList title="Alertas" items={result.warnings} tone="warning" />}
        </div>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDismiss} disabled={isApplying}>
          Revisar depois
        </Button>
        <Button type="button" onClick={onApply} disabled={isApplying || selectedCount === 0}>
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
  onChange: (value: string | number | ConstructionMethodId | undefined) => void;
}) {
  if (field === "constructionMethod") {
    return (
      <Select value={typeof value === "string" ? value : undefined} onValueChange={(methodId) => onChange(methodId as ConstructionMethodId)}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background">
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
    return (
      <Input
        type="number"
        min={field === "doorCount" || field === "windowCount" ? 0 : 0.01}
        step={integerFields.has(field) ? 1 : 0.01}
        value={typeof value === "number" ? String(value) : ""}
        onChange={(event) => {
          const rawValue = event.target.value.trim();
          if (!rawValue) {
            onChange(undefined);
            return;
          }
          const nextValue = Number(rawValue);
          if (Number.isFinite(nextValue)) {
            onChange(integerFields.has(field) ? Math.round(nextValue) : nextValue);
          }
        }}
      />
    );
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

function ExtractList({ title, items, tone }: { title: string; items: string[]; tone?: "warning" }) {
  return (
    <div className="rounded-xl border bg-muted/25 p-3">
      <div className="flex items-center gap-2 font-medium">
        {tone === "warning" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
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
