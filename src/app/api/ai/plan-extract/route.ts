import { Buffer } from "node:buffer";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { extractPlanWithProviderChain } from "@/lib/ai/providers";
import { createAiRateLimitHeaders, checkAndConsumeAiDailyLimit, getClientIpFromHeaders } from "@/lib/ai/rate-limit";
import { createMemoryPlanExtractCacheStore, createPlanExtractCacheKey, getPlanExtractCacheTtlSeconds } from "@/lib/ai/plan-extract-cache";
import { isAiPlanExtractEnabled, sanitizePlanExtractFileName, validatePlanExtractFile } from "@/lib/ai/plan-extract-request";
import { AiPlanExtractError, AiProviderChainError, AiProviderUnavailableError } from "@/lib/ai/errors";
import { AiRouterError } from "@/lib/ai/free-cloud-router";

export const runtime = "nodejs";

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function getErrorMessage(error: unknown) {
  if (error instanceof AiProviderUnavailableError) {
    return {
      message:
        process.env.AI_MODE === "free-cloud"
          ? "Provider gratuito de IA nao esta configurado no servidor. Verifique GEMINI_API_KEY e GEMINI_MODEL."
          : "OpenAI API nao esta configurada no servidor. Defina OPENAI_API_KEY e AI_OPENAI_MODEL para habilitar a extracao.",
      code: error.code,
    };
  }
  if (error instanceof AiRouterError) {
    return { message: error.message, code: error.code };
  }
  if (error instanceof AiProviderChainError) {
    return {
      message:
        process.env.AI_MODE === "free-cloud"
          ? "Nao foi possivel extrair a planta com provider gratuito neste momento."
          : "Nao foi possivel extrair a planta com OpenAI neste momento.",
      providers: error.providerErrors,
    };
  }
  if (error instanceof AiPlanExtractError) {
    return { message: error.message, code: error.code };
  }
  return { message: "Nao foi possivel analisar a planta agora." };
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
    const status = rateLimitDecision.reason === "anonymous-not-allowed" ? 401 : 429;
    return jsonResponse({ message: "Limite diario de IA atingido. Voce ainda pode preencher manualmente.", reason: rateLimitDecision.reason }, { status, headers: rateLimitHeaders });
  }

  try {
    const fileBase64 = fileBytes.toString("base64");
    const extraction = await extractPlanWithProviderChain({
      mimeType: validation.mimeType,
      fileBase64,
      fileName: sanitizePlanExtractFileName(file.name),
      timeoutMs: 45_000,
    });
    await cacheStore.set(cacheKey.key, extraction, getPlanExtractCacheTtlSeconds()).catch(() => undefined);

    return jsonResponse(
      {
        result: extraction.result,
        provider: extraction.provider,
        model: extraction.model,
        tokens: extraction.tokens,
      },
      { headers: { ...rateLimitHeaders, "X-AI-Cache": "MISS" } }
    );
  } catch (error) {
    const payload = getErrorMessage(error);
    const status = error instanceof AiPlanExtractError ? error.status : 502;
    return jsonResponse(payload, { status, headers: rateLimitHeaders });
  }
}
