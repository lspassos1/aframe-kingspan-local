"use client";

import { useRef, useState, type DragEvent } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, FileUp, Loader2, UploadCloud } from "lucide-react";
import { PlanExtractReview, type PlanExtractCurrentValues, type PlanExtractModifiedValues, type PlanExtractQuestionAnswers } from "@/components/ai/PlanExtractReview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { applyPlanExtractToProject, getDefaultPlanExtractSelectedFields, type PlanExtractSelectedFields } from "@/lib/ai/apply-plan-extract";
import {
  defaultPlanImportProviderUiStatus,
  canUsePlanImportUpload,
  formatPlanImportProviderName,
  getPlanImportPayloadMessage,
  getPlanImportStateCopy,
  getPlanImportStateFromResponse,
  type PlanImportProviderUiStatus,
  type PlanImportState,
} from "@/lib/ai/plan-import-ui";
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
  reason?: string;
  review?: PlanExtractReviewPayload;
};

type PlanExtractReviewPayload = {
  status?: "completed" | "skipped" | "unavailable";
  provider?: string;
  model?: string;
  error?: {
    message?: string;
    code?: string;
    retryable?: boolean;
  };
  comparison?: {
    agreements?: unknown[];
    divergences?: unknown[];
    unresolved?: unknown[];
  };
};

