import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  PlanExtractReview,
  getPlanExtractAdvancedHighlights,
  getPlanExtractDecisionBlocks,
  getPlanExtractFieldEvidence,
  isInvalidPlanExtractNumericDraft,
  prunePlanExtractReviewState,
  type PlanExtractCurrentValues,
} from "@/components/ai/PlanExtractReview";
import { getDefaultPlanExtractSelectedFields } from "@/lib/ai/apply-plan-extract";
import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";

const reviewResult: PlanExtractResult = {
  version: "1.0",
  summary: "Planta com cotas principais e informacoes parciais.",
  confidence: "medium",
  extractionStatus: "partial",
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
  document: {
    type: {
      value: "planta baixa",
      unit: "texto",
      confidence: "high",
      evidence: "Carimbo identifica a prancha como planta baixa.",
      source: "visible",
      requiresReview: true,
    },
  },
  scale: {
    scaleText: {
      value: "1:50",
      unit: "texto",
      confidence: "low",
      evidence: "Escala aparece pouco legivel no carimbo.",
      source: "visible",
      requiresReview: true,
      pendingReason: "Confirmar escala antes de derivar medidas.",
    },
  },
  rooms: [
    {
      id: "room-1",
      name: {
        value: "Sala",
        unit: "texto",
        confidence: "medium",
        evidence: "Texto Sala visivel no ambiente principal.",
        source: "visible",
        requiresReview: true,
      },
    },
  ],
  quantitySeeds: [
    {
      id: "seed-walls",
      category: "walls",
      description: "Area preliminar de paredes",
      quantity: 120,
      unit: "m2",
      source: "system_calculated",
      confidence: "medium",
      requiresReview: true,
      notes: "Calculado a partir das cotas principais.",
    },
  ],
  questions: [
    {
      id: "q-scale",
      question: "Qual medida real posso usar como referencia?",
      target: "scale",
      reason: "Escala grafica nao esta legivel.",
      requiredBeforeBudget: true,
    },
  ],
  extractionWarnings: [
    {
      code: "method-review",
      message: "Metodo construtivo precisa de confirmacao humana.",
      severity: "warning",
      target: "constructionMethod",
    },
  ],
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
        analysisStatus: {
          modeLabel: "Modo gratuito",
          primaryProviderLabel: "Analise rapida",
          reviewProviderLabel: "Revisao detalhada",
          cached: true,
          paidFallbackEnabled: false,
          review: {
            status: "completed",
            comparison: {
              agreements: [{ field: "city", primaryValue: "Salvador", reviewValue: "Salvador" }],
              divergences: [{ field: "houseWidthM", primaryValue: 8, reviewValue: 8.4 }],
              unresolved: [],
            },
          },
        },
        modifiedValues: {},
        questionAnswers: { "q-scale": "Usar a cota frontal de 8 m." },
        onSelectedFieldsChange: vi.fn(),
        onModifiedValuesChange: vi.fn(),
        onQuestionAnswersChange: vi.fn(),
        onApply: vi.fn(),
        onDismiss: vi.fn(),
        onBackToManual: vi.fn(),
      })
    );

    expect(html).toContain("Metodo sugerido");
    expect(html).toContain("Blocos da planta");
    expect(html).toContain("Documento e escala");
    expect(html).toContain("Ambientes");
    expect(html).toContain("Quantitativos");
    expect(html).toContain("Atual:");
    expect(html).toContain("Localizacao");
    expect(html).toContain("Area e dimensoes");
    expect(html).toContain("Ambientes");
    expect(html).toContain("Portas e janelas");
    expect(html).toContain("Antes");
    expect(html).toContain("Depois");
    expect(html).toContain("Evidência");
    expect(html).toContain("Incertezas");
    expect(html).toContain("Alertas");
    expect(html).toContain("Perguntas antes do orçamento");
    expect(html).toContain("Qual medida real posso usar como referencia?");
    expect(html).toContain("Usar a cota frontal de 8 m.");
    expect(html).toContain("Resposta registrada nesta revisao");
    expect(html).toContain("Alertas estruturados");
    expect(html).toContain("Modo gratuito");
    expect(html).toContain("Analise rapida");
    expect(html).not.toContain("Gemini");
    expect(html).not.toContain("OpenRouter");
    expect(html).toContain("1 pendências para revisão");
    expect(html).toContain("Resultado veio do cache");
    expect(html).toContain("Divergências ficam pendentes");
    expect(html).toContain("Proximo passo");
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

  it("summarizes advanced extraction blocks for the review surface", () => {
    expect(getPlanExtractAdvancedHighlights(reviewResult)).toEqual([
      { label: "Leitura", value: "Parcial", tone: "pending" },
      { label: "Ambientes", value: "1", tone: "info" },
      { label: "Quantitativos sugeridos", value: "1", tone: "pending" },
      { label: "Perguntas", value: "1", tone: "warning" },
      { label: "Alertas", value: "1", tone: "warning" },
    ]);
  });

  it("creates decision blocks for advanced review domains", () => {
    const blocks = getPlanExtractDecisionBlocks(reviewResult);

    expect(blocks.map((block) => block.title)).toEqual(["Documento e escala", "Ambientes", "Quantitativos"]);
    expect(blocks[0]).toMatchObject({
      title: "Documento e escala",
      status: "pendente",
      tone: "warning",
    });
    expect(blocks[2]?.items[0]).toMatchObject({
      label: "Area preliminar de paredes",
      value: "120 m2",
      source: "system_calculated",
    });
  });

  it("finds field evidence only when extraction notes or assumptions reference the field", () => {
    const resultWithOpeningEvidence: PlanExtractResult = {
      ...reviewResult,
      fieldEvidence: {
        state: "UF BA aparece no carimbo.",
      },
      extracted: {
        ...reviewResult.extracted,
        notes: [...(reviewResult.extracted.notes ?? []), "2 portas no pavimento terreo.", "4 janelas na fachada."],
      },
    };

    expect(getPlanExtractFieldEvidence(resultWithOpeningEvidence, "city")).toBe("Cidade: Salvador aparece no carimbo.");
    expect(getPlanExtractFieldEvidence(resultWithOpeningEvidence, "state")).toBe("UF BA aparece no carimbo.");
    expect(getPlanExtractFieldEvidence(resultWithOpeningEvidence, "builtAreaM2")).toBe("Area construida calculada por largura x profundidade.");
    expect(getPlanExtractFieldEvidence(resultWithOpeningEvidence, "doorCount")).toBe("2 portas no pavimento terreo.");
    expect(getPlanExtractFieldEvidence(resultWithOpeningEvidence, "windowCount")).toBe("4 janelas na fachada.");
    expect(getPlanExtractFieldEvidence(reviewResult, "terrainWidthM")).toBeUndefined();
    expect(getPlanExtractFieldEvidence(reviewResult, "windowCount")).toBeUndefined();
  });

  it("prunes hidden selected fields before applying a changed method scope", () => {
    const pruned = prunePlanExtractReviewState({
      fields: ["constructionMethod", "houseDepthM"],
      selectedFields: {
        constructionMethod: true,
        houseDepthM: true,
        houseWidthM: true,
        doorCount: true,
      },
      modifiedValues: {
        houseDepthM: 12,
        houseWidthM: 8,
        doorCount: 3,
      },
    });

    expect(pruned.selectedFields).toEqual({ constructionMethod: true, houseDepthM: true });
    expect(pruned.modifiedValues).toEqual({ houseDepthM: 12 });
  });

  it("blocks numeric fields with invalid draft sentinels from being reselected", () => {
    expect(isInvalidPlanExtractNumericDraft("houseWidthM", "abc")).toBe(true);
    expect(isInvalidPlanExtractNumericDraft("houseWidthM", 8)).toBe(false);
    expect(isInvalidPlanExtractNumericDraft("city", "Salvador")).toBe(false);
  });
});
