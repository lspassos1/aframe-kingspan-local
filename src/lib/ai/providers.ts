import { planExtractSystemPrompt, planExtractUserPrompt } from "@/lib/ai/prompts";
import { mergePlanExtractionResults, type PlanExtractComparisonSummary } from "@/lib/ai/plan-result-merge";
import { parsePlanExtractResult, type PlanExtractResult } from "@/lib/ai/plan-extract-schema";
import { AiProviderChainError, AiProviderUnavailableError } from "@/lib/ai/errors";
import { AiRouterError, getAiTaskProviderId, resolveAiTaskProvider, type AiCloudProviderId } from "@/lib/ai/free-cloud-router";
import { isPlanExtractImageMimeType } from "@/lib/ai/plan-image-mime";
import { readAiProductMode } from "@/lib/ai/mode";
import { sanitizeAiDiagnosticMessage } from "@/lib/ai/safe-errors";

export type AiPlanExtractProviderId = "gemini" | "openai" | "openrouter" | "groq";

export type AiPlanExtractMimeType = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";

export type AiPlanExtractEnv = Record<string, string | undefined>;

export type AiPlanExtractProviderConfig = {
  id: AiPlanExtractProviderId;
  model: string;
  configured: boolean;
  baseUrl?: string;
  apiKey?: string;
  supports: AiPlanExtractMimeType[];
};

export type AiPlanExtractInput = {
  mimeType: AiPlanExtractMimeType;
  fileBase64: string;
  fileName?: string;
  timeoutMs?: number;
};

export type AiPlanExtractProviderResult = {
  result: PlanExtractResult;
  provider: AiPlanExtractProviderId;
  model: string;
  tokens?: number;
  review?: AiPlanReviewResult;
  diagnostics?: {
    providerAttempts: AiPlanExtractProviderAttempt[];
  };
};

export type AiPlanExtractProviderAttempt = {
  provider: AiPlanExtractProviderId;
  attempt: number;
  outcome: "success" | "failed";
  durationMs: number;
  status?: number;
  retryReason?: "timeout" | "transient-error";
};

export type AiPlanReviewResult = {
  status: "completed" | "skipped" | "unavailable";
  provider?: AiPlanExtractProviderId;
  model?: string;
  tokens?: number;
  comparison?: PlanExtractComparisonSummary;
  error?: {
    message: string;
    code?: string;
    retryable?: boolean;
  };
};

const officialProviderOrder: AiPlanExtractProviderId[] = ["openai"];

const providerDefaults: Record<AiPlanExtractProviderId, { modelEnv: string; keyEnv?: string; defaultModel: string; baseUrl?: string; supports: AiPlanExtractMimeType[] }> = {
  gemini: {
    modelEnv: "GEMINI_MODEL",
    keyEnv: "GEMINI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    supports: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  },
  openai: {
    modelEnv: "AI_OPENAI_MODEL",
    keyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    supports: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  },
  openrouter: {
    modelEnv: "OPENROUTER_PLAN_REVIEW_MODEL",
    keyEnv: "OPENROUTER_API_KEY",
    defaultModel: "",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    supports: ["image/png", "image/jpeg", "image/webp"],
  },
  groq: {
    modelEnv: "GROQ_TEXT_MODEL",
    keyEnv: "GROQ_API_KEY",
    defaultModel: "llama-3.1-8b-instant",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    supports: [],
  },
};

class AiProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "AiProviderHttpError";
  }
}

function isFreeCloudMode(env: AiPlanExtractEnv) {
  return readAiProductMode(env) === "free-cloud";
}

function toPlanExtractProviderId(providerId: AiCloudProviderId): AiPlanExtractProviderId | undefined {
  if (providerId === "gemini" || providerId === "openai" || providerId === "openrouter" || providerId === "groq") return providerId;
  return undefined;
}

export function getAiPlanExtractProviderOrder(env: AiPlanExtractEnv = process.env) {
  if (isFreeCloudMode(env)) {
    const providerId = toPlanExtractProviderId(getAiTaskProviderId("plan-primary", env));
    const providerOrder = providerId ? [providerId] : [];

    try {
      const reviewProvider = getAiPlanReviewProviderConfig(env);
      if (reviewProvider && !providerOrder.includes(reviewProvider.id)) {
        providerOrder.push(reviewProvider.id);
      }
    } catch {
      // Invalid review-provider configuration must not block the primary free-cloud provider.
    }

    return providerOrder;
  }

  return officialProviderOrder;
}

