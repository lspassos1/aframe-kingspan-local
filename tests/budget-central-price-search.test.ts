import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createCentralPriceCandidateEntry,
  createCentralPriceCostItemId,
  createCentralPriceMatchId,
  createCentralPriceSourceId,
} from "@/lib/budget-assistant/central-price-search";
import type { BudgetAssistantQuantityItem } from "@/lib/budget-assistant";
import type { PriceCandidate } from "@/lib/pricing";

describe("budget assistant central price search", () => {
  it("creates a review-required source, cost item, and pending match from a remote candidate", () => {
    const quantityItem = createQuantityItem();
    const candidate = createRemoteCandidate();

    const entry = createCentralPriceCandidateEntry({ quantityItem, candidate });

    expect(entry.source).toMatchObject({
      id: "central-source-source-ba-2026-05",
      type: "sinapi",
      title: "SINAPI BA Maio 2026",
      state: "BA",
      referenceDate: "2026-05",
      reliability: "medium",
    });
    expect(entry.costItem).toMatchObject({
      id: "central-cost-q-wall-remote-wall",
      sourceId: entry.source.id,
      sourceCode: "87505",
      unit: "m2",
      unitPrice: 128.42,
      requiresReview: true,
    });
    expect(entry.costItem.total).toBe(6421);
    expect(entry.match).toMatchObject({
      id: "central-match-q-wall-remote-wall",
      quantityItemId: "q-wall",
      costItemId: entry.costItem.id,
      approvedByUser: false,
      requiresReview: true,
      unitCompatible: true,
    });
  });

  it("keeps incompatible remote units pending instead of approving a match", () => {
    const entry = createCentralPriceCandidateEntry({
      quantityItem: createQuantityItem(),
      candidate: createRemoteCandidate({ unit: "m3" }),
    });

    expect(entry.match.unitCompatible).toBe(false);
    expect(entry.match.approvedByUser).toBe(false);
    expect(entry.match.requiresReview).toBe(true);
    expect(entry.costItem.notes).toContain("Unidade divergente");
  });

  it("uses deterministic ids without referencing service-role secrets in app code", () => {
    expect(createCentralPriceSourceId("source/ba 2026")).toBe("central-source-source-ba-2026");
    expect(createCentralPriceCostItemId("q wall", "remote/wall")).toBe("central-cost-q-wall-remote-wall");
    expect(createCentralPriceMatchId("q wall", "remote/wall")).toBe("central-match-q-wall-remote-wall");

    const changedRuntimeFiles = ["src/app/budget-assistant/page.tsx", "src/lib/budget-assistant/central-price-search.ts"];
    const content = changedRuntimeFiles.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(content).not.toContain("service_role");
  });
});

function createQuantityItem(overrides: Partial<BudgetAssistantQuantityItem> = {}): BudgetAssistantQuantityItem {
  return {
    id: "q-wall",
    constructionMethod: "conventional-masonry",
    category: "civil",
    description: "Alvenaria de vedacao",
    quantity: 50,
    unit: "m2",
    estimatedTotalBRL: 0,
    requiresPriceSource: true,
    notes: "Quantitativo pendente de fonte.",
    ...overrides,
  };
}

function createRemoteCandidate(overrides: Partial<PriceCandidate> = {}): PriceCandidate {
  return {
    id: "remote-wall",
    sourceId: "source-ba-2026-05",
    sourceTitle: "SINAPI BA Maio 2026",
    supplier: "CAIXA",
    sourceType: "sinapi",
    itemType: "composition",
    code: "87505",
    description: "Alvenaria de vedacao com bloco ceramico",
    unit: "m2",
    category: "civil",
    constructionMethod: "conventional-masonry",
    state: "BA",
    city: "Salvador",
    referenceMonth: "2026-05",
    regime: "nao_desonerado",
    directUnitCostBRL: 128.42,
    materialCostBRL: 92,
    laborCostBRL: 32,
    equipmentCostBRL: 0,
    thirdPartyCostBRL: 0,
    otherCostBRL: 4.42,
    totalLaborHoursPerUnit: 0.68,
    priceStatus: "valid",
    confidence: "medium",
    requiresReview: true,
    pendingReason: "Candidato importado da base central.",
    tags: ["alvenaria"],
    quality: {
      status: "pending",
      usable: false,
      requiresReview: true,
      issues: [{ code: "candidate_requires_review", severity: "pending", message: "Candidato de preço não é aprovado automaticamente." }],
    },
    ...overrides,
  };
}
