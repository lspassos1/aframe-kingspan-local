import { Buffer } from "node:buffer";
import { auth } from "@clerk/nextjs/server";
import { after, NextRequest, NextResponse } from "next/server";
import { hasReviewablePlanExtractFields, isPlanExtractMethodCompatible, preparePlanExtractResultForMethodReview } from "@/lib/ai/apply-plan-extract";
import { isPlanExtractImageMimeType, shouldPreprocessPlanExtractImage } from "@/lib/ai/plan-image-mime";
import { preprocessPlanExtractImage } from "@/lib/ai/plan-image-preprocess";
import { extractPlanWithProviderChain } from "@/lib/ai/providers";
import { createAiRateLimitHeaders, checkAndConsumeAiDailyLimit, getClientIpFromHeaders, isAiDailyLimitReason, isAiRateLimitSetupReason, releaseAiDailyLimitDecision } from "@/lib/ai/rate-limit";
import {
  createMemoryPlanExtractCacheStore,
  createPlanExtractCacheKey,
  getPlanExtractCacheTtlSeconds,
  shouldCachePlanExtractResult,
} from "@/lib/ai/plan-extract-cache";
import { isAiPlanExtractEnabled, sanitizePlanExtractFileName, validatePlanExtractFile } from "@/lib/ai/plan-extract-request";
import { AiPlanExtractError, AiProviderChainError, AiProviderUnavailableError } from "@/lib/ai/errors";
import { AiRouterError } from "@/lib/ai/free-cloud-router";
import { createAiModeScopedEnv, readAiProductMode, type AiModeEnv, type AiProductMode } from "@/lib/ai/mode";
import {
  createPlanExtractDiagnosticId,
  recordPlanExtractDiagnosticAttempt,
  type PlanExtractDiagnosticCacheStatus,
  type PlanExtractImageProcessingDiagnostic,
  type PlanExtractProviderAttemptDiagnostic,
  type PlanExtractDiagnosticQuotaStatus,
  type PlanExtractDiagnosticStatus,
} from "@/lib/ai/plan-extract-diagnostics";
import { sanitizeAiDiagnosticMessage } from "@/lib/ai/safe-errors";
import type { ConstructionMethodId } from "@/lib/construction-methods";

export const runtime = "nodejs";

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function jsonDiagnosticResponse(body: Record<string, unknown>, diagnosticId: string, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("X-AI-Diagnostic-Id", diagnosticId);
  return jsonResponse({ ...body, diagnosticId }, { ...init, headers });
}

export function serializeProviderErrorsForClient(providerErrors: Array<{ provider: string; message: string }>) {
  return providerErrors.map((providerError) => ({
    provider: providerError.provider,
    message: sanitizeAiDiagnosticMessage(providerError.message),
  }));
}

export function readRequestedPlanExtractMode(formData: FormData | null): AiProductMode {
  return formData?.get("aiMode") === "paid" ? "paid" : "free-cloud";
}

export function readRequestedPlanExtractConstructionMethod(formData: FormData | null): ConstructionMethodId | undefined {
  const value = formData?.get("constructionMethod");
  return typeof value === "string" && isPlanExtractMethodCompatible(value as ConstructionMethodId) ? (value as ConstructionMethodId) : undefined;
}

export function getPlanExtractNoApplicableFieldsPayload(constructionMethod: ConstructionMethodId | undefined) {
  if (constructionMethod) {
    return {
      message: "A análise encontrou dados, mas nenhum campo aplicável ao método atual. Continue manualmente ou tente confirmar o método da planta.",
      reason: "plan-extract-no-current-method-fields",
    };
  }

  return {
    message: "A análise não encontrou campos aplicáveis. Continue manualmente ou tente uma imagem mais legível.",
    reason: "plan-extract-empty-result",
  };
}

function createModeEnv(mode: AiProductMode): AiModeEnv {
  return createAiModeScopedEnv(process.env, mode);
}

function compactProviders<T extends string>(providers: Array<T | undefined>) {
  return providers.filter((provider): provider is T => Boolean(provider));
}

