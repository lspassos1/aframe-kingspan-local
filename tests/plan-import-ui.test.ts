import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { getPlanImportPayloadMessage, getPlanImportStateFromResponse, planImportStateCopy } from "@/lib/ai/plan-import-ui";

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

  it("uses safe API messages without exposing provider secrets", () => {
    expect(getPlanImportPayloadMessage({ message: "OpenAI API nao esta configurada no servidor." }, "error")).toContain("OpenAI API");
    expect(getPlanImportPayloadMessage(null, "limit-exceeded")).toContain("Limite diario");
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

  it("renders operational setup copy when AI extraction is disabled", () => {
    const html = renderToStaticMarkup(createElement(PlanImportCard, { planExtractEnabled: false }));

    expect(html).toContain("Upload assistido indisponivel");
    expect(html).toContain("AI_PLAN_EXTRACT_ENABLED=true");
    expect(html).toContain("OPENAI_API_KEY");
    expect(html).toContain("Assinatura ChatGPT nao configura esta API automaticamente");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain("Clique para selecionar ou solte o arquivo aqui");
  });
});
