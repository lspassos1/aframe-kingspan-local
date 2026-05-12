import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuidedActionPanel } from "@/components/shared/GuidedActionPanel";
import { createBudgetAssistantGuidance, createExportGuidance } from "@/lib/ux/guided-actions";

describe("guided actions", () => {
  it("creates safe next steps when budget assistant has no usable price data", () => {
    const actions = createBudgetAssistantGuidance({
      hasValidRegion: false,
      costSourceCount: 0,
      applicableCostSourceCount: 0,
      pendingPriceCount: 4,
      lowConfidenceCount: 0,
      remotePriceDbConfigured: false,
    });

    expect(actions.map((item) => item.id)).toEqual(["region-required", "central-db-unavailable", "no-price-base", "pending-prices"]);
    expect(actions.flatMap((item) => item.actions.map((action) => action.label))).toEqual(
      expect.arrayContaining(["Revisar dados da obra", "Importar base de preços", "Cadastrar fonte", "Preencher preço"])
    );
    expect(JSON.stringify(actions)).not.toContain("API_KEY");
    expect(JSON.stringify(actions)).not.toContain("provider");
  });

  it("guides out-of-region and low-confidence price states without dead ends", () => {
    const actions = createBudgetAssistantGuidance({
      hasValidRegion: true,
      costSourceCount: 2,
      applicableCostSourceCount: 0,
      pendingPriceCount: 1,
      lowConfidenceCount: 1,
      remotePriceDbConfigured: true,
    });

    expect(actions.map((item) => item.id)).toEqual(["no-applicable-source", "pending-prices", "low-confidence-prices"]);
    expect(actions.every((item) => item.actions.length > 0)).toBe(true);
    expect(actions.flatMap((item) => item.actions.map((action) => action.label))).toEqual(
      expect.arrayContaining(["Revisar fonte", "Definir região", "Preencher preço"])
    );
  });

  it("creates export guidance for pending price, material and technical states", () => {
    const actions = createExportGuidance({
      pendingMaterialCount: 2,
      pendingBudgetItemCount: 3,
      warningCount: 1,
    });

    expect(actions.map((item) => item.id)).toEqual(["export-price-blockers", "export-material-review", "export-technical-warnings"]);
    expect(actions.every((item) => item.actions.length > 0)).toBe(true);
    expect(actions.flatMap((item) => item.actions.map((action) => action.href))).toEqual(
      expect.arrayContaining(["/budget-assistant", "/materials", "/technical-project"])
    );
  });

  it("renders action links in the shared panel", () => {
    const actions = createExportGuidance({
      pendingMaterialCount: 0,
      pendingBudgetItemCount: 1,
      warningCount: 0,
    });
    const html = renderToStaticMarkup(createElement(GuidedActionPanel, { items: actions }));

    expect(html).toContain("Próximas ações");
    expect(html).toContain("Exportação com preço pendente");
    expect(html).toContain("Revisar fonte");
    expect(html).toContain('href="/budget-assistant"');
  });
});
