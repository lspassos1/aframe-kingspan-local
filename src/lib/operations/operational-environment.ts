import "server-only";

import type { OperationalEnvironmentStatus } from "@/lib/operations/operational-checklist";

function getPositiveNumberEnv(env: Record<string, string | undefined>, key: string, fallback: number) {
  const value = Number(env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function createOperationalEnvironmentStatus(env: Record<string, string | undefined> = process.env): OperationalEnvironmentStatus {
  const perUserLimit = getPositiveNumberEnv(env, "AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER", 3);
  const perIpLimit = getPositiveNumberEnv(env, "AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP", 5);
  const globalLimit = getPositiveNumberEnv(env, "AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT", 50);

  return {
    aiPlanExtractEnabled: env.AI_PLAN_EXTRACT_ENABLED === "true",
    openAiApiKeyConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
    openAiModelConfigured: Boolean(env.AI_OPENAI_MODEL?.trim()),
    providerLabel: "OpenAI",
    dailyLimitLabel: `${perUserLimit}/usuário · ${perIpLimit}/IP · ${globalLimit}/global`,
  };
}
