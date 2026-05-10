import {
  getAiTaskProviderId,
  listAiCloudProviders,
  type AiCloudProviderId,
  type AiRouterEnv,
} from "@/lib/ai/free-cloud-router";
import type { PlanImportProviderUiStatus } from "@/lib/ai/plan-import-ui";

function getProviderLabel(providerId: AiCloudProviderId, env: AiRouterEnv) {
  return listAiCloudProviders(env).find((provider) => provider.id === providerId)?.label ?? providerId;
}

function isProviderConfigured(providerId: AiCloudProviderId, env: AiRouterEnv) {
  return listAiCloudProviders(env).find((provider) => provider.id === providerId)?.isEnabled ?? false;
}

function readBooleanEnv(env: AiRouterEnv, key: string) {
  return env[key]?.toLowerCase() === "true";
}

export function getSafePlanImportProviderUiStatus(env: AiRouterEnv = process.env): PlanImportProviderUiStatus {
  if (env.AI_MODE !== "free-cloud") {
    return {
      mode: "openai",
      modeLabel: "OpenAI API",
      primaryProviderLabel: "OpenAI",
      paidFallbackEnabled: false,
      primaryConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
      reviewConfigured: false,
    };
  }

  const primaryProvider = getAiTaskProviderId("plan-primary", env);
  const reviewProvider = getAiTaskProviderId("plan-review", env);
  const textProvider = getAiTaskProviderId("text-summary", env);
  const textFallbackProvider = getAiTaskProviderId("text-fallback", env);

  return {
    mode: "free-cloud",
    modeLabel: "Modo gratuito",
    primaryProviderLabel: getProviderLabel(primaryProvider, env),
    reviewProviderLabel: getProviderLabel(reviewProvider, env),
    textProviderLabel: getProviderLabel(textProvider, env),
    textFallbackProviderLabel: getProviderLabel(textFallbackProvider, env),
    paidFallbackEnabled: readBooleanEnv(env, "AI_PAID_FALLBACK_ENABLED"),
    primaryConfigured: isProviderConfigured(primaryProvider, env),
    reviewConfigured: isProviderConfigured(reviewProvider, env),
  };
}
