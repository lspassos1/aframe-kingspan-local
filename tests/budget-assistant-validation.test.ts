import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { validateBudgetAssistantDataForReviewedBudget } from "@/lib/budget-assistant";
import type { BudgetAssistantProjectData, BudgetMatch, CostItem, CostSource } from "@/lib/budget-assistant";

const source: CostSource = {
  id: "source-1",
  type: "manual",
  title: "Cotacao local",
  supplier: "Fornecedor ABC",
  state: "Bahia",
  city: "Cruz das Almas",
  referenceDate: "2026-05-04",
  reliability: "low",
  notes: "Fonte manual revisavel.",
};

const costItem: CostItem = {
  id: "cost-item-1",
  constructionMethod: "aframe",
  category: "panels",
  description: "Painel sanduiche",
  quantity: 10,
  unit: "m2",
  unitPrice: 100,
  total: 1000,
  sourceId: source.id,
  sourceCode: "MANUAL",
  confidence: "medium",
  requiresReview: true,
  notes: "Preco informado manualmente.",
};

const approvedMatch: BudgetMatch = {
  id: "match-1",
  quantityItemId: "quantity-1",
  costItemId: costItem.id,
  confidence: "medium",
  reason: "Aprovado manualmente.",
  unitCompatible: true,
  requiresReview: false,
  approvedByUser: true,
};

describe("budget assistant reviewed-budget validation", () => {
  it("flags price items without a registered source", () => {
    const data = createBudgetAssistantData({
      costSources: [],
      costItems: [costItem],
      matches: [approvedMatch],
    });

    expect(validateBudgetAssistantDataForReviewedBudget(data)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "price-source-missing", id: costItem.id })])
    );
  });

  it("ignores unlinked cost items when validating a reviewed budget", () => {
    const unlinkedCostItem: CostItem = {
      ...costItem,
      id: "cost-item-unlinked",
      sourceId: "missing-source",
    };
    const data = createBudgetAssistantData({
      costSources: [source],
      costItems: [costItem, unlinkedCostItem],
      matches: [approvedMatch],
    });

    expect(validateBudgetAssistantDataForReviewedBudget(data)).toEqual([]);
  });

  it("flags matches that still need human review before entering a reviewed budget", () => {
    const pendingMatch: BudgetMatch = {
      ...approvedMatch,
      id: "match-pending",
      approvedByUser: false,
      requiresReview: true,
    };
    const data = createBudgetAssistantData({
      costSources: [source],
      costItems: [costItem],
      matches: [pendingMatch],
    });

    expect(validateBudgetAssistantDataForReviewedBudget(data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "match-not-approved", id: pendingMatch.id }),
        expect.objectContaining({ code: "match-requires-review", id: pendingMatch.id }),
      ])
    );
  });

  it("accepts sourced cost items and approved compatible matches", () => {
    const data = createBudgetAssistantData({
      costSources: [source],
      costItems: [costItem],
      matches: [approvedMatch],
    });

    expect(validateBudgetAssistantDataForReviewedBudget(data)).toEqual([]);
  });
});

function createBudgetAssistantData(data: Pick<BudgetAssistantProjectData, "costSources" | "costItems" | "matches">): BudgetAssistantProjectData {
  return {
    ...defaultProject.budgetAssistant,
    costSources: data.costSources,
    costItems: data.costItems,
    matches: data.matches,
  };
}
