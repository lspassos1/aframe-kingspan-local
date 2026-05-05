import { describe, expect, it } from "vitest";
import { AiProviderChainError, AiProviderUnavailableError } from "@/lib/ai/errors";
import { extractPlanWithProviderChain, getAiPlanExtractProviderConfigs, getConfiguredAiPlanExtractProviders } from "@/lib/ai/providers";
import { parsePlanExtractResult } from "@/lib/ai/plan-extract-schema";

const validPlanExtractJson = JSON.stringify({
  version: "1.0",
  summary: "Planta preliminar com sala e dois quartos.",
  confidence: "medium",
  extracted: {
    city: "Curitiba",
    state: "PR",
    houseWidthM: 8,
    houseDepthM: 12,
    floors: 1,
    notes: ["Cotas parciais"],
  },
  fieldConfidence: {
    city: "high",
    houseWidthM: "medium",
  },
  assumptions: [],
  missingInformation: ["Pe-direito nao visivel"],
  warnings: ["Resultado preliminar"],
});

describe("AI plan extraction providers", () => {
  it("returns no configured providers when keys are absent", () => {
    const providers = getConfiguredAiPlanExtractProviders({
      AI_PLAN_EXTRACT_PROVIDER_ORDER: "openai,openrouter,groq,generic",
    });

    expect(providers).toHaveLength(0);
  });

  it("keeps configured providers in requested order", () => {
    const providers = getAiPlanExtractProviderConfigs({
      AI_PLAN_EXTRACT_PROVIDER_ORDER: "openrouter,openai,generic",
      OPENROUTER_API_KEY: "openrouter-key",
      AI_OPENROUTER_MODEL: "google/gemini-2.5-flash",
      OPENAI_API_KEY: "openai-key",
      AI_OPENAI_MODEL: "gpt-4o-mini",
      LLM_API_URL: "https://llm.example.com/v1/chat/completions",
      LLM_API_KEY: "generic-key",
      LLM_MODEL: "local-model",
    });

    expect(providers.map((provider) => provider.id)).toEqual(["openrouter", "openai", "generic"]);
    expect(providers.every((provider) => provider.configured)).toBe(true);
  });

  it("falls back to default provider order when env order has no supported provider names", () => {
    const providers = getAiPlanExtractProviderConfigs({
      AI_PLAN_EXTRACT_PROVIDER_ORDER: "unknown, also-unknown",
      OPENAI_API_KEY: "openai-key",
    });

    expect(providers.map((provider) => provider.id)).toEqual(["openai", "openrouter", "groq", "generic"]);
  });

  it("parses JSON wrapped in a code fence", () => {
    const result = parsePlanExtractResult(`\`\`\`json\n${validPlanExtractJson}\n\`\`\``);

    expect(result.version).toBe("1.0");
    expect(result.extracted.city).toBe("Curitiba");
    expect(result.fieldConfidence.houseWidthM).toBe("medium");
  });

  it("does not route image files to Groq when the configured model is text-only", () => {
    const providers = getConfiguredAiPlanExtractProviders({
      AI_PLAN_EXTRACT_PROVIDER_ORDER: "groq",
      GROQ_API_KEY: "groq-key",
      AI_GROQ_MODEL: "llama-3.1-8b-instant",
    });

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      id: "groq",
      supports: [],
    });
  });

  it("keeps Groq image fallback disabled unless visual input is explicitly enabled", () => {
    const providers = getConfiguredAiPlanExtractProviders({
      AI_PLAN_EXTRACT_PROVIDER_ORDER: "groq",
      GROQ_API_KEY: "groq-key",
      AI_GROQ_MODEL: "llama-3.2-11b-vision-preview",
    });

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      id: "groq",
      supports: [],
    });
  });

  it("allows Groq image fallback when visual input is explicitly enabled", () => {
    const providers = getConfiguredAiPlanExtractProviders({
      AI_PLAN_EXTRACT_PROVIDER_ORDER: "groq",
      GROQ_API_KEY: "groq-key",
      AI_GROQ_MODEL: "llama-3.2-11b-vision-preview",
      AI_GROQ_VISION_ENABLED: "true",
    });

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      id: "groq",
      supports: ["image/png", "image/jpeg", "image/webp"],
    });
  });

  it("throws an unavailable error when no configured provider supports the file", async () => {
    await expect(
      extractPlanWithProviderChain(
        {
          mimeType: "application/pdf",
          fileBase64: "abc",
        },
        { env: { AI_PLAN_EXTRACT_PROVIDER_ORDER: "groq", GROQ_API_KEY: "groq-key", AI_GROQ_MODEL: "llama-3.1-8b-instant" } }
      )
    ).rejects.toBeInstanceOf(AiProviderUnavailableError);
  });

  it("falls through provider failures and returns the next successful result", async () => {
    const result = await extractPlanWithProviderChain(
      {
        mimeType: "image/png",
        fileBase64: "abc",
      },
      {
        env: {
          AI_PLAN_EXTRACT_PROVIDER_ORDER: "openai,openrouter",
          OPENAI_API_KEY: "openai-key",
          AI_OPENAI_MODEL: "gpt-4o-mini",
          OPENROUTER_API_KEY: "openrouter-key",
          AI_OPENROUTER_MODEL: "google/gemini-2.5-flash",
        },
        async callProvider(provider) {
          if (provider.id === "openai") throw new Error("timeout");
          return {
            result: parsePlanExtractResult(validPlanExtractJson),
            provider: provider.id,
            model: provider.model,
          };
        },
      }
    );

    expect(result.provider).toBe("openrouter");
    expect(result.result.summary).toContain("Planta preliminar");
  });

  it("throws a chain error after all configured providers fail", async () => {
    await expect(
      extractPlanWithProviderChain(
        {
          mimeType: "image/png",
          fileBase64: "abc",
        },
        {
          env: {
            AI_PLAN_EXTRACT_PROVIDER_ORDER: "openai,openrouter",
            OPENAI_API_KEY: "openai-key",
            OPENROUTER_API_KEY: "openrouter-key",
          },
          async callProvider(provider) {
            throw new Error(`${provider.id} failed`);
          },
        }
      )
    ).rejects.toBeInstanceOf(AiProviderChainError);
  });
});
