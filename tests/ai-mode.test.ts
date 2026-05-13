import { describe, expect, it } from "vitest";
import { freeCloudAiEnvAllowList, isAllowedAiEnvName, paidAiEnvAllowList, resolveAiMode } from "@/lib/ai/mode";

const openAiKeyEnv = ["OPENAI", "API", "KEY"].join("_");

describe("AI mode contract", () => {
  it("resolves free mode with only the existing free-cloud env names", () => {
    const status = resolveAiMode({
      AI_MODE: "free-cloud",
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: "gemini-2.5-flash",
      AI_OPENAI_MODEL_PREMIUM: "gpt-5.4-mini",
    });

    expect(status).toMatchObject({
      mode: "free-cloud",
      productLabel: "Free",
      publicModeLabel: "Modo gratuito",
      publicPrimaryLabel: "Análise rápida",
      canUseOpenAi: false,
      canUsePremiumModel: false,
      paidFallbackEnabled: false,
      primaryConfigured: true,
      primaryModelConfigured: true,
      premiumModelConfigured: true,
    });
    expect(status.allowedEnvVars).toEqual(freeCloudAiEnvAllowList);
  });

  it("resolves paid mode with OpenAI standard model and keeps premium reserved", () => {
    const status = resolveAiMode({
      AI_MODE: "paid",
      [openAiKeyEnv]: "openai-key",
      AI_OPENAI_MODEL: "gpt-4o-mini",
      AI_OPENAI_MODEL_PREMIUM: "gpt-5.4-mini",
    });

    expect(status).toMatchObject({
      mode: "paid",
      productLabel: "Pro",
      publicModeLabel: "Modo Pro",
      publicPrimaryLabel: "Revisão detalhada",
      canUseOpenAi: true,
      canUsePremiumModel: false,
      paidFallbackEnabled: false,
      primaryConfigured: true,
      primaryModelConfigured: true,
      premiumModelConfigured: true,
    });
    expect(status.allowedEnvVars).toEqual(paidAiEnvAllowList);
  });

  it("does not allow invented provider or model env names", () => {
    expect(isAllowedAiEnvName(["AI", "OPENAI", "MODEL", "2"].join("_"))).toBe(false);
    expect(isAllowedAiEnvName(["AI", "PROVIDER", "ROUTING"].join("_"))).toBe(false);
    expect(isAllowedAiEnvName(["AI", "PLAN", "EXTRACT", "PROVIDER", "ORDER"].join("_"))).toBe(false);
    expect(isAllowedAiEnvName(["LLM", "API", "KEY"].join("_"))).toBe(false);
    expect(isAllowedAiEnvName(["AI", "GROQ", "MODEL"].join("_"))).toBe(false);
    expect(isAllowedAiEnvName("AI_OPENAI_MODEL_PREMIUM")).toBe(true);
  });
});