type PlanImportCardProps = {
  planExtractEnabled?: boolean;
  aiProviderStatus?: PlanImportProviderUiStatus;
  onManualFallback?: () => void;
  onStateChange?: (state: PlanImportState) => void;
  initialState?: PlanImportState;
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

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

function getReviewStatusLabel(review?: PlanExtractReviewPayload, providerStatus: PlanImportProviderUiStatus = defaultPlanImportProviderUiStatus) {
  if (!review && providerStatus.mode === "free-cloud") {
    return providerStatus.reviewProviderLabel ? `${providerStatus.reviewProviderLabel}: aguardando upload.` : "Revisão: não configurada.";
  }
  if (!review) return undefined;
  const providerLabel = providerStatus.reviewProviderLabel ?? "Revisão detalhada";
  if (review.status === "completed") {
    const divergences = review.comparison?.divergences?.length ?? 0;
    const unresolved = review.comparison?.unresolved?.length ?? 0;
    if (divergences || unresolved) return `${providerLabel}: divergências marcadas para revisão (${divergences + unresolved}).`;
    return `${providerLabel}: segunda leitura concluída.`;
  }
  if (review.status === "skipped") return `${providerLabel}: comparação indisponível para este arquivo.`;
  if (review.status === "unavailable") return `${providerLabel}: indisponível; fluxo manual/revisão continuam.`;
  return undefined;
}

function getPlanImportProductStatusLines({
  planExtractEnabled,
  state,
  aiProviderStatus,
  reviewStatusLabel,
  providerMeta,
}: {
  planExtractEnabled: boolean;
  state: PlanImportState;
  aiProviderStatus: PlanImportProviderUiStatus;
  reviewStatusLabel?: string;
  providerMeta: { provider?: string; remaining?: string; limit?: string; cached?: boolean };
}) {
  if (!planExtractEnabled) {
    return [
      aiProviderStatus.mode === "free-cloud" ? "Modo gratuito aguardando configuração no servidor." : "Modo Pro aguardando configuração no servidor.",
      "Continuar manualmente disponível.",
    ];
  }

  if (state === "error") {
    return ["Análise não concluída.", "Continuar manualmente disponível.", "Tente outro arquivo quando a análise estiver disponível."];
  }

  if (state === "temporarily-unavailable") {
    return ["Upload assistido temporariamente indisponível.", "Continuar manualmente disponível.", "Configuração sendo verificada com segurança."];
  }

  if (state === "limit-exceeded") {
    return ["Limite diário atingido.", "Continuar manualmente disponível.", "Tente novamente amanhã."];
  }

  if (state === "cache-hit") {
    return ["Resultado recuperado do cache.", "Revisão humana obrigatória.", "Limite diário não foi consumido."];
  }

  if (state === "review-ready") {
    return ["Análise pronta para revisão.", reviewStatusLabel ?? "Revisão humana obrigatória.", "Nada será aplicado sem confirmação."];
  }

  if (state === "applied") {
    return ["Campos aplicados.", "Revise medidas antes de seguir.", "Você pode voltar ao preenchimento manual a qualquer momento."];
  }

  if (state === "uploading") {
    return ["Upload em andamento.", "Aguarde a análise antes de trocar de arquivo.", "Nada será aplicado sem revisão."];
  }

  if (state === "analyzing") {
    return ["Análise em andamento.", "Campos preliminares serão enviados para revisão.", "Nada será aplicado automaticamente."];
  }

  const lines = [
    aiProviderStatus.mode === "free-cloud"
      ? `Modo gratuito: ${aiProviderStatus.primaryProviderLabel}${aiProviderStatus.primaryConfigured ? "" : " aguardando configuração no servidor"}.`
      : `${aiProviderStatus.modeLabel}${aiProviderStatus.primaryConfigured ? "" : " aguardando configuração no servidor"}.`,
  ];

  if (aiProviderStatus.mode === "free-cloud" && aiProviderStatus.reviewProviderLabel) {
    lines.push(`Revisão: ${aiProviderStatus.reviewProviderLabel}${aiProviderStatus.reviewConfigured ? "" : " aguardando configuração no servidor"}.`);
  }
  if (providerMeta.provider) lines.push(`Resposta: ${formatPlanImportProviderName(providerMeta.provider)}.`);
  if (reviewStatusLabel) lines.push(reviewStatusLabel);
  if (providerMeta.cached) lines.push("Cache reaproveitado; limite diário não foi consumido.");
  if (providerMeta.remaining && providerMeta.limit) lines.push(`Limite restante hoje: ${providerMeta.remaining}/${providerMeta.limit}.`);
  if (aiProviderStatus.mode === "free-cloud") lines.push("Sem cobrança automática; continue manualmente se a análise não estiver disponível.");

  return lines;
}

export function PlanImportCard({
  planExtractEnabled = true,
  aiProviderStatus = defaultPlanImportProviderUiStatus,
  onManualFallback,
  onStateChange,
  initialState = "idle",
}: PlanImportCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const project = useProjectStore((state) => state.project);
  const setProject = useProjectStore((state) => state.setProject);
  const [state, setState] = useState<PlanImportState>(initialState);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<PlanExtractResult | null>(null);
  const [selectedFields, setSelectedFields] = useState<PlanExtractSelectedFields>({});
  const [modifiedValues, setModifiedValues] = useState<PlanExtractModifiedValues>({});
  const [questionAnswers, setQuestionAnswers] = useState<PlanExtractQuestionAnswers>({});
  const [message, setMessage] = useState("");
  const [providerMeta, setProviderMeta] = useState<{ provider?: string; model?: string; remaining?: string; limit?: string; cached?: boolean; review?: PlanExtractReviewPayload }>({});

  const copy = planExtractEnabled
    ? getPlanImportStateCopy(state, aiProviderStatus)
    : {
        badge: "IA desligada",
        title: "Upload assistido indisponível",
        description:
          aiProviderStatus.mode === "free-cloud"
            ? "Configure o modo gratuito no servidor."
            : "Configure o Modo Pro no servidor.",
      };
  const isBusy = state === "uploading" || state === "analyzing";
  const canUpload = canUsePlanImportUpload({ planExtractEnabled, state });
  const currentValues = getCurrentPlanExtractValues(project);
  const showReview = (state === "review-ready" || state === "cache-hit") && result;
  const canShowManualRecovery = !planExtractEnabled || state === "error" || state === "limit-exceeded" || state === "temporarily-unavailable";
  const reviewStatusLabel = getReviewStatusLabel(providerMeta.review, aiProviderStatus);
  const shouldShowMessage = Boolean(message) && state !== "limit-exceeded" && state !== "temporarily-unavailable";
  const providerCopy =
    aiProviderStatus.mode === "free-cloud"
      ? `${aiProviderStatus.primaryProviderLabel} sugere campos preliminares; o sistema não aplica nada sem revisão humana.`
      : "Modo Pro sugere campos preliminares; o sistema não aplica nada sem revisão humana.";
  const productStatusLines = getPlanImportProductStatusLines({ planExtractEnabled, state, aiProviderStatus, reviewStatusLabel, providerMeta });

  function updateState(nextState: PlanImportState) {
    setState(nextState);
    onStateChange?.(nextState);
  }

  function openManualFallback() {
    if (onManualFallback) {
      onManualFallback();
      return;
    }
    setTimeout(() => {
      document.getElementById("manual-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function uploadFile(file: File) {
    if (!canUpload) return;

    updateState("uploading");
    setMessage("");
    setResult(null);
    setModifiedValues({});
    setQuestionAnswers({});
    setProviderMeta({});

    const formData = new FormData();
    formData.append("file", file);

    try {
      const responsePromise = fetch("/api/ai/plan-extract", {
        method: "POST",
        body: formData,
      });
      await waitForNextPaint();
      updateState("analyzing");
      const response = await responsePromise;
      const payload = (await response.json().catch(() => null)) as PlanExtractApiPayload | null;
      const nextState = getPlanImportStateFromResponse({
        ok: response.ok,
        status: response.status,
        cached: payload?.cached,
        cacheHeader: response.headers.get("X-AI-Cache"),
        reason: typeof payload?.reason === "string" ? payload.reason : undefined,
      });

      if (!response.ok) {
        updateState(nextState);
        setMessage(getPlanImportPayloadMessage(payload, nextState));
        return;
      }

      const parsed = planExtractResultSchema.safeParse(payload?.result);
      if (!parsed.success) {
        updateState("error");
        setMessage("A resposta da extração veio em formato inválido.");
        return;
      }

      const currentProject = useProjectStore.getState().project;
      setResult(parsed.data);
      setSelectedFields(getDefaultPlanExtractSelectedFields(parsed.data, getActiveScenario(currentProject).constructionMethod));
      setModifiedValues({});
      setProviderMeta({
        provider: payload?.provider,
        model: payload?.model,
        review: payload?.review,
        cached: nextState === "cache-hit",
        remaining: response.headers.get("X-RateLimit-Remaining") ?? undefined,
        limit: response.headers.get("X-RateLimit-Limit") ?? undefined,
      });
      updateState(nextState);
      setMessage(getPlanImportPayloadMessage(payload, nextState));
    } catch {
      updateState("error");
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
    updateState("applied");
    setMessage("Campos aplicados. Revise os dados antes de continuar.");
    openManualFallback();
  }

  function resetReview() {
    setResult(null);
    setSelectedFields({});
    setModifiedValues({});
    setQuestionAnswers({});
    setProviderMeta({});
    setMessage("");
    updateState("idle");
  }

  function returnToManual() {
    resetReview();
    openManualFallback();
  }

  return (
    <div
      data-state={state}
      className={cn(
        "rounded-lg border bg-background/85 p-4 shadow-sm shadow-foreground/5 transition-all",
        isDragging && "border-primary/45 bg-primary/5",
        (state === "error" || state === "temporarily-unavailable") && "border-destructive/40 bg-destructive/5",
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
            state === "limit-exceeded" && "min-h-48 p-4 sm:min-h-56 sm:p-5",
            canUpload && "hover:border-primary/45 hover:bg-primary/[0.035]",
            isDragging && "border-primary bg-primary/5"
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-lg border bg-background text-muted-foreground">
            {isBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : state === "cache-hit" || state === "review-ready" ? (
              <FileCheck2 className="h-5 w-5" />
            ) : state === "limit-exceeded" || state === "temporarily-unavailable" ? (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </span>
          <Badge variant={state === "limit-exceeded" || state === "error" || state === "temporarily-unavailable" ? "destructive" : "secondary"} className="mt-4">
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
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{providerCopy}</p>
              </div>
            </div>

            {copy.progress ? (
              <div className="mt-4 space-y-2">
                <Progress value={copy.progress} />
                <p className="text-xs text-muted-foreground">{copy.description}</p>
              </div>
            ) : null}

            {shouldShowMessage ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border bg-background/75 p-3 text-sm">
                {state === "error" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                )}
                <span className={cn(state === "error" && "text-destructive")}>{message}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-2 text-xs text-muted-foreground" aria-label="Status do upload assistido">
            {productStatusLines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
          {canShowManualRecovery ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={openManualFallback}>
                Continuar manualmente
              </Button>
              {state === "limit-exceeded" ? (
                <Button type="button" variant="outline" onClick={resetReview}>
                  Tentar novamente depois
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {showReview ? (
        <PlanExtractReview
          result={result}
          selectedFields={selectedFields}
          currentValues={currentValues}
          modifiedValues={modifiedValues}
          questionAnswers={questionAnswers}
          onSelectedFieldsChange={setSelectedFields}
          onModifiedValuesChange={setModifiedValues}
          onQuestionAnswersChange={setQuestionAnswers}
          onApply={applyExtractedFields}
          onDismiss={resetReview}
          onBackToManual={returnToManual}
          analysisStatus={{
            modeLabel: aiProviderStatus.modeLabel,
            primaryProviderLabel: formatPlanImportProviderName(providerMeta.provider) ?? aiProviderStatus.primaryProviderLabel,
            reviewProviderLabel: aiProviderStatus.reviewProviderLabel,
            cached: providerMeta.cached,
            review: providerMeta.review,
            paidFallbackEnabled: aiProviderStatus.paidFallbackEnabled,
          }}
        />
      ) : null}
    </div>
  );
}
