import { Buffer } from "node:buffer";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { extractPlanWithProviderChain } from "@/lib/ai/providers";
import { createAiRateLimitHeaders, checkAndConsumeAiDailyLimit, getClientIpFromHeaders, isAiDailyLimitReason, isAiRateLimitSetupReason } from "@/lib/ai/rate-limit";
import {
  createMemoryPlanExtractCacheStore,
  createPlanExtractCacheKey,
  getPlanExtractCacheTtlSeconds,
  shouldCachePlanExtractResult,
} from "@/lib/ai/plan-extract-cache";
import { isAiPlanExtractEnabled, sanitizePlanExtractFileName, validatePlanExtractFile } from "@/lib/ai/plan-extract-request";
import { AiPlanExtractError, AiProviderChainError, AiProviderUnavailableError } from "@/lib/ai/errors";
import { AiRouterError } from "@/lib/ai/free-cloud-router";
import { readAiProductMode } from "@/lib/ai/mode";
import { sanitizeAiDiagnosticMessage } from "@/lib/ai/safe-errors";

export const runtime = "nodejs";

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export function serializeProviderErrorsForClient(providerErrors: Array<{ provider: string; message: string }>) {
  return providerErrors.map((providerError) => ({
    provider: providerError.provider,
    message: sanitizeAiDiagnosticMessage(providerError.message),
  }));
}

function getErrorMessage(error: unknown) {
  const mode = readAiProductMode(process.env);
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

function logPlanExtractFailure(error: unknown) {
  const mode = readAiProductMode(process.env);

  if (error instanceof AiProviderChainError) {
    console.warn("ai_plan_extract_provider_chain_failed", {
      mode,
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
      code: error.code,
      message: sanitizeAiDiagnosticMessage(error.message),
    });
    return;
  }

  console.error("ai_plan_extract_unexpected", {
    mode,
    error: sanitizeAiDiagnosticMessage(error instanceof Error ? error.message : String(error)),
  });
}

export async function POST(request: NextRequest) {
  if (!isAiPlanExtractEnabled()) {
    return jsonResponse({ message: "Extracao de planta por IA ainda nao esta habilitada neste ambiente." }, { status: 403 });
  }

  const session = await auth();
  const allowAnonymous = process.env.AI_ALLOW_ANONYMOUS_PLAN_EXTRACT === "true";
  if (!session.userId && !allowAnonymous) {
    return jsonResponse({ message: "Entre na conta para usar a importacao por IA." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return jsonResponse({ message: "Envie um arquivo de planta baixa." }, { status: 400 });
  }

  const validation = validatePlanExtractFile(file);
  if (!validation.valid) {
    return jsonResponse({ message: validation.message, maxBytes: validation.maxBytes }, { status: validation.status });
  }

  let fileBytes: Buffer;
  try {
    fileBytes = Buffer.from(await file.arrayBuffer());
  } catch {
    const payload = getErrorMessage(new AiPlanExtractError("Nao foi possivel ler o arquivo enviado.", "ai-plan-file-read-failed", 400));
    return jsonResponse(payload, { status: 400 });
  }

  const cacheStore = createMemoryPlanExtractCacheStore();
  const cacheKey = createPlanExtractCacheKey({ fileBytes, mimeType: validation.mimeType });
  const cachedExtraction = await cacheStore.get(cacheKey.key).catch(() => null);
  if (cachedExtraction) {
    return jsonResponse(
      {
        result: cachedExtraction.result,
        provider: cachedExtraction.provider,
        model: cachedExtraction.model,
        tokens: cachedExtraction.tokens,
        review: cachedExtraction.review,
        cached: true,
      },
      { headers: { "X-AI-Cache": "HIT" } }
    );
  }

  const trustProxyHeaders = process.env.AI_TRUST_PROXY_IP_HEADERS === "true";
  const rateLimitDecision = await checkAndConsumeAiDailyLimit({
    feature: "plan-extract",
    userId: session.userId,
    ip: getClientIpFromHeaders(request.headers, { trustProxyHeaders }),
  });
  const rateLimitHeaders = createAiRateLimitHeaders(rateLimitDecision);
  if (!rateLimitDecision.allowed) {
    if (rateLimitDecision.reason === "anonymous-not-allowed") {
      return jsonResponse({ message: "Entre na conta para usar a importacao por IA.", reason: rateLimitDecision.reason }, { status: 401, headers: rateLimitHeaders });
    }

    if (isAiDailyLimitReason(rateLimitDecision.reason)) {
      return jsonResponse({ message: "Limite diario de IA atingido. Voce ainda pode preencher manualmente.", reason: rateLimitDecision.reason }, { status: 429, headers: rateLimitHeaders });
    }

    if (isAiRateLimitSetupReason(rateLimitDecision.reason)) {
      return jsonResponse(
        {
          message: "Upload assistido temporariamente indisponivel. Continue manualmente enquanto a configuracao e verificada.",
          reason: rateLimitDecision.reason,
        },
        { status: 503, headers: rateLimitHeaders }
      );
    }

    return jsonResponse(
      {
        message: "Upload assistido temporariamente indisponivel. Continue manualmente enquanto a configuracao e verificada.",
        reason: "rate-limit-unavailable",
      },
      { status: 503, headers: rateLimitHeaders }
    );
  }

  try {
    const fileBase64 = fileBytes.toString("base64");
    const extraction = await extractPlanWithProviderChain({
      mimeType: validation.mimeType,
      fileBase64,
      fileName: sanitizePlanExtractFileName(file.name),
      timeoutMs: 45_000,
    });
    if (shouldCachePlanExtractResult(extraction)) {
      await cacheStore.set(cacheKey.key, extraction, getPlanExtractCacheTtlSeconds()).catch(() => undefined);
    }

    return jsonResponse(
      {
        result: extraction.result,
        provider: extraction.provider,
        model: extraction.model,
        tokens: extraction.tokens,
        review: extraction.review,
      },
      { headers: { ...rateLimitHeaders, "X-AI-Cache": "MISS" } }
    );
  } catch (error) {
    logPlanExtractFailure(error);
    const payload = getErrorMessage(error);
    const status = error instanceof AiPlanExtractError ? error.status : 502;
    return jsonResponse(payload, { status, headers: rateLimitHeaders });
  }
}
