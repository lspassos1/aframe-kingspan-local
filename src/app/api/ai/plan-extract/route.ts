import { Buffer } from "node:buffer";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { extractPlanWithProviderChain } from "@/lib/ai/providers";
import { createAiRateLimitHeaders, checkAndConsumeAiDailyLimit, getClientIpFromHeaders } from "@/lib/ai/rate-limit";
import { isAiPlanExtractEnabled, sanitizePlanExtractFileName, validatePlanExtractFile } from "@/lib/ai/plan-extract-request";
import { AiPlanExtractError, AiProviderChainError } from "@/lib/ai/errors";

export const runtime = "nodejs";

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function getErrorMessage(error: unknown) {
  if (error instanceof AiProviderChainError) {
    return {
      message: "Nao foi possivel extrair a planta com os providers configurados.",
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
    const fileBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const extraction = await extractPlanWithProviderChain({
      mimeType: validation.mimeType,
      fileBase64,
      fileName: sanitizePlanExtractFileName(file.name),
      timeoutMs: 45_000,
    });

    return jsonResponse(
      {
        result: extraction.result,
        provider: extraction.provider,
        model: extraction.model,
        tokens: extraction.tokens,
      },
      { headers: rateLimitHeaders }
    );
  } catch (error) {
    const payload = getErrorMessage(error);
    const status = error instanceof AiPlanExtractError ? error.status : 502;
    return jsonResponse(payload, { status, headers: rateLimitHeaders });
  }
}
