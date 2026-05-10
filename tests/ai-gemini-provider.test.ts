import { describe, expect, it } from "vitest";
import { AiProviderChainError, AiProviderUnavailableError } from "@/lib/ai/errors";
import { AiRouterError } from "@/lib/ai/free-cloud-router";
import {
  callGeminiPlanExtractProvider,
  createGeminiPlanExtractRequest,
  extractPlanWithProviderChain,
  getAiPlanExtractProviderConfigs,
  type AiPlanExtractProviderConfig,
} from "@/lib/ai/providers";

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

const geminiConfig: AiPlanExtractProviderConfig = {
  id: "gemini" as const,
  model: "gemini-2.5-flash",
  configured: true,
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
  apiKey: "gemini-key",
  supports: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
};

describe("Gemini plan extraction provider", () => {
  it("builds a Gemini request with JSON response mode and inline file data", () => {
    const request = createGeminiPlanExtractRequest({
      mimeType: "application/pdf",
      fileBase64: "abc123",
      fileName: "planta.pdf",
    });

    expect(request.generationConfig).toMatchObject({
      temperature: 0,
      response_mime_type: "application/json",
    });
    expect(request.contents[0]?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inline_data: {
            mime_type: "application/pdf",
            data: "abc123",
          },
        }),
      ])
    );
  });

  it("routes plan-primary to Gemini in free-cloud mode", async () => {
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
          return {
            result: JSON.parse(validPlanExtractJson),
            provider: provider.id,
            model: provider.model,
          };
        },
      }
    );

    expect(result).toMatchObject({
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
  });

  it("configures Gemini from the free-cloud router env", () => {
    const providers = getAiPlanExtractProviderConfigs({
      AI_MODE: "free-cloud",
      AI_PLAN_PRIMARY_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: "gemini-2.5-flash",
      OPENAI_API_KEY: "openai-key",
    });

    expect(providers).toEqual([
      expect.objectContaining({
        id: "gemini",
        configured: true,
        model: "gemini-2.5-flash",
        supports: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
      }),
    ]);
  });

  it("rejects missing Gemini server configuration before provider calls", async () => {
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
          },
        }
      )
    ).rejects.toThrow(new AiRouterError("Provider gemini nao esta configurado no servidor.", "ai-provider-not-configured"));
  });

  it("rejects unsupported MIME types before calling Gemini", async () => {
    await expect(
      callGeminiPlanExtractProvider(
        {
          ...geminiConfig,
          supports: ["image/png"],
        },
        {
          mimeType: "application/pdf",
          fileBase64: "abc",
        }
      )
    ).rejects.toThrow(AiProviderUnavailableError);
  });

  it("sends the Gemini key in a server-side header and never in the URL", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: validPlanExtractJson }] } }],
          usageMetadata: { totalTokenCount: 123 },
        }),
        { status: 200 }
      );
    };

    const result = await callGeminiPlanExtractProvider(
      geminiConfig,
      {
        mimeType: "image/png",
        fileBase64: "abc",
      },
      fetchMock
    );

    const call = calls[0];
    expect(call?.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(call?.url).not.toContain("gemini-key");
    expect(call?.url).not.toContain("?key=");
    expect(new Headers(call?.init?.headers).get("x-goog-api-key")).toBe("gemini-key");
    const body = JSON.parse(String(call?.init?.body));
    expect(body.generationConfig).toMatchObject({
      response_mime_type: "application/json",
    });
    expect(body.contents[0]?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inline_data: {
            mime_type: "image/png",
            data: "abc",
          },
        }),
      ])
    );
    expect(result).toMatchObject({
      provider: "gemini",
      model: "gemini-2.5-flash",
      tokens: 123,
      result: {
        providerMeta: {
          provider: "gemini",
          model: "gemini-2.5-flash",
          tokens: 123,
        },
      },
    });
  });

  it("rejects invalid Gemini JSON responses", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "{\"version\":\"1.0\"}" }] } }],
        }),
        { status: 200 }
      );

    await expect(
      callGeminiPlanExtractProvider(
        geminiConfig,
        {
          mimeType: "image/png",
          fileBase64: "abc",
        },
        fetchMock
      )
    ).rejects.toThrow();
  });

  it("rejects empty Gemini candidate responses with a controlled provider error", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: {} }],
        }),
        { status: 200 }
      );

    await expect(
      callGeminiPlanExtractProvider(
        geminiConfig,
        {
          mimeType: "image/png",
          fileBase64: "abc",
        },
        fetchMock
      )
    ).rejects.toThrow("Provider gemini nao retornou conteudo.");
  });

  it("surfaces Gemini rate limit/provider failures as chain errors", async () => {
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
          },
          async callProvider(provider) {
            throw new Error(`Provider ${provider.id} respondeu 429.`);
          },
        }
      )
    ).rejects.toBeInstanceOf(AiProviderChainError);
  });
});
