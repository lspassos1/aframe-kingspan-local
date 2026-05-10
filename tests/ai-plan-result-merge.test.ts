import { describe, expect, it } from "vitest";
import { mergePlanExtractionResults } from "@/lib/ai/plan-result-merge";
import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";

function createPlanResult(overrides: Partial<PlanExtractResult> = {}): PlanExtractResult {
  return {
    version: "1.0",
    summary: "Leitura primaria.",
    confidence: "medium",
    extracted: {
      city: "Curitiba",
      state: "PR",
      builtAreaM2: 96,
      houseWidthM: 8,
      houseDepthM: 12,
      floors: 1,
      notes: [],
    },
    fieldConfidence: {
      builtAreaM2: "medium",
      city: "medium",
      houseWidthM: "medium",
    },
    assumptions: [],
    missingInformation: [],
    warnings: [],
    ...overrides,
  };
}

describe("plan extraction result merge", () => {
  it("registers agreements and promotes confidence without changing primary values", () => {
    const primary = createPlanResult();
    const review = createPlanResult({
      summary: "Segunda leitura.",
      fieldConfidence: {
        builtAreaM2: "high",
      },
    });

    const merged = mergePlanExtractionResults(primary, review);

    expect(merged.comparison.agreements).toEqual(expect.arrayContaining([expect.objectContaining({ field: "builtAreaM2", primaryValue: 96, reviewValue: 96 })]));
    expect(merged.result.extracted).toEqual(primary.extracted);
    expect(merged.result.fieldConfidence.builtAreaM2).toBe("high");
  });

  it("keeps divergent values pending for human review", () => {
    const primary = createPlanResult();
    const review = createPlanResult({
      extracted: {
        ...createPlanResult().extracted,
        builtAreaM2: 112,
      },
    });

    const merged = mergePlanExtractionResults(primary, review);

    expect(merged.result.extracted.builtAreaM2).toBe(96);
    expect(merged.result.fieldConfidence.builtAreaM2).toBe("low");
    expect(merged.comparison.divergences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "builtAreaM2",
          primaryValue: 96,
          reviewValue: 112,
          pendingReason: expect.stringContaining("Divergencia multi-modelo"),
        }),
      ])
    );
    expect(merged.result.extractionWarnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "multi_model_divergence", target: "builtAreaM2" })])
    );
    expect(merged.result.missingInformation.join(" ")).toContain("builtAreaM2");
  });

  it("marks primary-only comparable values as unresolved instead of silently accepting them", () => {
    const primary = createPlanResult();
    const review = createPlanResult({
      extracted: {
        ...createPlanResult().extracted,
        builtAreaM2: undefined,
      },
    });

    const merged = mergePlanExtractionResults(primary, review);

    expect(merged.result.extracted.builtAreaM2).toBe(96);
    expect(merged.result.fieldConfidence.builtAreaM2).toBe("low");
    expect(merged.comparison.unresolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "builtAreaM2",
          primaryValue: 96,
          reviewValue: undefined,
          pendingReason: expect.stringContaining("Segunda leitura nao confirmou"),
        }),
      ])
    );
    expect(merged.result.extractionWarnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "multi_model_unresolved", target: "builtAreaM2" })])
    );
    expect(merged.result.missingInformation.join(" ")).toContain("builtAreaM2");
  });

  it("does not let review summary text alter structured extracted data", () => {
    const primary = createPlanResult();
    const review = createPlanResult({
      summary: "Texto alternativo do segundo modelo.",
      extracted: {
        ...createPlanResult().extracted,
      },
    });

    const merged = mergePlanExtractionResults(primary, review);

    expect(merged.result.summary).toBe(primary.summary);
    expect(merged.result.extracted).toEqual(primary.extracted);
  });
});
