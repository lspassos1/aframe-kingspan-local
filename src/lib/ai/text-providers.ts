import { AiProviderUnavailableError } from "@/lib/ai/errors";
import { AiRouterError, resolveAiTaskProvider, type AiCloudProviderId, type AiRouterEnv } from "@/lib/ai/free-cloud-router";
import { stripJsonCodeFence, type PlanExtractResult } from "@/lib/ai/plan-extract-schema";
import type { PlanExtractComparisonSummary } from "@/lib/ai/plan-result-merge";

export type AiTextProviderId = Extract<AiCloudProviderId, "groq" | "cerebras" | "sambanova">;

export type AiTextSummaryTask = "text-summary" | "text-fallback";

export type AiTextProviderConfig = {
  id: AiTextProviderId;
  label: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  configured: boolean;
};

export type PlanExtractionTextSummary = {
  status: "completed" | "fallback";
  source: "provider" | "deterministic";
  provider?: AiTextProviderId;
  model?: string;
  tokens?: number;
  text: string;
  detected: string[];
  lowConfidence: string[];
  divergences: string[];
  pendingQuestions: string[];
  nextSteps: string[];
  providerErrors?: Array<{ provider: string; message: string; code?: string }>;
};

export type PlanExtractionTextSummaryInput = {
  result: PlanExtractResult;
  review?: PlanExtractComparisonSummary;
};

type TextProviderDefaults = {
  baseUrl: string;
  defaultModel: string;
};

const textProviderDefaults: Record<AiTextProviderId, TextProviderDefaults> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.1-8b-instant",
  },
  cerebras: {
    baseUrl: "https://api.cerebras.ai/v1/chat/completions",
    defaultModel: "llama3.1-8b",
  },
  sambanova: {
    baseUrl: "https://api.sambanova.ai/v1/chat/completions",
    defaultModel: "Meta-Llama-3.1-8B-Instruct",
  },
};

function isTextProvider(providerId: AiCloudProviderId): providerId is AiTextProviderId {
  return providerId === "groq" || providerId === "cerebras" || providerId === "sambanova";
}

function asStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 12);
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).slice(0, 12);
}

function formatLocation(result: PlanExtractResult) {
  const city = result.extracted.city ?? result.location?.city?.value;
  const state = result.extracted.state ?? result.location?.state?.value;
  return [city, state].filter(Boolean).join(" - ");
}

function formatNumber(value: number | undefined, unit: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit}`;
}

function createAbortSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

export function buildDeterministicPlanExtractionSummary(input: PlanExtractionTextSummaryInput): PlanExtractionTextSummary {
  const { result, review } = input;
  const location = formatLocation(result);
  const dimensions = [formatNumber(result.extracted.houseWidthM, "m"), formatNumber(result.extracted.houseDepthM, "m")].filter(Boolean).join(" x ");
  const openingCount = (result.extracted.doorCount ?? 0) + (result.extracted.windowCount ?? 0);
  const lowConfidenceFields = Object.entries(result.fieldConfidence)
    .filter(([, confidence]) => confidence === "low")
    .map(([field]) => field);
  const warnings = result.extractionWarnings?.map((warning) => warning.message) ?? [];
  const unresolved = review?.unresolved?.map((item) => `${item.field}: ${item.pendingReason ?? "segunda leitura nao confirmou o campo"}`) ?? [];
  const divergences = review?.divergences?.map((item) => `${item.field}: segunda leitura sugeriu ${String(item.reviewValue)}`) ?? [];
  const pendingQuestions = uniqueStrings([
    ...(result.questions?.map((question) => question.question) ?? []),
    ...result.missingInformation,
    ...unresolved,
  ]);
  const detected = uniqueStrings([
    result.extracted.projectName ? `Projeto: ${result.extracted.projectName}` : undefined,
    location ? `Local: ${location}` : undefined,
    result.extracted.builtAreaM2 ? `Area construida: ${formatNumber(result.extracted.builtAreaM2, "m2")}` : undefined,
    dimensions ? `Dimensoes: ${dimensions}` : undefined,
    result.rooms?.length ? `Ambientes detectados: ${result.rooms.length}` : undefined,
    openingCount ? `Aberturas detectadas: ${openingCount}` : undefined,
    result.quantitySeeds?.length ? `Quantitativos preliminares: ${result.quantitySeeds.length}` : undefined,
  ]);
  const lowConfidence = uniqueStrings([
    ...lowConfidenceFields.map((field) => `Revisar ${field}`),
    ...warnings,
    ...result.warnings,
  ]);
  const nextSteps = uniqueStrings([
    pendingQuestions.length ? "Responder pendencias antes de gerar orçamento." : undefined,
    lowConfidence.length ? "Confirmar campos de baixa confianca." : undefined,
    result.quantitySeeds?.length ? "Revisar quantitativos antes de vincular fonte de preco." : "Completar medidas para gerar quantitativos.",
    "Manter revisão humana antes de aplicar dados ao estudo.",
  ]);
  const text = [
    detected.length ? `Detectado: ${detected.join("; ")}.` : "A leitura ainda nao tem dados suficientes para resumo conclusivo.",
    lowConfidence.length ? `Revisar: ${lowConfidence.join("; ")}.` : "Nao ha alertas principais de baixa confianca no resumo deterministico.",
    divergences.length ? `Divergencias: ${divergences.join("; ")}.` : undefined,
    pendingQuestions.length ? `Pendencias: ${pendingQuestions.join("; ")}.` : undefined,
    `Proximos passos: ${nextSteps.join("; ")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    status: "fallback",
    source: "deterministic",
    text,
    detected,
    lowConfidence,
    divergences,
    pendingQuestions,
    nextSteps,
  };
}

