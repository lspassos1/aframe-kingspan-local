import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { getSafePlanImportProviderUiStatus } from "@/lib/ai/plan-import-status";
import {
  formatPlanImportProviderName,
  getPlanImportPayloadMessage,
  getPlanImportStateCopy,
  getPlanImportStateFromResponse,
  planImportStateCopy,
  type PlanImportProviderUiStatus,
} from "@/lib/ai/plan-import-ui";

const projectStore = vi.hoisted(() => ({
  state: {
    project: undefined as unknown,
    setProject: vi.fn(),
  },
}));

vi.mock("@/lib/store/project-store", () => {
  const useProjectStore = Object.assign((selector: (state: typeof projectStore.state) => unknown) => selector(projectStore.state), {
    getState: () => projectStore.state,
  });

  return { useProjectStore };
});

import { PlanImportCard } from "@/components/ai/PlanImportCard";

const freeCloudStatus: PlanImportProviderUiStatus = {
  mode: "free-cloud",
  modeLabel: "Modo gratuito",
  primaryProviderLabel: "Gemini Free",
  reviewProviderLabel: "OpenRouter Free",
  textProviderLabel: "Groq Free",
  textFallbackProviderLabel: "Cerebras Free",
  paidFallbackEnabled: false,
  primaryConfigured: true,
  reviewConfigured: false,
};

describe("plan import UI state", () => {
  it("classifies cache hit, review ready, limit and error responses", () => {
    expect(getPlanImportStateFromResponse({ ok: true, status: 200, cacheHeader: "HIT" })).toBe("cache-hit");
    expect(getPlanImportStateFromResponse({ ok: true, status: 200, cached: true })).toBe("cache-hit");
    expect(getPlanImportStateFromResponse({ ok: true, status: 200 })).toBe("review-ready");
    expect(getPlanImportStateFromResponse({ ok: false, status: 429 })).toBe("limit-exceeded");
    expect(getPlanImportStateFromResponse({ ok: false, status: 415 })).toBe("error");
  });

  it("keeps explicit copy for upload, analyzing, cache hit and limit states", () => {
    expect(planImportStateCopy.idle.title).toContain("Arraste");
    expect(planImportStateCopy.uploading.badge).toBe("Enviando");
    expect(planImportStateCopy.analyzing.title).toContain("OpenAI");
    expect(planImportStateCopy["cache-hit"].description).toContain("limite diario nao foi consumido");
    expect(planImportStateCopy["limit-exceeded"].description).toContain("preenchimento manual");
  });

  it("switches upload copy to free-cloud mode without promising a paid provider", () => {
    expect(getPlanImportStateCopy("idle", freeCloudStatus).badge).toBe("Modo gratuito");
    expect(getPlanImportStateCopy("analyzing", freeCloudStatus).title).toContain("Gemini Free");
    expect(getPlanImportStateCopy("analyzing", freeCloudStatus).description).toContain("OpenRouter Free");
    expect(getPlanImportStateCopy("limit-exceeded", freeCloudStatus).description).toContain("sem chamar provider pago");
  });

  it("uses safe API messages without exposing provider secrets", () => {
    expect(getPlanImportPayloadMessage({ message: "OpenAI API nao esta configurada no servidor." }, "error")).toContain("OpenAI API");
    expect(getPlanImportPayloadMessage(null, "limit-exceeded")).toContain("Limite diario");
  });

  it("keeps unknown provider names instead of relabeling them as primary", () => {
    expect(formatPlanImportProviderName("custom-free-provider")).toBe("custom-free-provider");
  });

  it("creates safe free-cloud UI status from server env without leaking keys", () => {
    const status = getSafePlanImportProviderUiStatus({
      AI_MODE: "free-cloud",
      AI_PLAN_PRIMARY_PROVIDER: "gemini",
      AI_PLAN_REVIEW_PROVIDER: "openrouter",
      AI_TEXT_PROVIDER: "groq",
      AI_TEXT_FALLBACK_PROVIDER: "cerebras",
      AI_PAID_FALLBACK_ENABLED: "false",
      GEMINI_API_KEY: "secret-gemini",
      OPENROUTER_API_KEY: "secret-openrouter",
      GROQ_API_KEY: "secret-groq",
    });

    expect(status).toMatchObject({
      mode: "free-cloud",
      modeLabel: "Modo gratuito",
      primaryProviderLabel: "Gemini Free",
      reviewProviderLabel: "OpenRouter Free",
      textProviderLabel: "Groq Free",
      paidFallbackEnabled: false,
      primaryConfigured: true,
      reviewConfigured: true,
    });
    expect(JSON.stringify(status)).not.toContain("secret-");
  });
});

describe("PlanImportCard", () => {
  beforeEach(() => {
    projectStore.state.project = defaultProject;
  });

  it("renders a dropzone as the primary upload action", () => {
    const html = renderToStaticMarkup(createElement(PlanImportCard, { planExtractEnabled: true }));

    expect(html).toContain('data-state="idle"');
    expect(html).toContain("Arraste a planta aqui");
    expect(html).toContain("Clique para selecionar ou solte o arquivo aqui");
    expect(html).toContain("Provider configurado: OpenAI.");
  });

  it("renders free-cloud provider status, comparison and manual fallback copy", () => {
    const html = renderToStaticMarkup(createElement(PlanImportCard, { planExtractEnabled: true, aiProviderStatus: freeCloudStatus }));

    expect(html).toContain("Modo gratuito");
    expect(html).toContain("Gemini Free sugere campos preliminares");
    expect(html).toContain("Modo gratuito: Gemini Free.");
    expect(html).toContain("Comparação: OpenRouter Free aguardando chave no servidor.");
    expect(html).toContain("Sem fallback pago automatico");
    expect(html).not.toContain("OPENAI_API_KEY");
  });

  it("renders explicit paid fallback status when the safe UI flag is enabled", () => {
    const html = renderToStaticMarkup(
      createElement(PlanImportCard, {
        planExtractEnabled: true,
        aiProviderStatus: { ...freeCloudStatus, paidFallbackEnabled: true },
      })
    );

    expect(html).toContain("Modo gratuito");
    expect(html).toContain("Gemini Free sugere campos preliminares");
    expect(html).toContain("Fallback pago configurado, mas não é acionado automaticamente neste fluxo.");
    expect(html).not.toContain("Sem fallback pago automatico");
  });

  it("renders operational setup copy when AI extraction is disabled", () => {
    const html = renderToStaticMarkup(createElement(PlanImportCard, { planExtractEnabled: false }));

    expect(html).toContain("Upload assistido indisponivel");
    expect(html).toContain("AI_PLAN_EXTRACT_ENABLED=true");
    expect(html).toContain("OPENAI_API_KEY");
    expect(html).toContain("Assinatura ChatGPT nao configura esta API automaticamente");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain("Clique para selecionar ou solte o arquivo aqui");
  });

  it("renders free-cloud setup copy when extraction is disabled", () => {
    const html = renderToStaticMarkup(createElement(PlanImportCard, { planExtractEnabled: false, aiProviderStatus: freeCloudStatus }));

    expect(html).toContain("AI_MODE=free-cloud");
    expect(html).toContain("providers gratuitos");
    expect(html).toContain("nenhuma chave deve usar NEXT_PUBLIC_");
    expect(html).not.toContain("OPENAI_API_KEY");
  });
});