export function getAiPlanExtractProviderConfigs(env: AiPlanExtractEnv = process.env): AiPlanExtractProviderConfig[] {
  return getAiPlanExtractProviderOrder(env).map((id) => {
    const defaults = providerDefaults[id];
    const configuredModel = id === "openai" ? env.AI_OPENAI_MODEL_PREMIUM?.trim() || env.AI_OPENAI_MODEL?.trim() : env[defaults.modelEnv]?.trim();
    const model = configuredModel || defaults.defaultModel;
    const baseUrl = defaults.baseUrl;
    const apiKey = defaults.keyEnv ? env[defaults.keyEnv] : undefined;
    return {
      id,
      model,
      baseUrl,
      apiKey,
      configured: Boolean((id === "openai" ? configuredModel : model) && baseUrl && apiKey),
      supports: defaults.supports,
    };
  });
}

export function getAiPlanReviewProviderConfig(env: AiPlanExtractEnv = process.env): AiPlanExtractProviderConfig | undefined {
  if (!isFreeCloudMode(env)) return undefined;

  const resolved = resolveAiTaskProvider("plan-review", { env });
  const id = toPlanExtractProviderId(resolved.id);
  if (!id) throw new AiProviderUnavailableError(`Provider ${resolved.id} nao suporta revisao de planta.`);

  const defaults = providerDefaults[id];
  const model = resolved.modelEnv ? env[resolved.modelEnv] || defaults.defaultModel : defaults.defaultModel;
  const baseUrl = defaults.baseUrl;
  const apiKey = defaults.keyEnv ? env[defaults.keyEnv] : undefined;
  return {
    id,
    model,
    baseUrl,
    apiKey,
    configured: Boolean(model && baseUrl && apiKey),
    supports: defaults.supports,
  };
}

export function getConfiguredAiPlanExtractProviders(env: AiPlanExtractEnv = process.env) {
  return getAiPlanExtractProviderConfigs(env).filter((provider) => provider.configured && provider.supports.length > 0);
}

function createAbortSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function buildMessageContent(input: AiPlanExtractInput) {
  const dataUrl = `data:${input.mimeType};base64,${input.fileBase64}`;
  if (input.mimeType === "application/pdf") {
    return [
      { type: "text", text: `${planExtractSystemPrompt}\n\n${planExtractUserPrompt}` },
      {
        type: "file",
        file: {
          filename: input.fileName ?? "planta.pdf",
          file_data: dataUrl,
        },
      },
    ];
  }

  return [
    { type: "text", text: `${planExtractSystemPrompt}\n\n${planExtractUserPrompt}` },
    // Pro upload is explicit and floor-plan symbols need legibility; high detail is intentional despite the higher token cost.
    { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
  ];
}

async function callOpenAiCompatibleProvider(
  config: AiPlanExtractProviderConfig,
  input: AiPlanExtractInput,
  fetchImpl: typeof fetch = fetch
): Promise<AiPlanExtractProviderResult> {
  if (!config.baseUrl || !config.apiKey) {
    throw new AiProviderUnavailableError(`Provider ${config.id} nao esta configurado.`);
  }
  if (!config.supports.includes(input.mimeType)) {
    throw new AiProviderUnavailableError(`Provider ${config.id} nao suporta ${input.mimeType}.`);
  }

  const timeout = createAbortSignal(input.timeoutMs ?? 30_000);
  try {
    const response = await fetchImpl(config.baseUrl, {
      method: "POST",
      signal: timeout.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: buildMessageContent(input),
          },
        ],
      }),
    });

    if (!response.ok) throw new AiProviderHttpError(`Provider ${config.id} respondeu ${response.status}.`, response.status);

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error(`Provider ${config.id} nao retornou conteudo.`);

    const result = parsePlanExtractResult(content);
    return {
      result: {
        ...result,
        providerMeta: {
          provider: config.id,
          model: config.model,
          tokens: payload.usage?.total_tokens,
        },
      },
      provider: config.id,
      model: config.model,
      tokens: payload.usage?.total_tokens,
    };
  } finally {
    timeout.clear();
  }
}

export async function callOpenRouterPlanReviewProvider(
  config: AiPlanExtractProviderConfig,
  input: AiPlanExtractInput,
  fetchImpl: typeof fetch = fetch
) {
  if (config.id !== "openrouter") {
    throw new AiProviderUnavailableError(`Provider ${config.id} nao suporta revisao OpenRouter.`);
  }
  return callOpenAiCompatibleProvider(config, input, fetchImpl);
}

function buildGeminiMessageParts(input: AiPlanExtractInput) {
  return [
    { text: `${planExtractSystemPrompt}\n\n${planExtractUserPrompt}` },
    {
      inline_data: {
        mime_type: input.mimeType,
        data: input.fileBase64,
      },
    },
  ];
}

