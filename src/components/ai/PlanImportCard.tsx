"use client";

import { useRef, useState, type DragEvent } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, FileUp, Loader2, UploadCloud } from "lucide-react";
import { PlanExtractReview, type PlanExtractCurrentValues, type PlanExtractModifiedValues } from "@/components/ai/PlanExtractReview";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { applyPlanExtractToProject, getDefaultPlanExtractSelectedFields, type PlanExtractSelectedFields } from "@/lib/ai/apply-plan-extract";
import { getPlanImportPayloadMessage, getPlanImportStateFromResponse, planImportStateCopy, type PlanImportState } from "@/lib/ai/plan-import-ui";
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
  cached?: boolean;
};

type PlanImportCardProps = {
  planExtractEnabled?: boolean;
};

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

function formatProviderName(provider?: string) {
  if (!provider) return undefined;
  return provider === "openai" ? "OpenAI" : provider;
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

export function PlanImportCard({ planExtractEnabled = true }: PlanImportCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const project = useProjectStore((state) => state.project);
  const setProject = useProjectStore((state) => state.setProject);
  const [state, setState] = useState<PlanImportState>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<PlanExtractResult | null>(null);
  const [selectedFields, setSelectedFields] = useState<PlanExtractSelectedFields>({});
  const [modifiedValues, setModifiedValues] = useState<PlanExtractModifiedValues>({});
  const [message, setMessage] = useState("");
  const [providerMeta, setProviderMeta] = useState<{ provider?: string; model?: string; remaining?: string; limit?: string; cached?: boolean }>({});

  const copy = planExtractEnabled
    ? planImportStateCopy[state]
    : {
        badge: "IA desligada",
        title: "Upload assistido indisponivel",
        description: "Configure AI_PLAN_EXTRACT_ENABLED=true e OPENAI_API_KEY no servidor para habilitar OpenAI.",
      };
  const isBusy = state === "uploading" || state === "analyzing";
  const canUpload = planExtractEnabled && !isBusy;
  const currentValues = getCurrentPlanExtractValues(project);
  const showReview = (state === "review-ready" || state === "cache-hit") && result;

  async function uploadFile(file: File) {
    if (!planExtractEnabled) return;

    setState("uploading");
    setMessage("");
    setResult(null);
    setModifiedValues({});
    setProviderMeta({});

    const formData = new FormData();
    formData.append("file", file);

    try {
      const responsePromise = fetch("/api/ai/plan-extract", {
        method: "POST",
        body: formData,
      });
      await waitForNextPaint();
      setState("analyzing");
      const response = await responsePromise;
      const payload = (await response.json().catch(() => null)) as PlanExtractApiPayload | null;
      const nextState = getPlanImportStateFromResponse({
        ok: response.ok,
        status: response.status,
        cached: payload?.cached,
        cacheHeader: response.headers.get("X-AI-Cache"),
      });

      if (!response.ok) {
        setState(nextState);
        setMessage(getPlanImportPayloadMessage(payload, nextState));
        return;
      }

      const parsed = planExtractResultSchema.safeParse(payload?.result);
      if (!parsed.success) {
        setState("error");
        setMessage("A resposta da extracao veio em formato invalido.");
        return;
      }

      const currentProject = useProjectStore.getState().project;
      setResult(parsed.data);
      setSelectedFields(getDefaultPlanExtractSelectedFields(parsed.data, getActiveScenario(currentProject).constructionMethod));
      setModifiedValues({});
      setProviderMeta({
        provider: payload?.provider,
        model: payload?.model,
        cached: nextState === "cache-hit",
        remaining: response.headers.get("X-RateLimit-Remaining") ?? undefined,
        limit: response.headers.get("X-RateLimit-Limit") ?? undefined,
      });
      setState(nextState);
      setMessage(getPlanImportPayloadMessage(payload, nextState));
    } catch {
      setState("error");
      setMessage("Falha de rede ao enviar a planta. Tente novamente ou preencha manualmente.");
    } finally {
      setIsDragging(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function handleDragEnter(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!canUpload) return;
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = canUpload ? "copy" : "none";
    if (!canUpload) return;
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    if (!canUpload) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!canUpload) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  function applyExtractedFields(nextSelectedFields = selectedFields, nextModifiedValues = modifiedValues) {
    if (!result) return;
    const current = useProjectStore.getState().project;
    const reviewedResult = mergeModifiedValues(result, nextModifiedValues);
    const updatedProject = applyPlanExtractToProject(current, current.selectedScenarioId, reviewedResult, nextSelectedFields);
    setProject(updatedProject);
    setModifiedValues({});
    setState("applied");
    setMessage("Campos aplicados. Revise os dados antes de continuar.");
    setTimeout(() => {
      document.getElementById("manual-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function resetReview() {
    setResult(null);
    setSelectedFields({});
    setModifiedValues({});
    setProviderMeta({});
    setMessage("");
    setState("idle");
  }

  function returnToManual() {
    resetReview();
    setTimeout(() => {
      document.getElementById("manual-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div
      data-state={state}
      className={cn(
        "rounded-lg border bg-background/85 p-4 shadow-sm shadow-foreground/5 transition-all",
        isDragging && "border-primary/45 bg-primary/5",
        state === "error" && "border-destructive/40 bg-destructive/5",
        state === "limit-exceeded" && "border-amber-500/45 bg-amber-500/5",
        state === "applied" && "border-primary/25 bg-primary/5",
        state === "cache-hit" && "border-primary/30 bg-primary/5",
        !planExtractEnabled && "border-dashed bg-muted/20"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={supportedPlanExtractMimeTypes.join(",")}
        className="sr-only"
        disabled={!canUpload}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <button
          type="button"
          aria-disabled={!canUpload}
          onClick={() => {
            if (canUpload) inputRef.current?.click();
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "group flex min-h-56 flex-1 flex-col items-center justify-center rounded-lg border border-dashed bg-card p-5 text-center transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35 aria-disabled:cursor-not-allowed aria-disabled:opacity-75",
            canUpload && "hover:border-primary/45 hover:bg-primary/[0.035]",
            isDragging && "border-primary bg-primary/5"
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-lg border bg-background text-muted-foreground">
            {isBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : state === "cache-hit" || state === "review-ready" ? <FileCheck2 className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
          </span>
          <Badge variant={state === "limit-exceeded" || state === "error" ? "destructive" : "secondary"} className="mt-4">
            {copy.badge}
          </Badge>
          <span className="mt-3 text-lg font-semibold">{copy.title}</span>
          <span className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{copy.description}</span>
          {canUpload ? <span className="mt-4 text-xs font-medium text-primary">Clique para selecionar ou solte o arquivo aqui</span> : null}
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-between rounded-lg border bg-background/70 p-4">
          <div>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                {isBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold">Enviar planta baixa</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  OpenAI sugere campos preliminares; o sistema nao aplica nada sem revisao humana.
                </p>
              </div>
            </div>

            {copy.progress ? (
              <div className="mt-4 space-y-2">
                <Progress value={copy.progress} />
                <p className="text-xs text-muted-foreground">{copy.description}</p>
              </div>
            ) : null}

            {message ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border bg-background/75 p-3 text-sm">
                {state === "error" || state === "limit-exceeded" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                )}
                <span className={cn((state === "error" || state === "limit-exceeded") && "text-destructive")}>{message}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <p>Provider configurado: OpenAI.</p>
            {providerMeta.provider ? <p>Resposta: {formatProviderName(providerMeta.provider)}{providerMeta.model ? `/${providerMeta.model}` : ""}.</p> : null}
            {providerMeta.cached ? <p>Cache reaproveitado; limite diario nao foi consumido.</p> : null}
            {providerMeta.remaining && providerMeta.limit ? <p>Limite restante hoje: {providerMeta.remaining}/{providerMeta.limit}.</p> : null}
            {!planExtractEnabled ? <p>Assinatura ChatGPT nao configura esta API automaticamente; use uma API key da OpenAI no ambiente do servidor.</p> : null}
          </div>
        </div>
      </div>

      {showReview ? (
        <PlanExtractReview
          result={result}
          selectedFields={selectedFields}
          currentValues={currentValues}
          modifiedValues={modifiedValues}
          onSelectedFieldsChange={setSelectedFields}
          onModifiedValuesChange={setModifiedValues}
          onApply={applyExtractedFields}
          onDismiss={resetReview}
          onBackToManual={returnToManual}
        />
      ) : null}
    </div>
  );
}
