import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { createBudgetAssistantViewModel, createManualCostItem, createManualCostSource, suggestBudgetMatches } from "@/lib/budget-assistant";

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
    const source = createManualCostSource({
      title: "Cotacao local",
      type: "supplier_quote",
      supplier: "Fornecedor ABC",
      referenceDate: "2026-05-04",
      city: "Lisboa",
      state: "LX",
    });
    const entry = createManualCostItem({
      quantityItem,
      sourceId: source.id,
      description: quantityItem.description,
      category: quantityItem.category,
      quantity: quantityItem.quantity,
      unit: quantityItem.unit,
      unitPrice: 125,
      confidence: "low",
    });
    const viewModel = createBudgetAssistantViewModel(defaultProject, scenario, {
      costSources: [source],
      costItems: [entry.costItem],
      matches: [entry.match],
    });

    expect(source.type).toBe("supplier_quote");
    expect(source.supplier).toBe("Fornecedor ABC");
    expect(source.referenceDate).toBe("2026-05-04");
    expect(entry.costItem.unit).toBe(quantityItem.unit);
    expect(entry.costItem.confidence).toBe("low");
    expect(entry.costItem.requiresReview).toBe(true);
    expect(viewModel.costSources).toHaveLength(1);
    expect(viewModel.lowConfidenceCount).toBe(1);
    expect(viewModel.unpricedCount).toBe(baseViewModel.unpricedCount - 1);
  });

  it("suggests matches only from existing cost items and leaves them pending", () => {
    const scenario = defaultProject.scenarios[0];
    const viewModel = createBudgetAssistantViewModel(defaultProject, scenario);
    const quantityItem = viewModel.pendingPriceItems[0];
    const entry = createManualCostItem({
      quantityItem,
      sourceId: "source-1",
      description: quantityItem.description,
      category: quantityItem.category,
      quantity: quantityItem.quantity,
      unit: quantityItem.unit,
      unitPrice: 90,
      confidence: "medium",
    });

    const suggestions = suggestBudgetMatches({
      quantityItems: [quantityItem],
      costItems: [entry.costItem],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      quantityItemId: quantityItem.id,
      costItemId: entry.costItem.id,
      unitCompatible: true,
      approvedByUser: false,
      requiresReview: true,
    });
  });

  it("flags unit incompatibility and does not suggest already matched quantities", () => {
    const scenario = defaultProject.scenarios[0];
    const viewModel = createBudgetAssistantViewModel(defaultProject, scenario);
    const quantityItem = viewModel.pendingPriceItems[0];
    const entry = createManualCostItem({
      quantityItem,
      sourceId: "source-1",
      description: quantityItem.description,
      category: quantityItem.category,
      quantity: quantityItem.quantity,
      unit: quantityItem.unit === "m2" ? "m" : "m2",
      unitPrice: 90,
      confidence: "high",
    });

    const suggestions = suggestBudgetMatches({ quantityItems: [quantityItem], costItems: [entry.costItem] });
    const blocked = suggestBudgetMatches({
      quantityItems: [quantityItem],
      costItems: [entry.costItem],
      existingMatches: [{ ...suggestions[0], approvedByUser: true }],
    });

    expect(suggestions[0].unitCompatible).toBe(false);
    expect(suggestions[0].requiresReview).toBe(true);
    expect(blocked).toHaveLength(0);
  });
});
