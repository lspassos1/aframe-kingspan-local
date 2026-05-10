import { describe, expect, it } from "vitest";
import { callAiTextSummaryProvider, getAiTextProviderConfig, type AiTextProviderConfig } from "@/lib/ai/text-providers";
import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";

const planResult: PlanExtractResult = {
  version: "1.0",
  summary: "Planta residencial com area e ambientes preliminares.",
  confidence: "medium",
  extracted: {
    city: "Curitiba",
    state: "PR",
    builtAreaM2: 92,
    houseWidthM: 8,
    houseDepthM: 11.5,
    doorCount: 5,
    windowCount: 6,
    notes: [],
  },
  fieldConfidence: {
    builtAreaM2: "medium",
    houseWidthM: "low",
  },
  questions: [
    {
      id: "scale-reference",
      question: "Qual medida real posso usar como referencia?",
      target: "scale",
      requiredBeforeBudget: true,
    },
  ],
  assumptions: [],
  missingInformation: ["Confirmar escala da planta."],
  warnings: [],
};

const groqConfig: AiTextProviderConfig = {
  id: "groq",
  label: "Groq Free",
  model: "llama-3.1-8b-instant",
  baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  apiKey: "groq-key",
  configured: true,
};

describe("free-cloud text providers", () => {
  it("resolves Groq as the text-summary provider from server-side env", () => {
    expect(
      getAiTextProviderConfig("text-summary", {
        AI_MODE: "free-cloud",
        AI_TEXT_PROVIDER: "groq",
        GROQ_API_KEY: "groq-key",
        GROQ_TEXT_MODEL: "llama-3.1-8b-instant",
      })
    ).toMatchObject({
      id: "groq",
      model: "llama-3.1-8b-instant",
      configured: true,
      apiKey: "groq-key",
    });
  });

  it("resolves SambaNova as an optional text fallback provider", () => {
    expect(
      getAiTextProviderConfig("text-fallback", {
        AI_MODE: "free-cloud",
        AI_TEXT_FALLBACK_PROVIDER: "sambanova",
        SAMBANOVA_API_KEY: "sambanova-key",
        SAMBANOVA_TEXT_MODEL: "Meta-Llama-3.1-8B-Instruct",
      })
    ).toMatchObject({
      id: "sambanova",
      model: "Meta-Llama-3.1-8B-Instruct",
      configured: true,
      apiKey: "sambanova-key",
    });
  });

  it("calls the text provider with bearer auth and no plan file payload", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  text: "Resumo operacional curto.",
                  detected: ["Area construida: 92 m2"],
                  lowConfidence: ["Revisar houseWidthM"],
                  divergences: [],
                  pendingQuestions: ["Confirmar escala da planta."],
                  nextSteps: ["Responder pendencias antes do orçamento."],
                }),
              },
            },
          ],
          usage: { total_tokens: 77 },
        }),
        { status: 200 }
      );
    };

    const summary = await callAiTextSummaryProvider(groqConfig, { result: planResult }, fetchMock);
    const call = calls[0];
    const headers = new Headers(call?.init?.headers);
    const body = JSON.parse(String(call?.init?.body));

    expect(call?.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(headers.get("Authorization")).toBe("Bearer groq-key");
    expect(body).toMatchObject({
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
    });
    expect(JSON.stringify(body)).not.toContain("image_url");
    expect(JSON.stringify(body)).not.toContain("inline_data");
    expect(summary).toMatchObject({
      status: "completed",
      source: "provider",
      provider: "groq",
      model: "llama-3.1-8b-instant",
      tokens: 77,
      text: "Resumo operacional curto.",
    });
  });

  it("accepts provider JSON wrapped in a markdown code fence", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: [
                  "```json",
                  JSON.stringify({
                    text: "Resumo em JSON cercado.",
                    detected: ["Area construida: 92 m2"],
                    lowConfidence: [],
                    divergences: [],
                    pendingQuestions: [],
                    nextSteps: ["Revisar antes de aplicar."],
                  }),
                  "```",
                ].join("\n"),
              },
            },
          ],
        }),
        { status: 200 }
      );

    await expect(callAiTextSummaryProvider(groqConfig, { result: planResult }, fetchMock)).resolves.toMatchObject({
      status: "completed",
      text: "Resumo em JSON cercado.",
      detected: ["Area construida: 92 m2"],
    });
  });

  it("throws a safe missing-key error before making a request", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response("{}", { status: 500 });
    };

    await expect(callAiTextSummaryProvider({ ...groqConfig, apiKey: "", configured: false }, { result: planResult }, fetchMock)).rejects.toThrow(
      "Provider groq nao esta configurado para resumo textual."
    );
    expect(calls).toHaveLength(0);
  });
});
