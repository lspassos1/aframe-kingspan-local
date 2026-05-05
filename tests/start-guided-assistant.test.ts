import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createStartAssistantViewModel, normalizeStartAssistantModeParam } from "@/lib/onboarding/start-guided-assistant";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/store/project-store", () => ({
  useProjectStore: (selector: (state: { setProject: () => void; setOnboardingCompleted: () => void }) => unknown) =>
    selector({
      setProject: vi.fn(),
      setOnboardingCompleted: vi.fn(),
    }),
}));

vi.mock("@/components/ai/PlanImportCard", () => ({
  PlanImportCard: () => createElement("div", { "data-testid": "plan-import" }, "Enviar planta baixa"),
}));

vi.mock("@/components/onboarding/StartProjectForm", () => ({
  StartProjectForm: () => createElement("div", { "data-testid": "manual-form" }, "Método construtivo"),
}));

import { StartGuidedAssistant } from "@/components/onboarding/StartGuidedAssistant";

describe("createStartAssistantViewModel", () => {
  it("normalizes optional start mode query params", () => {
    expect(normalizeStartAssistantModeParam("ai")).toBe("ai");
    expect(normalizeStartAssistantModeParam(["manual", "ai"])).toBe("manual");
    expect(normalizeStartAssistantModeParam("unknown")).toBe("choose");
    expect(normalizeStartAssistantModeParam(undefined)).toBe("choose");
  });

  it("keeps the first layer focused on the three entry modes", () => {
    const viewModel = createStartAssistantViewModel({ mode: "choose", planExtractEnabled: true });

    expect(viewModel.title).toBe("Comece pela planta baixa.");
    expect(viewModel.options.map((option) => option.id)).toEqual(["ai", "manual", "example"]);
    expect(viewModel.options.map((option) => option.title)).toEqual(["Enviar planta baixa", "Preencher manualmente", "Usar exemplo"]);
    expect(viewModel.showPlanImport).toBe(false);
    expect(viewModel.showManualForm).toBe(false);
  });

  it("makes upload primary in AI mode when extraction is enabled", () => {
    const viewModel = createStartAssistantViewModel({ mode: "ai", planExtractEnabled: true });

    expect(viewModel.showPlanImport).toBe(true);
    expect(viewModel.showManualForm).toBe(true);
    expect(viewModel.showAiDisabledNotice).toBe(false);
    expect(viewModel.options.find((option) => option.id === "ai")?.primary).toBe(true);
  });

  it("falls back to manual flow when AI extraction is disabled", () => {
    const viewModel = createStartAssistantViewModel({ mode: "ai", planExtractEnabled: false });

    expect(viewModel.showPlanImport).toBe(true);
    expect(viewModel.showManualForm).toBe(true);
    expect(viewModel.showAiDisabledNotice).toBe(true);
    expect(viewModel.options.find((option) => option.id === "ai")?.disabledReason).toBe("IA desligada");
  });

  it("supports manual and example modes explicitly", () => {
    expect(createStartAssistantViewModel({ mode: "manual", planExtractEnabled: true })).toMatchObject({
      showPlanImport: false,
      showManualForm: true,
      shouldRunExample: false,
    });
    expect(createStartAssistantViewModel({ mode: "example", planExtractEnabled: true })).toMatchObject({
      shouldRunExample: true,
    });
  });
});

describe("StartGuidedAssistant", () => {
  it("renders the initial screen without construction method content", () => {
    const html = renderToStaticMarkup(createElement(StartGuidedAssistant, { planExtractEnabled: true }));

    expect(html).toContain("Comece pela planta baixa.");
    expect(html).toContain("Enviar planta baixa");
    expect(html).toContain("Preencher manualmente");
    expect(html).toContain("Usar exemplo");
    expect(html).not.toContain("Método construtivo");
    expect(html).not.toContain("Escolha o sistema construtivo");
  });

  it("renders upload before the manual form in AI mode", () => {
    const html = renderToStaticMarkup(createElement(StartGuidedAssistant, { planExtractEnabled: true, initialMode: "ai" }));

    expect(html.indexOf('data-testid="plan-import"')).toBeLessThan(html.indexOf('data-testid="manual-form"'));
  });

  it("renders the manual fallback when AI mode is selected but disabled", () => {
    const html = renderToStaticMarkup(createElement(StartGuidedAssistant, { planExtractEnabled: false, initialMode: "ai" }));

    expect(html).toContain("A leitura por IA está desligada");
    expect(html).toContain('data-testid="plan-import"');
    expect(html).toContain('data-testid="manual-form"');
  });
});
