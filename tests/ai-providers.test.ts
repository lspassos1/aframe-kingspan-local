import { describe, expect, it } from "vitest";
import { AiProviderChainError, AiProviderUnavailableError } from "@/lib/ai/errors";
import {
  extractPlanWithProviderChain,
  getAiPlanExtractProviderConfigs,
  getAiPlanExtractProviderOrder,
  getConfiguredAiPlanExtractProviders,
} from "@/lib/ai/providers";
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
    const providers = getConfiguredAiPlanExtractProviders({});

    expect(providers).toHaveLength(0);
  });

  it("keeps OpenAI as the only official provider even when other providers are configured", () => {
    const providers = getAiPlanExtractProviderConfigs({
      AI_MODE: "paid",
      OPENROUTER_API_KEY: "openrouter-key",
      OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.5-flash:free",
      GROQ_API_KEY: "groq-key",
      GROQ_TEXT_MODEL: "llama-3.1-8b-instant",
      OPENAI_API_KEY: "openai-key",
      AI_OPENAI_MODEL: "gpt-4o-mini",
    });

    expect(providers.map((provider) => provider.id)).toEqual(["openai"]);
    expect(providers.every((provider) => provider.configured)).toBe(true);
  });

  it("uses OpenAI when paid mode is explicit", () => {
    const providers = getAiPlanExtractProviderConfigs({
      AI_MODE: "paid",
      AI_PLAN_PRIMARY_PROVIDER: "unknown",
      OPENAI_API_KEY: "openai-key",
    });

    expect(providers.map((provider) => provider.id)).toEqual(["openai"]);
    expect(providers[0]?.configured).toBe(false);
  });

  it("requires an explicit OpenAI model before paid extraction is configured", () => {
    expect(
      getConfiguredAiPlanExtractProviders({
        AI_MODE: "paid",
        OPENAI_API_KEY: "openai-key",
      })
    ).toHaveLength(0);
    expect(
      getConfiguredAiPlanExtractProviders({
        AI_MODE: "paid",
        OPENAI_API_KEY: "openai-key",
        AI_OPENAI_MODEL: "gpt-4o-mini",
      }).map((provider) => provider.id)
    ).toEqual(["openai"]);
  });

  it("uses OpenAI as the paid/default extraction order without provider-order envs", () => {
    expect(getAiPlanExtractProviderOrder({ AI_MODE: "paid", AI_PLAN_PRIMARY_PROVIDER: "openrouter" })).toEqual(["openai"]);
    expect(getAiPlanExtractProviderOrder({ AI_MODE: "paid", AI_PLAN_REVIEW_PROVIDER: "openrouter" })).toEqual(["openai"]);
  });

  it("keeps the premium OpenAI model reserved instead of selecting it automatically", () => {
    const [provider] = getAiPlanExtractProviderConfigs({
      AI_MODE: "paid",
      OPENAI_API_KEY: "openai-key",
      AI_OPENAI_MODEL: "gpt-4o-mini",
      AI_OPENAI_MODEL_PREMIUM: "gpt-5.4-mini",
    });

    expect(provider).toMatchObject({
      id: "openai",
      model: "gpt-4o-mini",
      configured: true,
    });
  });

  it("parses JSON wrapped in a code fence", () => {
    const result = parsePlanExtractResult(`\`\`\`json\n${validPlanExtractJson}\n\`\`\``);

    expect(result.version).toBe("1.0");
    expect(result.extracted.city).toBe("Curitiba");
    expect(result.fieldConfidence.houseWidthM).toBe("medium");
  });

  it("does not configure Groq even when Groq env vars are present", () => {
    const providers = getConfiguredAiPlanExtractProviders({
      GROQ_API_KEY: "groq-key",
      GROQ_TEXT_MODEL: "llama-3.1-8b-instant",
    });

    expect(providers).toHaveLength(0);
  });

  it("keeps Groq text-only and unavailable for visual plan extraction", () => {
    const providers = getConfiguredAiPlanExtractProviders({
      AI_MODE: "free-cloud",
      AI_PLAN_PRIMARY_PROVIDER: "groq",
      GROQ_API_KEY: "groq-key",
      GROQ_TEXT_MODEL: "llama-3.1-8b-instant",
    });

    expect(providers).toHaveLength(0);
  });

  it("allows OpenRouter Free as an image-only fallback provider in free-cloud mode", () => {
    const providers = getConfiguredAiPlanExtractProviders({
      AI_MODE: "free-cloud",
      OPENROUTER_API_KEY: "openrouter-key",
      OPENROUTER_PLAN_REVIEW_MODEL: "openrouter/free",
    });

    expect(providers.map((provider) => provider.id)).toEqual(["openrouter"]);
    expect(providers[0]?.supports).toEqual(["image/png", "image/jpeg", "image/webp"]);
  });

  it("throws an unavailable error when OpenAI is not configured", async () => {
    await expect(
      extractPlanWithProviderChain(
        {
          mimeType: "application/pdf",
          fileBase64: "abc",
        },
        { env: { AI_MODE: "paid", GROQ_API_KEY: "groq-key", GROQ_TEXT_MODEL: "llama-3.1-8b-instant" } }
      )
    ).rejects.toBeInstanceOf(AiProviderUnavailableError);
  });

  it("throws a chain error when the configured OpenAI provider fails", async () => {
    await expect(
      extractPlanWithProviderChain(
        {
          mimeType: "image/png",
          fileBase64: "abc",
        },
        {
          env: {
            AI_MODE: "paid",
            OPENAI_API_KEY: "openai-key",
            AI_OPENAI_MODEL: "gpt-4o-mini",
            OPENROUTER_API_KEY: "openrouter-key",
          },
          async callProvider(provider) {
            throw new Error(`${provider.id} failed`);
          },
        }
      )
    ).rejects.toBeInstanceOf(AiProviderChainError);
  });

  it("does not call OpenAI when free-cloud mode is active", async () => {
    const calledProviders: string[] = [];
    await expect(
      extractPlanWithProviderChain(
        {
          mimeType: "image/png",
          fileBase64: "abc",
        },
        {
          env: {
            AI_MODE: "free-cloud",
            AI_PLAN_PRIMARY_PROVIDER: "gemini",
            GEMINI_API_KEY: "gemini-key",
            GEMINI_MODEL: "gemini-2.5-flash",
            OPENAI_API_KEY: "openai-key",
            AI_OPENAI_MODEL: "gpt-4o-mini",
          },
          async callProvider(provider) {
            calledProviders.push(provider.id);
            return {
              result: parsePlanExtractResult(validPlanExtractJson),
              provider: provider.id,
              model: provider.model,
            };
          },
        }
      )
    ).resolves.toMatchObject({ provider: "gemini" });

    expect(calledProviders).toEqual(["gemini"]);
  });

  it("falls back to OpenRouter Free for image extraction when Gemini fails", async () => {
    const calledProviders: string[] = [];

    await expect(
      extractPlanWithProviderChain(
        {
          mimeType: "image/png",
          fileBase64: "abc",
        },
        {
          env: {
            AI_MODE: "free-cloud",
            AI_PLAN_PRIMARY_PROVIDER: "gemini",
            AI_PLAN_REVIEW_PROVIDER: "openrouter",
            GEMINI_API_KEY: "gemini-key",
            GEMINI_MODEL: "gemini-2.5-flash",
            OPENROUTER_API_KEY: "openrouter-key",
            OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.5-flash:free",
            OPENAI_API_KEY: "openai-key",
            AI_OPENAI_MODEL: "gpt-4o-mini",
          },
          async callProvider(provider) {
            calledProviders.push(provider.id);
            if (provider.id === "gemini") throw new Error("Provider gemini respondeu 429.");
            return {
              result: parsePlanExtractResult(validPlanExtractJson),
              provider: provider.id,
              model: provider.model,
            };
          },
        }
      )
    ).resolves.toMatchObject({
      provider: "openrouter",
      review: {
        status: "skipped",
      },
    });

    expect(calledProviders).toEqual(["gemini", "openrouter"]);
  });

  it("retries Gemini once for transient free image provider failures", async () => {
    const calledProviders: string[] = [];

    const result = await extractPlanWithProviderChain(
      {
        mimeType: "image/png",
        fileBase64: "abc",
      },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_PRIMARY_PROVIDER: "gemini",
          GEMINI_API_KEY: "gemini-key",
          GEMINI_MODEL: "gemini-2.5-flash",
        },
        async callProvider(provider) {
          calledProviders.push(provider.id);
          if (calledProviders.length === 1) throw new Error("Provider gemini respondeu 503.");
          return {
            result: parsePlanExtractResult(validPlanExtractJson),
            provider: provider.id,
            model: provider.model,
          };
        },
      }
    );

    expect(result).toMatchObject({
      provider: "gemini",
      diagnostics: {
        providerAttempts: [
          {
            provider: "gemini",
            attempt: 1,
            outcome: "failed",
            status: 503,
            retryReason: "transient-error",
          },
          {
            provider: "gemini",
            attempt: 2,
            outcome: "success",
          },
        ],
      },
    });
    expect(calledProviders).toEqual(["gemini", "gemini"]);
  });

  it("does not retry OpenRouter 429 responses in the free image fallback", async () => {
    const calledProviders: string[] = [];

    await expect(
      extractPlanWithProviderChain(
        {
          mimeType: "image/png",
          fileBase64: "abc",
        },
        {
          env: {
            AI_MODE: "free-cloud",
            AI_PLAN_PRIMARY_PROVIDER: "gemini",
            AI_PLAN_REVIEW_PROVIDER: "openrouter",
            GEMINI_API_KEY: "gemini-key",
            GEMINI_MODEL: "gemini-2.5-flash",
            OPENROUTER_API_KEY: "openrouter-key",
            OPENROUTER_PLAN_REVIEW_MODEL: "openrouter/free",
          },
          async callProvider(provider) {
            calledProviders.push(provider.id);
            if (provider.id === "openrouter") throw new Error("Provider openrouter respondeu 429.");
            throw new Error("Provider gemini respondeu 400.");
          },
        }
      )
    ).rejects.toMatchObject({
      providerAttempts: [
        {
          provider: "gemini",
          attempt: 1,
          outcome: "failed",
          status: 400,
        },
        {
          provider: "openrouter",
          attempt: 1,
          outcome: "failed",
          status: 429,
        },
      ],
    });

    expect(calledProviders).toEqual(["gemini", "openrouter"]);
  });

  it("does not use OpenRouter fallback for PDF extraction in free-cloud mode", async () => {
    const calledProviders: string[] = [];

    await expect(
      extractPlanWithProviderChain(
        {
          mimeType: "application/pdf",
          fileBase64: "abc",
        },
        {
          env: {
            AI_MODE: "free-cloud",
            AI_PLAN_PRIMARY_PROVIDER: "gemini",
            AI_PLAN_REVIEW_PROVIDER: "openrouter",
            GEMINI_API_KEY: "gemini-key",
            GEMINI_MODEL: "gemini-2.5-flash",
            OPENROUTER_API_KEY: "openrouter-key",
            OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.5-flash:free",
          },
          async callProvider(provider) {
            calledProviders.push(provider.id);
            throw new Error(`${provider.id} failed`);
          },
        }
      )
    ).rejects.toBeInstanceOf(AiProviderChainError);

    expect(calledProviders).toEqual(["gemini"]);
  });

  it("does not use paid OpenRouter models as free-cloud fallback providers", async () => {
    const calledProviders: string[] = [];

    await expect(
      extractPlanWithProviderChain(
        {
          mimeType: "image/png",
          fileBase64: "abc",
        },
        {
          env: {
            AI_MODE: "free-cloud",
            AI_PLAN_PRIMARY_PROVIDER: "gemini",
            AI_PLAN_REVIEW_PROVIDER: "openrouter",
            GEMINI_API_KEY: "gemini-key",
            GEMINI_MODEL: "gemini-2.5-flash",
            OPENROUTER_API_KEY: "openrouter-key",
            OPENROUTER_PLAN_REVIEW_MODEL: "openai/gpt-4o-mini",
          },
          async callProvider(provider) {
            calledProviders.push(provider.id);
            throw new Error(`${provider.id} failed`);
          },
        }
      )
    ).rejects.toBeInstanceOf(AiProviderChainError);

    expect(calledProviders).toEqual(["gemini"]);
  });

  it("uses OpenAI and not free providers when paid mode is explicit", async () => {
    const calledProviders: string[] = [];
    await expect(
      extractPlanWithProviderChain(
        {
          mimeType: "image/png",
          fileBase64: "abc",
        },
        {
          env: {
            AI_MODE: "paid",
            OPENAI_API_KEY: "openai-key",
            AI_OPENAI_MODEL: "gpt-4o-mini",
            GEMINI_API_KEY: "gemini-key",
            GEMINI_MODEL: "gemini-2.5-flash",
          },
          async callProvider(provider) {
            calledProviders.push(provider.id);
            return {
              result: parsePlanExtractResult(validPlanExtractJson),
              provider: provider.id,
              model: provider.model,
            };
          },
        }
      )
    ).resolves.toMatchObject({ provider: "openai" });

    expect(calledProviders).toEqual(["openai"]);
  });

  it("keeps PDF extraction on OpenAI when paid mode is explicit", async () => {
    const calledProviders: string[] = [];

    await expect(
      extractPlanWithProviderChain(
        {
          mimeType: "application/pdf",
          fileBase64: "abc",
        },
        {
          env: {
            AI_MODE: "paid",
            OPENAI_API_KEY: "openai-key",
            AI_OPENAI_MODEL: "gpt-4o-mini",
            GEMINI_API_KEY: "gemini-key",
            GEMINI_MODEL: "gemini-2.5-flash",
            OPENROUTER_API_KEY: "openrouter-key",
            OPENROUTER_PLAN_REVIEW_MODEL: "openrouter/free",
          },
          async callProvider(provider) {
            calledProviders.push(provider.id);
            return {
              result: parsePlanExtractResult(validPlanExtractJson),
              provider: provider.id,
              model: provider.model,
            };
          },
        }
      )
    ).resolves.toMatchObject({ provider: "openai" });

    expect(calledProviders).toEqual(["openai"]);
  });
});