function classifyFreeImageProviderFailure(error: AiProviderChainError) {
  const attempts = error.providerAttempts ?? [];
  const messages = error.providerErrors.map((providerError) => providerError.message).join(" ");
  const statuses = attempts.map((attempt) => attempt.status).filter((status): status is number => Number.isFinite(status));
  if (statuses.includes(429) || /\b429\b/.test(messages)) return "free-image-provider-rate-limited";
  if (attempts.some((attempt) => attempt.retryReason === "timeout") || statuses.some((status) => status === 408 || status === 504) || /\b(abort|timeout|timed out)\b/i.test(messages)) {
    return "free-image-provider-timeout";
  }
  return "free-image-provider-unavailable";
}

export function getPlanExtractErrorPayload(error: unknown, context: { mimeType?: string; env?: AiModeEnv } = {}) {
  const mode = readAiProductMode(context.env ?? process.env);
  if (error instanceof AiProviderUnavailableError) {
    return {
      message:
        mode === "free-cloud"
          ? "Modo gratuito de IA nao esta configurado no servidor."
          : "Modo Pro de IA nao esta configurado no servidor.",
      code: error.code,
    };
  }
  if (error instanceof AiRouterError) {
    return { message: error.message, code: error.code };
  }
  if (error instanceof AiProviderChainError) {
    if (mode === "free-cloud" && context.mimeType === "application/pdf") {
      return {
        message: "Não consegui ler este PDF agora. Exporte a primeira página como imagem ou continue manualmente.",
        reason: "free-pdf-provider-unavailable",
        providers: serializeProviderErrorsForClient(error.providerErrors),
      };
    }

    if (mode === "free-cloud" && isPlanExtractImageMimeType(context.mimeType)) {
      const reason = classifyFreeImageProviderFailure(error);
      return {
        message:
          reason === "free-image-provider-timeout"
            ? "A análise gratuita demorou demais. Continue manualmente ou tente uma imagem menor."
            : reason === "free-image-provider-rate-limited"
              ? "A análise gratuita está temporariamente indisponível. Continue manualmente ou tente novamente mais tarde."
              : "Nao foi possivel extrair a planta com o modo gratuito neste momento.",
        reason,
        providers: serializeProviderErrorsForClient(error.providerErrors),
      };
    }

    return {
      message:
        mode === "free-cloud" ? "Nao foi possivel extrair a planta com o modo gratuito neste momento." : "Nao foi possivel extrair a planta com o Modo Pro neste momento.",
      providers: serializeProviderErrorsForClient(error.providerErrors),
    };
  }
  if (error instanceof AiPlanExtractError) {
    return { message: error.message, code: error.code };
  }
  return { message: "Nao foi possivel analisar a planta agora." };
}

function logPlanExtractFailure(error: unknown, context: { mimeType?: string; env?: AiModeEnv } = {}) {
  const mode = readAiProductMode(context.env ?? process.env);

  if (error instanceof AiProviderChainError) {
    console.warn("ai_plan_extract_provider_chain_failed", {
      mode,
      mimeType: context.mimeType,
      providers: error.providerErrors.map((providerError) => ({
        provider: providerError.provider,
        message: sanitizeAiDiagnosticMessage(providerError.message),
      })),
    });
    return;
  }

  if (error instanceof AiProviderUnavailableError || error instanceof AiRouterError || error instanceof AiPlanExtractError) {
    console.warn("ai_plan_extract_failed", {
      mode,
      mimeType: context.mimeType,
      code: error.code,
      message: sanitizeAiDiagnosticMessage(error.message),
    });
    return;
  }

  console.error("ai_plan_extract_unexpected", {
    mode,
    mimeType: context.mimeType,
    error: sanitizeAiDiagnosticMessage(error instanceof Error ? error.message : String(error)),
  });
}

