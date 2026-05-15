import {
  getAiTaskProviderId,
  listAiCloudProviders,
  type AiCloudProviderId,
  type AiRouterEnv,
} from "@/lib/ai/free-cloud-router";
import { resolveAiMode } from "@/lib/ai/mode";
import type { PlanImportProviderUiStatus } from "@/lib/ai/plan-import-ui";

function isProviderConfigured(providerId: AiCloudProviderId, env: AiRouterEnv) {
  return listAiCloudProviders(env).find((provider) => provider.id === providerId)?.isEnabled ?? false;
}

export function getSafePlanImportProviderUiStatus(env: AiRouterEnv = process.env): PlanImportProviderUiStatus {
  const aiMode = resolveAiMode(env);
  if (aiMode.mode === "paid") {
    return {
      mode: "paid",
      modeLabel: aiMode.publicModeLabel,
      primaryProviderLabel: aiMode.publicPrimaryLabel,
      reviewProviderLabel: aiMode.publicReviewLabel,
      paidFallbackEnabled: aiMode.paidFallbackEnabled,
      primaryConfigured: aiMode.primaryConfigured && aiMode.primaryModelConfigured,
      reviewConfigured: false,
    };
  }

  const primaryProvider = getAiTaskProviderId("plan-primary", env);
  const reviewProvider = getAiTaskProviderId("plan-review", env);

  return {
    mode: "free-cloud",
    modeLabel: aiMode.publicModeLabel,
    primaryProviderLabel: aiMode.publicPrimaryLabel,
    reviewProviderLabel: aiMode.publicReviewLabel,
    textProviderLabel: "Resumo de pendências",
    textFallbackProviderLabel: "Resumo alternativo",
    paidFallbackEnabled: aiMode.paidFallbackEnabled,
    primaryConfigured: isProviderConfigured(primaryProvider, env) && aiMode.primaryModelConfigured,
    reviewConfigured: isProviderConfigured(reviewProvider, env),
  };
}
