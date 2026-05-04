import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { createBudgetAssistantViewModel, createManualCostEntry } from "@/lib/budget-assistant";

describe("budget assistant foundation", () => {
  it("builds a preliminary view model from detected budget quantities", () => {
    const scenario = defaultProject.scenarios[0];
    const viewModel = createBudgetAssistantViewModel(defaultProject, scenario);

    expect(viewModel.methodName).toBe("A-frame com paineis");
    expect(viewModel.status).toBe("preliminary");
    expect(viewModel.quantityItems.length).toBeGreaterThan(0);
    expect(viewModel.unpricedCount).toBeGreaterThan(0);
    expect(viewModel.costSources).toHaveLength(0);
  });

  it("keeps manual price entries sourced, dated, unitized, and reviewable", () => {
    const scenario = defaultProject.scenarios[0];
    const baseViewModel = createBudgetAssistantViewModel(defaultProject, scenario);
    const quantityItem = baseViewModel.pendingPriceItems[0];
    const entry = createManualCostEntry({
      quantityItem,
      sourceTitle: "Cotacao local",
      referenceDate: "2026-05-04",
      unitPrice: 125,
      confidence: "low",
      city: "Lisboa",
      state: "LX",
    });
    const viewModel = createBudgetAssistantViewModel(defaultProject, scenario, {
      costSources: [entry.source],
      costItems: [entry.costItem],
      matches: [entry.match],
    });

    expect(entry.source.type).toBe("manual");
    expect(entry.source.referenceDate).toBe("2026-05-04");
    expect(entry.costItem.unit).toBe(quantityItem.unit);
    expect(entry.costItem.confidence).toBe("low");
    expect(entry.costItem.requiresReview).toBe(true);
    expect(viewModel.costSources).toHaveLength(1);
    expect(viewModel.lowConfidenceCount).toBe(1);
    expect(viewModel.unpricedCount).toBe(baseViewModel.unpricedCount - 1);
  });
});
