export type AiProductMode = "free-cloud" | "paid";

export type AiModeEnv = Record<string, string | undefined>;

export const freeCloudAiEnvAllowList = [
  "AI_MODE",
  "AI_PAID_FALLBACK_ENABLED",
  "AI_PLAN_EXTRACT_ENABLED",
  "AI_PLAN_EXTRACT_MAX_FILE_MB",
  "AI_PLAN_PRIMARY_PROVIDER",
  "AI_PLAN_REVIEW_PROVIDER",
  "AI_TEXT_PROVIDER",
  "AI_TEXT_FALLBACK_PROVIDER",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_FREE_TIER_NOTICE",
  "OPENROUTER_API_KEY",
  "OPENROUTER_PLAN_REVIEW_MODEL",
  "GROQ_API_KEY",
  "GROQ_TEXT_MODEL",
  "CEREBRAS_API_KEY",
  "CEREBRAS_TEXT_MODEL",
  "SAMBANOVA_API_KEY",
  "SAMBANOVA_TEXT_MODEL",
] as const;

export const paidAiEnvAllowList = ["OPENAI_API_KEY", "AI_OPENAI_MODEL", "AI_OPENAI_MODEL_PREMIUM"] as const;

export type AiModeStatus = {
  mode: AiProductMode;
  productLabel: "Free" | "Pro";
  publicModeLabel: "Modo gratuito" | "Modo Pro";
  publicPrimaryLabel: "Analise rapida" | "Revisao detalhada";
  publicReviewLabel: "Revisao detalhada" | "Validacao Pro";
  canUseOpenAi: boolean;
  canUsePremiumModel: false;
  paidFallbackEnabled: false;
  allowedEnvVars: readonly string[];
  primaryConfigured: boolean;
  primaryModelConfigured: boolean;
  premiumModelConfigured: boolean;
};

function hasEnv(env: AiModeEnv, key: string) {
  return Boolean(env[key]?.trim());
}

export function readAiProductMode(env: AiModeEnv = process.env): AiProductMode {
  return env.AI_MODE === "paid" ? "paid" : "free-cloud";
}

export function resolveAiMode(env: AiModeEnv = process.env): AiModeStatus {
  const mode = readAiProductMode(env);

  if (mode === "paid") {
    return {
      mode,
      productLabel: "Pro",
      publicModeLabel: "Modo Pro",
      publicPrimaryLabel: "Revisao detalhada",
      publicReviewLabel: "Validacao Pro",
      canUseOpenAi: true,
      canUsePremiumModel: false,
      paidFallbackEnabled: false,
      allowedEnvVars: paidAiEnvAllowList,
      primaryConfigured: hasEnv(env, "OPENAI_API_KEY"),
      primaryModelConfigured: hasEnv(env, "AI_OPENAI_MODEL"),
      premiumModelConfigured: hasEnv(env, "AI_OPENAI_MODEL_PREMIUM"),
    };
  }

  return {
    mode,
    productLabel: "Free",
    publicModeLabel: "Modo gratuito",
    publicPrimaryLabel: "Analise rapida",
    publicReviewLabel: "Revisao detalhada",
    canUseOpenAi: false,
    canUsePremiumModel: false,
    paidFallbackEnabled: false,
    allowedEnvVars: freeCloudAiEnvAllowList,
    primaryConfigured: hasEnv(env, "GEMINI_API_KEY"),
    primaryModelConfigured: hasEnv(env, "GEMINI_MODEL"),
    premiumModelConfigured: hasEnv(env, "AI_OPENAI_MODEL_PREMIUM"),
  };
}

export function isAllowedAiEnvName(name: string) {
  return [...freeCloudAiEnvAllowList, ...paidAiEnvAllowList].includes(name as (typeof freeCloudAiEnvAllowList | typeof paidAiEnvAllowList)[number]);
}
