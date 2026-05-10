export type AiMode = "free-cloud" | "paid";

export type AiTask = "plan-primary" | "plan-review" | "text-summary" | "text-fallback" | "paid-fallback";

export type AiCloudProviderId = "gemini" | "openrouter" | "groq" | "cerebras" | "sambanova" | "openai";

export type AiRouterEnv = Record<string, string | undefined>;

export type AiProviderCapability = "vision" | "pdf" | "jsonSchema";

export type AiProviderCapabilities = {
  supportsVision: boolean;
  supportsPdf: boolean;
  supportsJsonSchema: boolean;
  isPaid: boolean;
  isFreeTier: boolean;
};

export type AiProviderDescriptor = AiProviderCapabilities & {
  id: AiCloudProviderId;
  label: string;
  keyEnv: string;
  modelEnv?: string;
  isEnabled: boolean;
};

export type ResolvedAiTaskProvider = AiProviderDescriptor & {
  task: AiTask;
  mode: AiMode;
};

export class AiRouterError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "AiRouterError";
  }
}

const providerRegistry = {
  gemini: {
    id: "gemini",
    label: "Gemini Free",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    supportsVision: true,
    supportsPdf: true,
    supportsJsonSchema: true,
    isPaid: false,
    isFreeTier: true,
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter Free",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_PLAN_REVIEW_MODEL",
    supportsVision: true,
    supportsPdf: false,
    supportsJsonSchema: true,
    isPaid: false,
    isFreeTier: true,
  },
  groq: {
    id: "groq",
    label: "Groq Free",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_TEXT_MODEL",
    supportsVision: false,
    supportsPdf: false,
    supportsJsonSchema: true,
    isPaid: false,
    isFreeTier: true,
  },
  cerebras: {
    id: "cerebras",
    label: "Cerebras Free",
    keyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_TEXT_MODEL",
    supportsVision: false,
    supportsPdf: false,
    supportsJsonSchema: true,
    isPaid: false,
    isFreeTier: true,
  },
  sambanova: {
    id: "sambanova",
    label: "SambaNova Free",
    keyEnv: "SAMBANOVA_API_KEY",
    modelEnv: "SAMBANOVA_TEXT_MODEL",
    supportsVision: false,
    supportsPdf: false,
    supportsJsonSchema: true,
    isPaid: false,
    isFreeTier: true,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    keyEnv: "OPENAI_API_KEY",
    modelEnv: "AI_OPENAI_MODEL",
    supportsVision: true,
    supportsPdf: true,
    supportsJsonSchema: true,
    isPaid: true,
    isFreeTier: false,
  },
} satisfies Record<AiCloudProviderId, Omit<AiProviderDescriptor, "isEnabled">>;

const taskProviderEnv: Record<AiTask, string> = {
  "plan-primary": "AI_PLAN_PRIMARY_PROVIDER",
  "plan-review": "AI_PLAN_REVIEW_PROVIDER",
  "text-summary": "AI_TEXT_PROVIDER",
  "text-fallback": "AI_TEXT_FALLBACK_PROVIDER",
  "paid-fallback": "AI_PAID_FALLBACK_PROVIDER",
};

const taskDefaultProvider: Record<AiTask, AiCloudProviderId> = {
  "plan-primary": "gemini",
  "plan-review": "openrouter",
  "text-summary": "groq",
  "text-fallback": "cerebras",
  "paid-fallback": "openai",
};

const taskRequiredCapabilities: Record<AiTask, AiProviderCapability[]> = {
  "plan-primary": ["vision", "pdf", "jsonSchema"],
  "plan-review": ["vision", "jsonSchema"],
  "text-summary": ["jsonSchema"],
  "text-fallback": ["jsonSchema"],
  "paid-fallback": ["jsonSchema"],
};

function readAiMode(env: AiRouterEnv): AiMode {
  return env.AI_MODE === "paid" ? "paid" : "free-cloud";
}

function readBooleanEnv(env: AiRouterEnv, key: string) {
  return env[key]?.toLowerCase() === "true";
}

function normalizeProviderId(value: string | undefined): AiCloudProviderId | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (Object.prototype.hasOwnProperty.call(providerRegistry, normalized)) return normalized as AiCloudProviderId;
  return undefined;
}

function createDescriptor(providerId: AiCloudProviderId, env: AiRouterEnv): AiProviderDescriptor {
  const provider = providerRegistry[providerId];
  return {
    ...provider,
    isEnabled: Boolean(env[provider.keyEnv]?.trim()),
  };
}

function readProviderModel(provider: AiProviderDescriptor, env: AiRouterEnv) {
  return provider.modelEnv ? env[provider.modelEnv]?.trim() : undefined;
}

function assertFreeCloudModel(provider: AiProviderDescriptor, env: AiRouterEnv, mode: AiMode) {
  if (mode !== "free-cloud" || provider.id !== "openrouter") return;

  const model = readProviderModel(provider, env);
  if (!model) {
    throw new AiRouterError(`Modelo gratuito de ${provider.id} nao esta configurado no servidor.`, "ai-provider-model-not-configured");
  }

  if (!model.toLowerCase().endsWith(":free")) {
    throw new AiRouterError(`Modelo pago ${model} bloqueado no modo free-cloud para ${provider.id}.`, "ai-paid-model-blocked");
  }
}

function assertCapabilities(task: AiTask, provider: AiProviderDescriptor, requiredCapabilities = taskRequiredCapabilities[task]) {
  const missing = requiredCapabilities.filter((capability) => {
    if (capability === "vision") return !provider.supportsVision;
    if (capability === "pdf") return !provider.supportsPdf;
    if (capability === "jsonSchema") return !provider.supportsJsonSchema;
    return false;
  });

  if (missing.length > 0) {
    throw new AiRouterError(
      `Provider ${provider.id} nao suporta ${missing.join(", ")} para a tarefa ${task}.`,
      "ai-provider-capability-mismatch"
    );
  }
}

export function listAiCloudProviders(env: AiRouterEnv = process.env): AiProviderDescriptor[] {
  return Object.keys(providerRegistry).map((providerId) => createDescriptor(providerId as AiCloudProviderId, env));
}

export function getAiTaskProviderId(task: AiTask, env: AiRouterEnv = process.env): AiCloudProviderId {
  const requested = normalizeProviderId(env[taskProviderEnv[task]]);
  if (requested) return requested;
  return taskDefaultProvider[task];
}

export function resolveAiTaskProvider(
  task: AiTask,
  options: {
    env?: AiRouterEnv;
    requiredCapabilities?: AiProviderCapability[];
  } = {}
): ResolvedAiTaskProvider {
  const env = options.env ?? process.env;
  const mode = readAiMode(env);
  const provider = createDescriptor(getAiTaskProviderId(task, env), env);

  if (task === "paid-fallback" && !readBooleanEnv(env, "AI_PAID_FALLBACK_ENABLED")) {
    throw new AiRouterError("Fallback pago esta desabilitado.", "ai-paid-fallback-disabled");
  }

  if (mode === "free-cloud" && provider.isPaid) {
    throw new AiRouterError(`Provider pago ${provider.id} bloqueado no modo free-cloud.`, "ai-paid-provider-blocked");
  }

  assertFreeCloudModel(provider, env, mode);
  assertCapabilities(task, provider, options.requiredCapabilities);

  if (!provider.isEnabled) {
    throw new AiRouterError(`Provider ${provider.id} nao esta configurado no servidor.`, "ai-provider-not-configured");
  }

  return {
    ...provider,
    task,
    mode,
  };
}
