"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getConstructionMethodDefinition, type ConstructionMethodId } from "@/lib/construction-methods";
import { getPlanExtractApplicableFields, type PlanExtractSelectedFields } from "@/lib/ai/apply-plan-extract";
import type { PlanExtractConfidence, PlanExtractResult } from "@/lib/ai/plan-extract-schema";

type PlanExtractField = keyof PlanExtractResult["extracted"];

const fieldOrder: PlanExtractField[] = [
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

function formatFieldValue(field: PlanExtractField, value: PlanExtractResult["extracted"][PlanExtractField]) {
  if (value === undefined) return "";
  if (field === "constructionMethod" && typeof value === "string") {
    return getConstructionMethodDefinition(value as ConstructionMethodId).name;
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
  isApplying?: boolean;
  onSelectedFieldsChange: (fields: PlanExtractSelectedFields) => void;
  onApply: () => void;
  onDismiss: () => void;
};

export function PlanExtractReview({
  result,
  selectedFields,
  isApplying,
  onSelectedFieldsChange,
  onApply,
  onDismiss,
}: PlanExtractReviewProps) {
  const fields = orderedApplicableFields(result);
  const selectedCount = fields.filter((field) => selectedFields[field]).length;
  const notes = result.extracted.notes.filter(Boolean);

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
            return (
              <label
                key={field}
                htmlFor={checkboxId}
                className="grid cursor-pointer gap-3 p-3 transition-colors hover:bg-muted/45 sm:grid-cols-[auto_1fr_auto]"
              >
                <Checkbox
                  id={checkboxId}
                  checked={Boolean(selectedFields[field])}
                  onCheckedChange={(checked) => onSelectedFieldsChange({ ...selectedFields, [field]: checked === true })}
                  aria-label={`Aplicar ${fieldLabels[field]}`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{fieldLabels[field]}</span>
                  <span className="mt-1 block break-words text-sm text-muted-foreground">{formatFieldValue(field, result.extracted[field])}</span>
                </span>
                <Badge variant="outline" className={cn("w-fit", confidenceClass(confidence))}>
                  {confidenceLabels[confidence]}
                </Badge>
              </label>
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
