import { describe, expect, it } from "vitest";
import { AiRouterError, getAiTaskProviderId, listAiCloudProviders, resolveAiTaskProvider } from "@/lib/ai/free-cloud-router";

describe("free-cloud AI router", () => {
  it("selects providers deterministically by task env", () => {
    const env = {
      AI_MODE: "free-cloud",
      AI_PLAN_PRIMARY_PROVIDER: "gemini",
      AI_PLAN_REVIEW_PROVIDER: "openrouter",
      AI_TEXT_PROVIDER: "groq",
      AI_TEXT_FALLBACK_PROVIDER: "cerebras",
      GEMINI_API_KEY: "gemini-key",
      OPENROUTER_API_KEY: "openrouter-key",
      OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free",
      GROQ_API_KEY: "groq-key",
      CEREBRAS_API_KEY: "cerebras-key",
    };

    expect(resolveAiTaskProvider("plan-primary", { env })).toMatchObject({
      id: "gemini",
      task: "plan-primary",
      supportsVision: true,
      supportsPdf: true,
      supportsJsonSchema: true,
      isFreeTier: true,
      isPaid: false,
      isEnabled: true,
    });
    expect(resolveAiTaskProvider("plan-review", { env }).id).toBe("openrouter");
    expect(resolveAiTaskProvider("text-summary", { env }).id).toBe("groq");
    expect(resolveAiTaskProvider("text-fallback", { env }).id).toBe("cerebras");
  });

  it("uses the configured model env names from the free-cloud stack", () => {
    expect(listAiCloudProviders()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "gemini", modelEnv: "GEMINI_MODEL" }),
        expect.objectContaining({ id: "openrouter", modelEnv: "OPENROUTER_PLAN_REVIEW_MODEL" }),
        expect.objectContaining({ id: "groq", modelEnv: "GROQ_TEXT_MODEL" }),
        expect.objectContaining({ id: "cerebras", modelEnv: "CEREBRAS_TEXT_MODEL" }),
        expect.objectContaining({ id: "sambanova", modelEnv: "SAMBANOVA_TEXT_MODEL" }),
        expect.objectContaining({ id: "openai", modelEnv: "AI_OPENAI_MODEL" }),
      ])
    );
  });

  it("keeps OpenRouter plan review image-only in this router contract", () => {
    expect(
      resolveAiTaskProvider("plan-review", {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          OPENROUTER_API_KEY: "openrouter-key",
          OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free",
        },
      })
    ).toMatchObject({
      id: "openrouter",
      task: "plan-review",
      supportsVision: true,
      supportsPdf: false,
      supportsJsonSchema: true,
    });
  });

  it("blocks paid OpenRouter models in free-cloud mode", () => {
    expect(() =>
      resolveAiTaskProvider("plan-review", {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          OPENROUTER_API_KEY: "openrouter-key",
          OPENROUTER_PLAN_REVIEW_MODEL: "openai/gpt-4o",
        },
      })
    ).toThrowError(new AiRouterError("Modelo pago openai/gpt-4o bloqueado no modo free-cloud para openrouter.", "ai-paid-model-blocked"));
  });

  it("requires a pinned free OpenRouter model in free-cloud mode", () => {
    expect(() =>
      resolveAiTaskProvider("plan-review", {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          OPENROUTER_API_KEY: "openrouter-key",
        },
      })
    ).toThrowError(new AiRouterError("Modelo gratuito de openrouter nao esta configurado no servidor.", "ai-provider-model-not-configured"));
  });

  it("falls back to task defaults when env provider names are absent or unknown", () => {
    expect(getAiTaskProviderId("plan-primary", {})).toBe("gemini");
    expect(getAiTaskProviderId("plan-review", { AI_PLAN_REVIEW_PROVIDER: "unknown" })).toBe("openrouter");
    expect(getAiTaskProviderId("plan-review", { AI_PLAN_REVIEW_PROVIDER: "constructor" })).toBe("openrouter");
    expect(getAiTaskProviderId("plan-review", { AI_PLAN_REVIEW_PROVIDER: "__proto__" })).toBe("openrouter");
    expect(getAiTaskProviderId("text-summary", {})).toBe("groq");
    expect(getAiTaskProviderId("text-fallback", {})).toBe("cerebras");
  });

  it("blocks paid providers in free-cloud mode before any request can be made", () => {
    expect(() =>
      resolveAiTaskProvider("plan-primary", {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_PRIMARY_PROVIDER: "openai",
          OPENAI_API_KEY: "openai-key",
        },
      })
    ).toThrowError(new AiRouterError("Provider pago openai bloqueado no modo free-cloud.", "ai-paid-provider-blocked"));
  });

  it("blocks OpenAI paid fallback when paid fallback is disabled", () => {
    expect(() =>
      resolveAiTaskProvider("paid-fallback", {
        env: {
          AI_MODE: "paid",
          AI_PAID_FALLBACK_ENABLED: "false",
          OPENAI_API_KEY: "openai-key",
        },
      })
    ).toThrowError(new AiRouterError("Fallback pago esta desabilitado.", "ai-paid-fallback-disabled"));
  });

  it("allows OpenAI selection in explicit paid mode", () => {
    expect(
      resolveAiTaskProvider("paid-fallback", {
        env: {
          AI_MODE: "paid",
          AI_PAID_FALLBACK_ENABLED: "true",
          OPENAI_API_KEY: "openai-key",
          AI_OPENAI_MODEL: "gpt-4o-mini",
        },
      })
    ).toMatchObject({
      id: "openai",
      mode: "paid",
      isPaid: true,
      isFreeTier: false,
      isEnabled: true,
    });
  });

  it("returns a friendly error when selected provider lacks required capability", () => {
    expect(() =>
      resolveAiTaskProvider("plan-primary", {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_PRIMARY_PROVIDER: "groq",
          GROQ_API_KEY: "groq-key",
        },
      })
    ).toThrowError(new AiRouterError("Provider groq nao suporta vision, pdf para a tarefa plan-primary.", "ai-provider-capability-mismatch"));
  });

  it("returns a friendly error when selected provider is not configured server-side", () => {
    expect(() =>
      resolveAiTaskProvider("plan-review", {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free",
        },
      })
    ).toThrowError(new AiRouterError("Provider openrouter nao esta configurado no servidor.", "ai-provider-not-configured"));
  });

  it("exposes explicit capabilities and enabled state for status UI", () => {
    const providers = listAiCloudProviders({
      GEMINI_API_KEY: "gemini-key",
      OPENAI_API_KEY: "openai-key",
    });

    expect(providers.find((provider) => provider.id === "gemini")).toMatchObject({
      supportsVision: true,
      supportsPdf: true,
      supportsJsonSchema: true,
      isFreeTier: true,
      isPaid: false,
      isEnabled: true,
    });
    expect(providers.find((provider) => provider.id === "openai")).toMatchObject({
      isPaid: true,
      isFreeTier: false,
      isEnabled: true,
    });
    expect(providers.find((provider) => provider.id === "groq")).toMatchObject({
      supportsVision: false,
      supportsPdf: false,
      supportsJsonSchema: true,
      isEnabled: false,
    });
  });
});