export function getAiTextProviderConfig(task: AiTextSummaryTask, env: AiRouterEnv = process.env): AiTextProviderConfig {
  const resolved = resolveAiTaskProvider(task, { env, requiredCapabilities: ["jsonSchema"] });
  if (!isTextProvider(resolved.id)) {
    throw new AiRouterError(`Provider ${resolved.id} nao suporta resumo textual.`, "ai-provider-capability-mismatch");
  }

  const defaults = textProviderDefaults[resolved.id];
  const model = resolved.modelEnv ? env[resolved.modelEnv]?.trim() || defaults.defaultModel : defaults.defaultModel;
  const apiKey = env[resolved.keyEnv]?.trim();
  return {
    id: resolved.id,
    label: resolved.label,
    model,
    baseUrl: defaults.baseUrl,
    apiKey,
    configured: Boolean(model && apiKey),
  };
}

function buildSummaryPrompt(input: PlanExtractionTextSummaryInput) {
  const deterministic = buildDeterministicPlanExtractionSummary(input);
  return [
    "Voce resume uma analise preliminar de planta baixa para revisao humana.",
    "Nao altere dados estruturados. Nao invente medidas, preco, SINAPI, H/H, consumo, perda, BDI ou aprovacao.",
    "Retorne apenas JSON com as chaves: text, detected, lowConfidence, divergences, pendingQuestions, nextSteps.",
    "Use linguagem PT-BR curta e operacional.",
    "",
    "Dados estruturados para resumir:",
    JSON.stringify({
      summary: input.result.summary,
      confidence: input.result.confidence,
      extracted: input.result.extracted,
      fieldConfidence: input.result.fieldConfidence,
      questions: input.result.questions,
      missingInformation: input.result.missingInformation,
      warnings: input.result.warnings,
      extractionWarnings: input.result.extractionWarnings,
      comparison: input.review,
      deterministicFallback: deterministic,
    }),
  ].join("\n");
}

function parseTextSummaryPayload(value: string, fallback: PlanExtractionTextSummary): Omit<PlanExtractionTextSummary, "status" | "source" | "provider" | "model" | "tokens" | "providerErrors"> {
  const parsed = JSON.parse(stripJsonCodeFence(value)) as Record<string, unknown>;
  const text = typeof parsed.text === "string" && parsed.text.trim() ? parsed.text.trim() : fallback.text;
  return {
    text,
    detected: asStringArray(parsed.detected, fallback.detected),
    lowConfidence: asStringArray(parsed.lowConfidence, fallback.lowConfidence),
    divergences: asStringArray(parsed.divergences, fallback.divergences),
    pendingQuestions: asStringArray(parsed.pendingQuestions, fallback.pendingQuestions),
    nextSteps: asStringArray(parsed.nextSteps, fallback.nextSteps),
  };
}

export async function callAiTextSummaryProvider(
  config: AiTextProviderConfig,
  input: PlanExtractionTextSummaryInput,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 20_000
): Promise<PlanExtractionTextSummary> {
  if (!config.configured || !config.apiKey) {
    throw new AiProviderUnavailableError(`Provider ${config.id} nao esta configurado para resumo textual.`);
  }

  const fallback = buildDeterministicPlanExtractionSummary(input);
  const timeout = createAbortSignal(timeoutMs);
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
            content: buildSummaryPrompt(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Provider ${config.id} respondeu ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error(`Provider ${config.id} nao retornou resumo textual.`);

    return {
      status: "completed",
      source: "provider",
      provider: config.id,
      model: config.model,
      tokens: payload.usage?.total_tokens,
      ...parseTextSummaryPayload(content, fallback),
    };
  } finally {
    timeout.clear();
  }
}

function serializeTextProviderError(provider: string, error: unknown) {
  return {
    provider,
    message: error instanceof Error ? error.message : "Erro desconhecido.",
    code: error instanceof AiRouterError ? error.code : error instanceof AiProviderUnavailableError ? error.code : undefined,
  };
}

export async function summarizePlanExtractionForReview(
  input: PlanExtractionTextSummaryInput,
  options: {
    env?: AiRouterEnv;
    callProvider?: (config: AiTextProviderConfig, input: PlanExtractionTextSummaryInput) => Promise<PlanExtractionTextSummary>;
  } = {}
): Promise<PlanExtractionTextSummary> {
  const env = options.env ?? process.env;
  const callProvider = options.callProvider ?? callAiTextSummaryProvider;
  const providerErrors: Array<{ provider: string; message: string; code?: string }> = [];

  for (const task of ["text-summary", "text-fallback"] satisfies AiTextSummaryTask[]) {
    let config: AiTextProviderConfig;
    try {
      config = getAiTextProviderConfig(task, env);
    } catch (error) {
      providerErrors.push(serializeTextProviderError(task, error));
      continue;
    }

    try {
      return await callProvider(config, input);
    } catch (error) {
      providerErrors.push(serializeTextProviderError(config.id, error));
    }
  }

  return {
    ...buildDeterministicPlanExtractionSummary(input),
    providerErrors,
  };
}
