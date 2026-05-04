import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import {
  createBudgetAssistantViewModel,
  createManualCostItem,
  createManualCostSource,
  selectApplicableRegionalCostSources,
  suggestBudgetMatches,
} from "@/lib/budget-assistant";
import type { CostSource } from "@/lib/budget-assistant";

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
      city: "Cruz das Almas",
      state: "Bahia",
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

  it("selects price sources by city, state, national, then manual fallback", () => {
    const scenario = defaultProject.scenarios[0];
    const citySource = createCostSource({
      id: "source-city",
      type: "supplier_quote",
      city: "Cruz das Almas",
      state: "Bahia",
    });
    const stateSource = createCostSource({
      id: "source-state",
      type: "sinapi",
      city: "Salvador",
      state: "BA",
    });
    const nationalSource = createCostSource({
      id: "source-national",
      type: "sinapi",
      city: "Nacional",
      state: "Brasil",
    });
    const manualSource = createCostSource({
      id: "source-manual",
      type: "manual",
      city: "Lisboa",
      state: "LX",
    });
    const unrelatedSource = createCostSource({
      id: "source-other-state",
      type: "sinapi",
      city: "Sao Paulo",
      state: "SP",
    });

    expect(selectApplicableRegionalCostSources(scenario, [manualSource, nationalSource, stateSource, citySource]).map((item) => item.source.id)).toEqual([
      "source-city",
    ]);
    expect(selectApplicableRegionalCostSources(scenario, [manualSource, nationalSource, stateSource]).map((item) => item.source.id)).toEqual(["source-state"]);
    expect(selectApplicableRegionalCostSources(scenario, [manualSource, nationalSource]).map((item) => item.source.id)).toEqual(["source-national"]);
    expect(selectApplicableRegionalCostSources(scenario, [unrelatedSource, manualSource]).map((item) => item.source.id)).toEqual(["source-manual"]);
  });

  it("filters matched cost items to the selected regional source scope", () => {
    const scenario = defaultProject.scenarios[0];
    const baseViewModel = createBudgetAssistantViewModel(defaultProject, scenario);
    const quantityItem = baseViewModel.pendingPriceItems[0];
    const citySource = createCostSource({
      id: "source-city",
      type: "supplier_quote",
      city: "Cruz das Almas",
      state: "Bahia",
    });
    const outOfRegionSource = createCostSource({
      id: "source-other-state",
      type: "sinapi",
      city: "Sao Paulo",
      state: "SP",
    });
    const cityEntry = createManualCostItem({
      quantityItem,
      sourceId: citySource.id,
      description: quantityItem.description,
      category: quantityItem.category,
      quantity: quantityItem.quantity,
      unit: quantityItem.unit,
      unitPrice: 125,
      confidence: "medium",
    });
    const outOfRegionEntry = {
      costItem: { ...cityEntry.costItem, id: "manual-cost-other-state", sourceId: outOfRegionSource.id },
      match: { ...cityEntry.match, id: "manual-match-other-state", costItemId: "manual-cost-other-state" },
    };

    const viewModel = createBudgetAssistantViewModel(defaultProject, scenario, {
      costSources: [outOfRegionSource, citySource],
      costItems: [outOfRegionEntry.costItem, cityEntry.costItem],
      matches: [outOfRegionEntry.match, cityEntry.match],
    });

    expect(viewModel.selectedPriceSourceIds).toEqual(["source-city"]);
    expect(viewModel.costItems.map((item) => item.id)).toEqual([cityEntry.costItem.id]);
    expect(viewModel.matches.map((match) => match.id)).toEqual([cityEntry.match.id]);
    expect(viewModel.unpricedCount).toBe(baseViewModel.unpricedCount - 1);
  });
});

function createCostSource(overrides: Partial<CostSource>): CostSource {
  return {
    id: "source",
    type: "sinapi",
    title: "Fonte de preco",
    supplier: "Fornecedor",
    state: "Bahia",
    city: "Cruz das Almas",
    referenceDate: "2026-05-04",
    reliability: "medium",
    notes: "",
    ...overrides,
  };
}