function getDiagnosticStatusForError(error: unknown): PlanExtractDiagnosticStatus {
  if (error instanceof AiProviderChainError) return "provider_chain_failed";
  if (error instanceof AiProviderUnavailableError || error instanceof AiRouterError) return "setup_unavailable";
  if (error instanceof AiPlanExtractError && error.status < 500) return "invalid_file";
  if (error instanceof AiPlanExtractError) return "setup_unavailable";
  return "provider_chain_failed";
}

function getDiagnosticReasonForError(error: unknown) {
  if (error instanceof AiProviderChainError) return error.code;
  if (error instanceof AiProviderUnavailableError || error instanceof AiRouterError || error instanceof AiPlanExtractError) return error.code;
  return "unexpected-error";
}

function getDiagnosticProviderErrors(error: unknown) {
  if (!(error instanceof AiProviderChainError)) return [];
  return error.providerErrors.map((providerError) => ({
    provider: providerError.provider,
    message: sanitizeAiDiagnosticMessage(providerError.message),
  }));
}

function getDiagnosticProviderAttempts(value: { diagnostics?: { providerAttempts?: PlanExtractProviderAttemptDiagnostic[] }; providerAttempts?: PlanExtractProviderAttemptDiagnostic[] } | unknown) {
  if (value instanceof AiProviderChainError) return value.providerAttempts ?? [];
  if (value && typeof value === "object" && "diagnostics" in value) {
    const diagnostics = (value as { diagnostics?: { providerAttempts?: PlanExtractProviderAttemptDiagnostic[] } }).diagnostics;
    return diagnostics?.providerAttempts ?? [];
  }
  return [];
}

function getProviderDurations(providerAttempts: PlanExtractProviderAttemptDiagnostic[]) {
  return providerAttempts.map((attempt) => ({
    provider: `${attempt.provider}-${attempt.attempt}`,
    durationMs: attempt.durationMs ?? 0,
  }));
}

