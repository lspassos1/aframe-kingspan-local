import type { BudgetAssistantProjectData, BudgetMatch, CostItem } from "./types";

export type BudgetAssistantValidationCode =
  | "price-source-missing"
  | "cost-item-missing"
  | "match-not-approved"
  | "match-requires-review"
  | "unit-incompatible";

export interface BudgetAssistantValidationIssue {
  code: BudgetAssistantValidationCode;
  id: string;
  message: string;
}

export function validateBudgetAssistantDataForReviewedBudget(data: BudgetAssistantProjectData): BudgetAssistantValidationIssue[] {
  const costSources = data.costSources ?? [];
  const costItems = data.costItems ?? [];
  const matches = data.matches ?? [];
  const sourceIds = new Set(costSources.map((source) => source.id));
  const costItemById = new Map(costItems.map((item) => [item.id, item]));
  const matchedCostItemIds = new Set(matches.map((match) => match.costItemId));
  const matchedCostItems = costItems.filter((item) => matchedCostItemIds.has(item.id));

  return [
    ...matchedCostItems.flatMap((item) => validateCostItemSource(item, sourceIds)),
    ...matches.flatMap((match) => validateReviewedMatch(match, costItemById)),
  ];
}

function validateCostItemSource(costItem: CostItem, sourceIds: Set<string>): BudgetAssistantValidationIssue[] {
  if (costItem.sourceId && sourceIds.has(costItem.sourceId)) return [];

  return [
    {
      code: "price-source-missing",
      id: costItem.id,
      message: `Item de preco "${costItem.description}" nao possui fonte cadastrada no projeto.`,
    },
  ];
}

function validateReviewedMatch(match: BudgetMatch, costItemById: Map<string, CostItem>): BudgetAssistantValidationIssue[] {
  const issues: BudgetAssistantValidationIssue[] = [];
  const costItem = costItemById.get(match.costItemId);
  if (!costItem) {
    issues.push({
      code: "cost-item-missing",
      id: match.id,
      message: `Match "${match.id}" aponta para item de preco inexistente.`,
    });
  }

  if (!match.approvedByUser) {
    issues.push({
      code: "match-not-approved",
      id: match.id,
      message: `Match "${match.id}" ainda nao foi aprovado por revisao humana.`,
    });
  }

  if (match.requiresReview) {
    issues.push({
      code: "match-requires-review",
      id: match.id,
      message: `Match "${match.id}" ainda esta marcado como revisavel.`,
    });
  }

  if (!match.unitCompatible) {
    issues.push({
      code: "unit-incompatible",
      id: match.id,
      message: `Match "${match.id}" possui unidade incompativel entre quantitativo e preco.`,
    });
  }

  return issues;
}
