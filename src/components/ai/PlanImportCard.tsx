"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlanExtractReview, type PlanExtractCurrentValues, type PlanExtractModifiedValues } from "@/components/ai/PlanExtractReview";
import { applyPlanExtractToProject, getDefaultPlanExtractSelectedFields, type PlanExtractSelectedFields } from "@/lib/ai/apply-plan-extract";
import { planExtractResultSchema, type PlanExtractResult } from "@/lib/ai/plan-extract-schema";
import { supportedPlanExtractMimeTypes } from "@/lib/ai/plan-extract-request";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { useProjectStore } from "@/lib/store/project-store";
import { cn } from "@/lib/utils";
import type { Project, Scenario } from "@/types/project";

type PlanExtractApiPayload = {
  result?: unknown;
  message?: string;
  provider?: string;
  model?: string;
  tokens?: number;
};

type UploadState = "idle" | "uploading" | "review" | "applied" | "error";

function getPayloadMessage(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }
  return "Nao foi possivel analisar a planta agora.";
}

function getActiveScenario(project: Project): Scenario {
  return project.scenarios.find((scenario) => scenario.id === project.selectedScenarioId) ?? project.scenarios[0];
}

function readNumber(inputs: Record<string, unknown>, key: string) {
  const value = inputs[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getCurrentPlanExtractValues(project: Project): PlanExtractCurrentValues {
  const scenario = getActiveScenario(project);
  const methodInputs = (scenario.methodInputs?.[scenario.constructionMethod] ?? {}) as Record<string, unknown>;
  const methodWidth = readNumber(methodInputs, "widthM");
  const methodDepth = readNumber(methodInputs, "depthM");
  const methodFloors = readNumber(methodInputs, "floors");
  const aFrameGeometry = scenario.constructionMethod === "aframe" ? calculateAFrameGeometry(scenario.terrain, scenario.aFrame) : null;

  return {
    projectName: project.name,
    address: scenario.location.address,
    city: scenario.location.city,
    state: scenario.location.state,
    country: scenario.location.country,
    constructionMethod: scenario.constructionMethod,
    terrainWidthM: scenario.terrain.width,
    terrainDepthM: scenario.terrain.depth,
    houseWidthM: aFrameGeometry?.baseWidth ?? methodWidth,
    houseDepthM: scenario.constructionMethod === "aframe" ? scenario.aFrame.houseDepth : methodDepth,
    builtAreaM2: aFrameGeometry?.combinedTotalArea ?? (methodWidth && methodDepth ? methodWidth * methodDepth * (methodFloors ?? 1) : undefined),
    floorHeightM: scenario.constructionMethod === "aframe" ? scenario.aFrame.minimumUsefulHeight : readNumber(methodInputs, "floorHeightM"),
    floors: scenario.constructionMethod === "aframe" ? (scenario.aFrame.upperFloorMode === "none" ? 1 : 2) : methodFloors,
    doorCount: readNumber(methodInputs, "doorCount"),
    windowCount: readNumber(methodInputs, "windowCount"),
  };
}

function mergeModifiedValues(result: PlanExtractResult, modifiedValues: PlanExtractModifiedValues): PlanExtractResult {
  return {
    ...result,
    extracted: {
      ...result.extracted,
      ...(modifiedValues as Partial<PlanExtractResult["extracted"]>),
    },
  };
}

export function PlanImportCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const project = useProjectStore((state) => state.project);
  const setProject = useProjectStore((state) => state.setProject);
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<PlanExtractResult | null>(null);
  const [selectedFields, setSelectedFields] = useState<PlanExtractSelectedFields>({});
  const [modifiedValues, setModifiedValues] = useState<PlanExtractModifiedValues>({});
  const [message, setMessage] = useState("");
  const [providerMeta, setProviderMeta] = useState<{ provider?: string; model?: string; remaining?: string; limit?: string }>({});

  const isUploading = state === "uploading";
  const currentValues = getCurrentPlanExtractValues(project);

  async function uploadFile(file: File) {
    setState("uploading");
    setMessage("");
    setResult(null);
    setModifiedValues({});
    setProviderMeta({});

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/ai/plan-extract", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as PlanExtractApiPayload | null;
      if (!response.ok) {
        setState("error");
        setMessage(getPayloadMessage(payload));
        return;
      }

      const parsed = planExtractResultSchema.safeParse(payload?.result);
      if (!parsed.success) {
        setState("error");
        setMessage("A resposta da extracao veio em formato invalido.");
        return;
      }

      setResult(parsed.data);
      setSelectedFields(getDefaultPlanExtractSelectedFields(parsed.data, getActiveScenario(project).constructionMethod));
      setModifiedValues({});
      setProviderMeta({
        provider: payload?.provider,
        model: payload?.model,
        remaining: response.headers.get("X-RateLimit-Remaining") ?? undefined,
        limit: response.headers.get("X-RateLimit-Limit") ?? undefined,
      });
      setState("review");
    } catch {
      setState("error");
      setMessage("Falha de rede ao enviar a planta. Tente novamente ou preencha manualmente.");
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function applyExtractedFields() {
    if (!result) return;
    const current = useProjectStore.getState().project;
    const reviewedResult = mergeModifiedValues(result, modifiedValues);
    const updatedProject = applyPlanExtractToProject(current, current.selectedScenarioId, reviewedResult, selectedFields);
    setProject(updatedProject);
    setModifiedValues({});
    setState("applied");
    setMessage("Campos aplicados. Revise os dados antes de continuar.");
    setTimeout(() => {
      document.getElementById("manual-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-background/80 p-4 shadow-sm shadow-foreground/5 transition-all",
        state === "error" && "border-destructive/40 bg-destructive/5",
        state === "applied" && "border-primary/25 bg-primary/5"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={supportedPlanExtractMimeTypes.join(",")}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />

      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold">Importar planta baixa</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Envie PNG, JPG, WebP ou PDF para preencher campos preliminares com revisao humana.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={isUploading}>
              <Upload className="h-4 w-4" />
              Enviar arquivo
            </Button>
          </div>

          {isUploading && (
            <div className="mt-4 space-y-2">
              <Progress value={65} />
              <p className="text-xs text-muted-foreground">Analisando a planta e checando limites diarios.</p>
            </div>
          )}

          {message && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border bg-background/70 p-3 text-sm">
              {state === "error" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
              )}
              <span className={cn(state === "error" && "text-destructive")}>{message}</span>
            </div>
          )}

          {(providerMeta.provider || providerMeta.remaining) && (
            <p className="mt-3 text-xs text-muted-foreground">
              {providerMeta.provider && `Provider: ${providerMeta.provider}${providerMeta.model ? `/${providerMeta.model}` : ""}. `}
              {providerMeta.remaining && providerMeta.limit && `Limite restante hoje: ${providerMeta.remaining}/${providerMeta.limit}.`}
            </p>
          )}
        </div>
      </div>

      {state === "review" && result && (
        <PlanExtractReview
          result={result}
          selectedFields={selectedFields}
          currentValues={currentValues}
          modifiedValues={modifiedValues}
          onSelectedFieldsChange={setSelectedFields}
          onModifiedValuesChange={setModifiedValues}
          onApply={applyExtractedFields}
          onDismiss={() => {
            setModifiedValues({});
            setState("idle");
          }}
        />
      )}
    </div>
  );
}