export async function POST(request: NextRequest) {
  const diagnosticId = createPlanExtractDiagnosticId();
  const startedAt = Date.now();
  let requestedMode: AiProductMode = "free-cloud";
  let aiEnv = createModeEnv(requestedMode);
  let sessionUserId: string | null = null;

  type DiagnosticInput = {
    status: PlanExtractDiagnosticStatus;
    cache: PlanExtractDiagnosticCacheStatus;
    quota: PlanExtractDiagnosticQuotaStatus;
    reason?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    message?: string;
    providersTried?: string[];
    providerErrors?: Array<{ provider: string; message: string }>;
    providerAttempts?: PlanExtractProviderAttemptDiagnostic[];
    providerDurations?: Array<{ provider: string; durationMs: number }>;
    imageProcessing?: PlanExtractImageProcessingDiagnostic;
  };

  async function recordDiagnostic({
    status,
    cache,
    quota,
    reason,
    mimeType,
    fileSizeBytes,
    message,
    providersTried,
    providerErrors,
    providerAttempts,
    providerDurations,
    imageProcessing,
  }: DiagnosticInput, context: { mode: AiProductMode; userId: string | null; env: ReturnType<typeof createModeEnv> }) {
    await recordPlanExtractDiagnosticAttempt({
      diagnosticId,
      mode: context.mode,
      status,
      userId: context.userId,
      mimeType,
      fileSizeBytes,
      cache,
      reason,
      providersTried,
      providerErrors,
      providerAttempts,
      providerDurations,
      imageProcessing,
      durationMs: Date.now() - startedAt,
      quota,
      message,
      env: context.env,
    });
  }

  function queueDiagnostic(input: DiagnosticInput) {
    const context = { mode: requestedMode, userId: sessionUserId, env: aiEnv };
    try {
      after(() => recordDiagnostic(input, context).catch(() => undefined));
    } catch {
      void recordDiagnostic(input, context).catch(() => undefined);
    }
  }

  if (!isAiPlanExtractEnabled()) {
    const message = "Extracao de planta por IA ainda nao esta habilitada neste ambiente.";
    queueDiagnostic({ status: "setup_unavailable", cache: "SKIP", quota: "not-consumed", reason: "plan-extract-disabled", message });
    return jsonDiagnosticResponse({ message }, diagnosticId, { status: 403 });
  }

  const session = await auth();
  sessionUserId = session.userId;
  const allowAnonymous = process.env.AI_ALLOW_ANONYMOUS_PLAN_EXTRACT === "true";
  if (!session.userId && !allowAnonymous) {
    const message = "Entre na conta para usar a importacao por IA.";
    queueDiagnostic({ status: "setup_unavailable", cache: "SKIP", quota: "not-consumed", reason: "auth-required", message });
    return jsonDiagnosticResponse({ message }, diagnosticId, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  requestedMode = readRequestedPlanExtractMode(formData);
  aiEnv = createModeEnv(requestedMode);
  const requestedConstructionMethod = readRequestedPlanExtractConstructionMethod(formData);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    const message = "Envie um arquivo de planta baixa.";
    queueDiagnostic({ status: "invalid_file", cache: "SKIP", quota: "not-consumed", reason: "missing-file", message });
    return jsonDiagnosticResponse({ message }, diagnosticId, { status: 400 });
  }

  const validation = validatePlanExtractFile(file);
  if (!validation.valid) {
    queueDiagnostic({
      status: "invalid_file",
      cache: "SKIP",
      quota: "not-consumed",
      reason: `file-validation-${validation.status}`,
      mimeType: file.type,
      fileSizeBytes: file.size,
      message: validation.message,
    });
    return jsonDiagnosticResponse({ message: validation.message, maxBytes: validation.maxBytes }, diagnosticId, { status: validation.status });
  }

  let fileBytes: Buffer;
  try {
    fileBytes = Buffer.from(await file.arrayBuffer());
  } catch {
    const payload = getPlanExtractErrorPayload(new AiPlanExtractError("Nao foi possivel ler o arquivo enviado.", "ai-plan-file-read-failed", 400), { env: aiEnv });
    queueDiagnostic({
      status: "invalid_file",
      cache: "SKIP",
      quota: "not-consumed",
      reason: "ai-plan-file-read-failed",
      mimeType: validation.mimeType,
      fileSizeBytes: file.size,
      message: typeof payload.message === "string" ? payload.message : undefined,
    });
    return jsonDiagnosticResponse(payload, diagnosticId, { status: 400 });
  }

  const cacheStore = createMemoryPlanExtractCacheStore();
  const cacheKey = createPlanExtractCacheKey({ fileBytes, mimeType: validation.mimeType, env: aiEnv });
  const cachedExtraction = await cacheStore.get(cacheKey.key).catch(() => null);
  if (cachedExtraction) {
    const cachedReviewResult = preparePlanExtractResultForMethodReview(cachedExtraction.result, requestedConstructionMethod);
    if (!hasReviewablePlanExtractFields(cachedExtraction.result, requestedConstructionMethod)) {
      const noApplicableFieldsPayload = getPlanExtractNoApplicableFieldsPayload(requestedConstructionMethod);
      queueDiagnostic({
        status: "extraction_empty",
        cache: "HIT",
        quota: "not-consumed",
        reason: noApplicableFieldsPayload.reason,
        mimeType: validation.mimeType,
        fileSizeBytes: fileBytes.byteLength,
        providersTried: compactProviders([cachedExtraction.provider, cachedExtraction.review?.provider]),
        message: noApplicableFieldsPayload.message,
      });
      return jsonDiagnosticResponse({ ...noApplicableFieldsPayload, mode: requestedMode, cached: true }, diagnosticId, {
        status: 422,
        headers: { "X-AI-Cache": "HIT", "X-AI-Mode": requestedMode },
      });
    }

    queueDiagnostic({
      status: "success",
      cache: "HIT",
      quota: "not-consumed",
      reason: "cache-hit",
      mimeType: validation.mimeType,
      fileSizeBytes: fileBytes.byteLength,
      providersTried: compactProviders([cachedExtraction.provider, cachedExtraction.review?.provider]),
      message: "Resultado recuperado do cache.",
    });
    return jsonDiagnosticResponse(
      {
        mode: requestedMode,
        result: cachedReviewResult,
        provider: cachedExtraction.provider,
        model: cachedExtraction.model,
        tokens: cachedExtraction.tokens,
        review: cachedExtraction.review,
        cached: true,
      },
      diagnosticId,
      { headers: { "X-AI-Cache": "HIT", "X-AI-Mode": requestedMode } }
    );
  }

  const trustProxyHeaders = process.env.AI_TRUST_PROXY_IP_HEADERS === "true";
  const rateLimitDecision = await checkAndConsumeAiDailyLimit({
    feature: "plan-extract",
    mode: requestedMode,
    userId: session.userId,
    ip: getClientIpFromHeaders(request.headers, { trustProxyHeaders }),
  });
  const rateLimitHeaders = createAiRateLimitHeaders(rateLimitDecision);
  if (!rateLimitDecision.allowed) {
    if (rateLimitDecision.reason === "anonymous-not-allowed") {
      const message = "Entre na conta para usar a importacao por IA.";
      queueDiagnostic({
        status: "rate_limit",
        cache: "MISS",
        quota: "not-consumed",
        reason: rateLimitDecision.reason,
        mimeType: validation.mimeType,
        fileSizeBytes: fileBytes.byteLength,
        message,
      });
      return jsonDiagnosticResponse({ message, reason: rateLimitDecision.reason }, diagnosticId, { status: 401, headers: rateLimitHeaders });
    }

    if (isAiDailyLimitReason(rateLimitDecision.reason)) {
      const message = "Limite diario de IA atingido. Voce ainda pode preencher manualmente.";
      queueDiagnostic({
        status: "rate_limit",
        cache: "MISS",
        quota: "not-consumed",
        reason: rateLimitDecision.reason,
        mimeType: validation.mimeType,
        fileSizeBytes: fileBytes.byteLength,
        message,
      });
      return jsonDiagnosticResponse({ message, reason: rateLimitDecision.reason }, diagnosticId, { status: 429, headers: rateLimitHeaders });
    }

    if (isAiRateLimitSetupReason(rateLimitDecision.reason)) {
      const message = "Upload assistido temporariamente indisponivel. Continue manualmente enquanto a configuracao e verificada.";
      queueDiagnostic({
        status: "setup_unavailable",
        cache: "MISS",
        quota: "not-consumed",
        reason: rateLimitDecision.reason,
        mimeType: validation.mimeType,
        fileSizeBytes: fileBytes.byteLength,
        message,
      });
      return jsonDiagnosticResponse(
        {
          message,
          reason: rateLimitDecision.reason,
        },
        diagnosticId,
        { status: 503, headers: rateLimitHeaders }
      );
    }

    const message = "Upload assistido temporariamente indisponivel. Continue manualmente enquanto a configuracao e verificada.";
    queueDiagnostic({
      status: "setup_unavailable",
      cache: "MISS",
      quota: "not-consumed",
      reason: "rate-limit-unavailable",
      mimeType: validation.mimeType,
      fileSizeBytes: fileBytes.byteLength,
      message,
    });
    return jsonDiagnosticResponse(
      {
        message,
        reason: "rate-limit-unavailable",
      },
      diagnosticId,
      { status: 503, headers: rateLimitHeaders }
    );
  }

  let imageProcessing: PlanExtractImageProcessingDiagnostic | undefined;
  const shouldPreprocessImage = shouldPreprocessPlanExtractImage({ mode: requestedMode, mimeType: validation.mimeType });
  try {
    const preprocessed = shouldPreprocessImage ? await preprocessPlanExtractImage({ bytes: fileBytes, mimeType: validation.mimeType }) : null;
    imageProcessing = preprocessed?.diagnostic;
    const providerFileBytes = preprocessed?.bytes ?? fileBytes;
    const providerMimeType = preprocessed?.mimeType ?? validation.mimeType;
    const fileBase64 = providerFileBytes.toString("base64");
    const extraction = await extractPlanWithProviderChain({
      mimeType: providerMimeType,
      fileBase64,
      fileName: sanitizePlanExtractFileName(file.name),
      timeoutMs: 45_000,
    }, { env: aiEnv });
    const providerAttempts = getDiagnosticProviderAttempts(extraction);
    const reviewResult = preparePlanExtractResultForMethodReview(extraction.result, requestedConstructionMethod);
    if (!hasReviewablePlanExtractFields(extraction.result, requestedConstructionMethod)) {
      await releaseAiDailyLimitDecision(rateLimitDecision);
      const noApplicableFieldsPayload = getPlanExtractNoApplicableFieldsPayload(requestedConstructionMethod);
      queueDiagnostic({
        status: "extraction_empty",
        cache: "MISS",
        quota: "released",
        reason: noApplicableFieldsPayload.reason,
        mimeType: validation.mimeType,
        fileSizeBytes: fileBytes.byteLength,
        providersTried: compactProviders([extraction.provider, extraction.review?.provider]),
        providerAttempts,
        providerDurations: getProviderDurations(providerAttempts),
        imageProcessing,
        message: noApplicableFieldsPayload.message,
      });
      return jsonDiagnosticResponse({ ...noApplicableFieldsPayload, mode: requestedMode }, diagnosticId, {
        status: 422,
        headers: { "X-AI-Mode": requestedMode },
      });
    }

    if (shouldCachePlanExtractResult(extraction)) {
      await cacheStore.set(cacheKey.key, extraction, getPlanExtractCacheTtlSeconds()).catch(() => undefined);
    }

    queueDiagnostic({
      status: "success",
      cache: "MISS",
      quota: "consumed",
      reason: "extraction-success",
      mimeType: validation.mimeType,
      fileSizeBytes: fileBytes.byteLength,
      providersTried: compactProviders([extraction.provider, extraction.review?.provider]),
      providerAttempts,
      providerDurations: getProviderDurations(providerAttempts),
      imageProcessing,
      message: "Extração concluída. Revise os campos antes de aplicar.",
    });

    return jsonDiagnosticResponse(
      {
        mode: requestedMode,
        result: reviewResult,
        provider: extraction.provider,
        model: extraction.model,
        tokens: extraction.tokens,
        review: extraction.review,
      },
      diagnosticId,
      { headers: { ...rateLimitHeaders, "X-AI-Cache": "MISS", "X-AI-Mode": requestedMode } }
    );
  } catch (error) {
    logPlanExtractFailure(error, { mimeType: validation.mimeType, env: aiEnv });
    await releaseAiDailyLimitDecision(rateLimitDecision);
    const payload = getPlanExtractErrorPayload(error, { mimeType: validation.mimeType, env: aiEnv });
    const status = error instanceof AiPlanExtractError ? error.status : 502;
    const diagnosticProviderErrors = getDiagnosticProviderErrors(error);
    const providerAttempts = getDiagnosticProviderAttempts(error);
    queueDiagnostic({
      status: getDiagnosticStatusForError(error),
      cache: "MISS",
      quota: "released",
      reason: typeof payload.reason === "string" ? payload.reason : getDiagnosticReasonForError(error),
      mimeType: validation.mimeType,
      fileSizeBytes: fileBytes.byteLength,
      providersTried: diagnosticProviderErrors.map((providerError) => providerError.provider),
      providerErrors: diagnosticProviderErrors,
      providerAttempts,
      providerDurations: getProviderDurations(providerAttempts),
      imageProcessing: imageProcessing ?? (shouldPreprocessImage
        ? {
            status: "failed",
            reason: "preprocess-error",
            originalSizeBucket: "unknown",
            processedSizeBucket: "unknown",
            originalFormat: validation.mimeType.replace("image/", ""),
            processedFormat: validation.mimeType.replace("image/", ""),
          }
        : undefined),
      message: typeof payload.message === "string" ? payload.message : undefined,
    });
    return jsonDiagnosticResponse({ ...payload, mode: requestedMode }, diagnosticId, { status, headers: { "X-AI-Mode": requestedMode } });
  }
}
