import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlanExtractReview, getPlanExtractFieldEvidence, type PlanExtractCurrentValues } from "@/components/ai/PlanExtractReview";
import { getDefaultPlanExtractSelectedFields } from "@/lib/ai/apply-plan-extract";
import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";

const reviewResult: PlanExtractResult = {
  version: "1.0",
  summary: "Planta com cotas principais e informacoes parciais.",
  confidence: "medium",
  extracted: {
    projectName: "Casa Jardim",
    city: "Salvador",
    state: "BA",
    country: "Brasil",
    constructionMethod: "eco-block",
    terrainWidthM: 12,
    terrainDepthM: 24,
    houseWidthM: 8,
    houseDepthM: 10,
    builtAreaM2: 80,
    floorHeightM: 2.8,
    floors: 1,
    doorCount: 4,
    windowCount: 6,
    notes: ["Cidade: Salvador aparece no carimbo.", "Largura da casa inferida pela cota frontal."],
  },
  fieldConfidence: {
    city: "high",
    constructionMethod: "medium",
    houseWidthM: "low",
    houseDepthM: "medium",
  },
  assumptions: ["Area construida calculada por largura x profundidade."],
  missingInformation: ["Escala grafica nao visivel."],
  warnings: ["Metodo construtivo precisa de confirmacao humana."],
};

const currentValues: PlanExtractCurrentValues = {
  projectName: "Estudo inicial",
  city: "Curitiba",
  state: "PR",
  country: "Brasil",
  constructionMethod: "conventional-masonry",
  terrainWidthM: 10,
  terrainDepthM: 20,
  houseWidthM: 7,
  houseDepthM: 9,
  builtAreaM2: 63,
  floorHeightM: 2.7,
  floors: 1,
  doorCount: 2,
  windowCount: 3,
};

describe("PlanExtractReview", () => {
  it("renders grouped review cards with before/after, evidence and decision actions", () => {
    const selectedFields = getDefaultPlanExtractSelectedFields(reviewResult, "conventional-masonry");
    const html = renderToStaticMarkup(
      createElement(PlanExtractReview, {
        result: reviewResult,
        selectedFields,
        currentValues,
        modifiedValues: {},
        onSelectedFieldsChange: vi.fn(),
        onModifiedValuesChange: vi.fn(),
        onApply: vi.fn(),
        onDismiss: vi.fn(),
        onBackToManual: vi.fn(),
      })
    );

    expect(html).toContain("Metodo sugerido");
    expect(html).toContain("Localizacao");
    expect(html).toContain("Area e dimensoes");
    expect(html).toContain("Ambientes");
    expect(html).toContain("Portas e janelas");
    expect(html).toContain("Antes");
    expect(html).toContain("Depois");
    expect(html).toContain("Evidencia:");
    expect(html).toContain("Incertezas");
    expect(html).toContain("Alertas");
    expect(html).toContain("Descartar extracao");
    expect(html).toContain("Voltar para manual");
    expect(html).toContain("Aplicar campos selecionados");
  });

  it("shows uncertain method as a suggestion instead of a default action", () => {
    const selectedFields = getDefaultPlanExtractSelectedFields(reviewResult, "conventional-masonry");
    const html = renderToStaticMarkup(
      createElement(PlanExtractReview, {
        result: reviewResult,
        selectedFields,
        currentValues,
        modifiedValues: {},
        onSelectedFieldsChange: vi.fn(),
        onModifiedValuesChange: vi.fn(),
        onApply: vi.fn(),
        onDismiss: vi.fn(),
      })
    );

    expect(selectedFields.constructionMethod).toBe(false);
    expect(html).toContain("Metodo sugerido com confianca media");
    expect(html).toContain("Sugestao revisavel; nao altera o metodo sozinha.");
  });

  it("finds field evidence only when extraction notes or assumptions reference the field", () => {
    expect(getPlanExtractFieldEvidence(reviewResult, "city")).toBe("Cidade: Salvador aparece no carimbo.");
    expect(getPlanExtractFieldEvidence(reviewResult, "builtAreaM2")).toBe("Area construida calculada por largura x profundidade.");
    expect(getPlanExtractFieldEvidence(reviewResult, "terrainWidthM")).toBeUndefined();
    expect(getPlanExtractFieldEvidence(reviewResult, "windowCount")).toBeUndefined();
  });
});