export function createGeminiPlanExtractRequest(input: AiPlanExtractInput) {
  return {
    contents: [
      {
        role: "user",
        parts: buildGeminiMessageParts(input),
      },
    ],
    generationConfig: {
      temperature: 0,
      response_mime_type: "application/json",
    },
  };
}

function createGeminiGenerateContentUrl(config: AiPlanExtractProviderConfig) {
  if (!config.baseUrl) throw new AiProviderUnavailableError("Provider gemini nao esta configurado.");
  return `${config.baseUrl}/${encodeURIComponent(config.model)}:generateContent`;
}

function readGeminiResponseText(payload: unknown) {
  const response = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = response.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function callGeminiPlanExtractProvider(
  config: AiPlanExtractProviderConfig,
  input: AiPlanExtractInput,
  fetchImpl: typeof fetch = fetch
): Promise<AiPlanExtractProviderResult> {
  if (!config.apiKey || !config.baseUrl) {
    throw new AiProviderUnavailableError("Provider gemini nao esta configurado.");
  }
  if (!config.supports.includes(input.mimeType)) {
    throw new AiProviderUnavailableError(`Provider gemini nao suporta ${input.mimeType}.`);
  }

  const timeout = createAbortSignal(input.timeoutMs ?? 30_000);
  try {
    const response = await fetchImpl(createGeminiGenerateContentUrl(config), {
      method: "POST",
      signal: timeout.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify(createGeminiPlanExtractRequest(input)),
    });

    if (!response.ok) throw new AiProviderHttpError(`Provider gemini respondeu ${response.status}.`, response.status);

    const payload = (await response.json()) as {
      usageMetadata?: { totalTokenCount?: number };
    };
    const content = readGeminiResponseText(payload);
    if (!content) throw new Error("Provider gemini nao retornou conteudo.");

    const result = parsePlanExtractResult(content);
    return {
      result: {
        ...result,
        providerMeta: {
          provider: config.id,
          model: config.model,
          tokens: payload.usageMetadata?.totalTokenCount,
        },
      },
      provider: config.id,
      model: config.model,
      tokens: payload.usageMetadata?.totalTokenCount,
    };
  } finally {
    timeout.clear();
  }
}

function assertFreeCloudPlanPrimaryProvider(env: AiPlanExtractEnv) {
  if (!isFreeCloudMode(env)) return;
  resolveAiTaskProvider("plan-primary", { env });
}

async function callPlanExtractProvider(config: AiPlanExtractProviderConfig, input: AiPlanExtractInput) {
  if (config.id === "gemini") return callGeminiPlanExtractProvider(config, input);
  return callOpenAiCompatibleProvider(config, input);
}

function isRetryableReviewError(error: unknown) {
  if (error instanceof AiProviderHttpError) return error.status === 408 || error.status === 409 || error.status === 425 || error.status === 429 || error.status >= 500;
  if (error instanceof AiRouterError || error instanceof AiProviderUnavailableError) return false;
  return true;
}

function getProviderHttpStatus(error: unknown) {
  if (error instanceof AiProviderHttpError) return error.status;
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/\b([1-5]\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

function isProviderAbortOrTimeout(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || /\b(abort|timeout|timed out|tempo esgotado)\b/i.test(error.message);
}

function getFreeImageProviderRetryReason(provider: AiPlanExtractProviderConfig, input: AiPlanExtractInput, error: unknown, env: AiPlanExtractEnv) {
  if (!isFreeCloudMode(env)) return undefined;
  if (!isPlanExtractImageMimeType(input.mimeType)) return undefined;
  if (provider.id !== "gemini") return undefined;
  if (error instanceof AiRouterError || error instanceof AiProviderUnavailableError) return undefined;
  const status = getProviderHttpStatus(error);
  if (isProviderAbortOrTimeout(error) || status === 408 || status === 504) return "timeout";
  if (status !== undefined && status >= 500) return "transient-error";
  return undefined;
}

function mergeProviderAttempts(
  result: AiPlanExtractProviderResult,
  providerAttempts: AiPlanExtractProviderAttempt[]
): AiPlanExtractProviderResult {
  return {
    ...result,
    diagnostics: {
      providerAttempts,
    },
  };
}

function serializeReviewError(error: unknown, retryable: boolean) {
  return {
    message: sanitizeAiDiagnosticMessage(error instanceof Error ? error.message : "Erro desconhecido."),
    code: error instanceof AiRouterError ? error.code : error instanceof AiProviderUnavailableError ? error.code : undefined,
    retryable,
  };
}

async function attachPlanReview(
  primary: AiPlanExtractProviderResult,
  input: AiPlanExtractInput,
  env: AiPlanExtractEnv,
  callReviewProvider: (config: AiPlanExtractProviderConfig, input: AiPlanExtractInput) => Promise<AiPlanExtractProviderResult>
): Promise<AiPlanExtractProviderResult> {
  if (!isFreeCloudMode(env)) return primary;

  let reviewProvider: AiPlanExtractProviderConfig | undefined;
  try {
    reviewProvider = getAiPlanReviewProviderConfig(env);
  } catch (error) {
    return {
      ...primary,
      review: {
        status: "unavailable",
        error: serializeReviewError(error, false),
      },
    };
  }

  if (!reviewProvider) return primary;
  if (reviewProvider.id === primary.provider) {
    return {
      ...primary,
      review: {
        status: "skipped",
        provider: reviewProvider.id,
        model: reviewProvider.model,
        error: {
          message: "Segunda leitura ignorada porque o mesmo provider gratuito ja foi usado na analise principal.",
          code: "ai-review-provider-already-used",
          retryable: false,
        },
      },
    };
  }
  if (!reviewProvider.configured) {
    return {
      ...primary,
      review: {
        status: "unavailable",
        provider: reviewProvider.id,
        model: reviewProvider.model,
        error: serializeReviewError(new AiProviderUnavailableError(`Provider ${reviewProvider.id} nao esta configurado para segunda leitura.`), false),
      },
    };
  }
  if (!reviewProvider.supports.includes(input.mimeType)) {
    return {
      ...primary,
      review: {
        status: "skipped",
        provider: reviewProvider.id,
        model: reviewProvider.model,
        error: {
          message: `Provider ${reviewProvider.id} nao suporta ${input.mimeType} para segunda leitura.`,
          code: "ai-provider-capability-mismatch",
          retryable: false,
        },
      },
    };
  }

  try {
    const review = await callReviewProvider(reviewProvider, input);
    const merged = mergePlanExtractionResults(primary.result, review.result);
    return {
      ...primary,
      result: merged.result,
      review: {
        status: "completed",
        provider: review.provider,
        model: review.model,
        tokens: review.tokens,
        comparison: merged.comparison,
      },
    };
  } catch (error) {
    return {
      ...primary,
      review: {
        status: "unavailable",
        provider: reviewProvider.id,
        model: reviewProvider.model,
        error: serializeReviewError(error, isRetryableReviewError(error)),
      },
    };
  }
}

export async function extractPlanWithProviderChain(
  input: AiPlanExtractInput,
  options: {
    env?: AiPlanExtractEnv;
    callProvider?: (config: AiPlanExtractProviderConfig, input: AiPlanExtractInput) => Promise<AiPlanExtractProviderResult>;
    callReviewProvider?: (config: AiPlanExtractProviderConfig, input: AiPlanExtractInput) => Promise<AiPlanExtractProviderResult>;
  } = {}
): Promise<AiPlanExtractProviderResult> {
  const env = options.env ?? process.env;
  assertFreeCloudPlanPrimaryProvider(env);

  const providers = getConfiguredAiPlanExtractProviders(env).filter((provider) => provider.supports.includes(input.mimeType));
  if (providers.length === 0) throw new AiProviderUnavailableError();

  const errors: Array<{ provider: string; message: string }> = [];
  const providerAttempts: AiPlanExtractProviderAttempt[] = [];
  const callProvider = options.callProvider ?? callPlanExtractProvider;
  const callReviewProvider = options.callReviewProvider ?? callProvider;
  for (const provider of providers) {
    let attempt = 1;
    while (attempt <= 2) {
      const startedAt = Date.now();
      try {
        const primary = await callProvider(provider, input);
        providerAttempts.push({
          provider: provider.id,
          attempt,
          outcome: "success",
          durationMs: Date.now() - startedAt,
        });
        const extraction = await attachPlanReview(primary, input, env, callReviewProvider);
        return mergeProviderAttempts(extraction, providerAttempts);
      } catch (error) {
        const retryReason = attempt === 1 ? getFreeImageProviderRetryReason(provider, input, error, env) : undefined;
        providerAttempts.push({
          provider: provider.id,
          attempt,
          outcome: "failed",
          durationMs: Date.now() - startedAt,
          status: getProviderHttpStatus(error),
          retryReason,
        });
        if (retryReason) {
          attempt += 1;
          continue;
        }

        errors.push({ provider: provider.id, message: error instanceof Error ? error.message : "Erro desconhecido." });
        break;
      }
    }
  }

  throw new AiProviderChainError(errors, providerAttempts);
}
