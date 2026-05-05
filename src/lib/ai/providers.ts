import { planExtractSystemPrompt, planExtractUserPrompt } from "@/lib/ai/prompts";
import { parsePlanExtractResult, type PlanExtractResult } from "@/lib/ai/plan-extract-schema";
import { AiProviderChainError, AiProviderUnavailableError } from "@/lib/ai/errors";

export type AiPlanExtractProviderId = "openai" | "openrouter" | "groq" | "generic";

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
};

const officialProviderOrder: AiPlanExtractProviderId[] = ["openai"];

const providerDefaults: Record<AiPlanExtractProviderId, { modelEnv: string; keyEnv?: string; defaultModel: string; baseUrl?: string; supports: AiPlanExtractMimeType[] }> = {
  openai: {
    modelEnv: "AI_OPENAI_MODEL",
    keyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    supports: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  },
  openrouter: {
    modelEnv: "AI_OPENROUTER_MODEL",
    keyEnv: "OPENROUTER_API_KEY",
    defaultModel: "google/gemini-2.5-flash",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    supports: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  },
  groq: {
    modelEnv: "AI_GROQ_MODEL",
    keyEnv: "GROQ_API_KEY",
    defaultModel: "llama-3.1-8b-instant",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    supports: ["image/png", "image/jpeg", "image/webp"],
  },
  generic: {
    modelEnv: "LLM_MODEL",
    keyEnv: "LLM_API_KEY",
    defaultModel: "",
    supports: ["image/png", "image/jpeg", "image/webp"],
  },
};

function getBooleanEnv(env: AiPlanExtractEnv, key: string, fallback = false) {
  const value = env[key];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

export function getAiPlanExtractProviderOrder(env: AiPlanExtractEnv = process.env) {
  void env;
  // OpenAI is the only official provider for plan extraction in this execution.
  return officialProviderOrder;
}

function getProviderSupportedMimeTypes(id: AiPlanExtractProviderId, env: AiPlanExtractEnv, defaults: (typeof providerDefaults)[AiPlanExtractProviderId]) {
  if (id !== "groq") return defaults.supports;
  return getBooleanEnv(env, "AI_GROQ_VISION_ENABLED", false) ? defaults.supports : [];
}

export function getAiPlanExtractProviderConfigs(env: AiPlanExtractEnv = process.env): AiPlanExtractProviderConfig[] {
  return getAiPlanExtractProviderOrder(env).map((id) => {
    const defaults = providerDefaults[id];
    const model = env[defaults.modelEnv] || defaults.defaultModel;
    const baseUrl = id === "generic" ? env.LLM_API_URL : defaults.baseUrl;
    const apiKey = defaults.keyEnv ? env[defaults.keyEnv] : undefined;
    return {
      id,
      model,
      baseUrl,
      apiKey,
      configured: Boolean(model && baseUrl && apiKey),
      supports: getProviderSupportedMimeTypes(id, env, defaults),
    };
  });
}

export function getConfiguredAiPlanExtractProviders(env: AiPlanExtractEnv = process.env) {
  return getAiPlanExtractProviderConfigs(env).filter((provider) => provider.configured);
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
    { type: "image_url", image_url: { url: dataUrl } },
  ];
}

async function callOpenAiCompatibleProvider(config: AiPlanExtractProviderConfig, input: AiPlanExtractInput): Promise<AiPlanExtractProviderResult> {
  if (!config.baseUrl || !config.apiKey) {
    throw new AiProviderUnavailableError(`Provider ${config.id} nao esta configurado.`);
  }
  if (!config.supports.includes(input.mimeType)) {
    throw new AiProviderUnavailableError(`Provider ${config.id} nao suporta ${input.mimeType}.`);
  }

  const timeout = createAbortSignal(input.timeoutMs ?? 30_000);
  try {
    const response = await fetch(config.baseUrl, {
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

    if (!response.ok) {
      throw new Error(`Provider ${config.id} respondeu ${response.status}.`);
    }

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

export async function extractPlanWithProviderChain(
  input: AiPlanExtractInput,
  options: {
    env?: AiPlanExtractEnv;
    callProvider?: (config: AiPlanExtractProviderConfig, input: AiPlanExtractInput) => Promise<AiPlanExtractProviderResult>;
  } = {}
): Promise<AiPlanExtractProviderResult> {
  const providers = getConfiguredAiPlanExtractProviders(options.env).filter((provider) => provider.supports.includes(input.mimeType));
  if (providers.length === 0) throw new AiProviderUnavailableError();

  const errors: Array<{ provider: string; message: string }> = [];
  const callProvider = options.callProvider ?? callOpenAiCompatibleProvider;
  for (const provider of providers) {
    try {
      return await callProvider(provider, input);
    } catch (error) {
      errors.push({ provider: provider.id, message: error instanceof Error ? error.message : "Erro desconhecido." });
    }
  }

  throw new AiProviderChainError(errors);
}
