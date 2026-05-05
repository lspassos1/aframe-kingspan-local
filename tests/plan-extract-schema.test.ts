import { describe, expect, it } from "vitest";
import { planExtractSystemPrompt, planExtractUserPrompt } from "@/lib/ai/prompts";
import { parsePlanExtractResult, planExtractResultSchema } from "@/lib/ai/plan-extract-schema";

const reviewedValue = {
  value: "Salvador",
  confidence: "high",
  source: "visible",
  requiresReview: true,
  evidence: "Cidade visivel no carimbo da prancha.",
};

const reviewedNumber = {
  value: 80,
  unit: "m2",
  confidence: "medium",
  source: "calculated",
  requiresReview: true,
  evidence: "8 m x 10 m informado nas cotas principais.",
};

describe("plan extract advanced schema", () => {
  it("parses advanced extraction blocks with evidence, questions and quantity seeds", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        summary: "Planta baixa residencial com escala parcial e ambientes principais.",
        confidence: "medium",
        extractionStatus: "partial",
        extracted: {
          city: "Salvador",
          state: "BA",
          builtAreaM2: 80,
          houseWidthM: 8,
          houseDepthM: 10,
          notes: ["Cidade visivel no carimbo da prancha."],
        },
        fieldConfidence: {
          city: "high",
          builtAreaM2: "medium",
        },
        fieldEvidence: {
          city: "Cidade visivel no carimbo da prancha.",
          builtAreaM2: "Area calculada por 8 m x 10 m.",
        },
        document: {
          type: { ...reviewedValue, value: "planta baixa" },
          pageCount: { value: 1, confidence: "high", source: "visible", requiresReview: true, evidence: "Uma folha visivel no PDF." },
        },
        scale: {
          scaleText: {
            value: "1:50",
            confidence: "low",
            source: "visible",
            requiresReview: true,
            evidence: "Texto 1:50 pouco legivel no carimbo.",
            pendingReason: "Confirmar se a escala pertence a esta prancha.",
          },
          needsReferenceQuestion: true,
        },
        location: {
          city: reviewedValue,
          state: { ...reviewedValue, value: "BA" },
        },
        building: {
          builtAreaM2: reviewedNumber,
          widthM: { ...reviewedNumber, value: 8, unit: "m" },
          depthM: { ...reviewedNumber, value: 10, unit: "m" },
        },
        lot: {
          widthM: { ...reviewedNumber, value: 10, unit: "m", evidence: "Cota frontal do lote." },
          depthM: { ...reviewedNumber, value: 20, unit: "m", evidence: "Cota lateral do lote." },
        },
        rooms: [
          {
            id: "room-1",
            name: { ...reviewedValue, value: "Sala" },
            areaM2: { ...reviewedNumber, value: 18 },
            wetArea: { value: false, confidence: "medium", source: "visible", requiresReview: true, evidence: "Ambiente sem pontos hidraulicos visiveis." },
          },
        ],
        openings: {
          doorCount: { value: 4, confidence: "medium", source: "visible", requiresReview: true, evidence: "Quatro simbolos de porta visiveis." },
          windowCount: { value: 6, confidence: "medium", source: "visible", requiresReview: true, evidence: "Seis esquadrias marcadas em planta." },
        },
        wallFinishes: {
          wetAreaWallTileM2: { ...reviewedNumber, value: 14, evidence: "Revestimento indicado em areas molhadas." },
        },
        painting: {
          internalPaintingAreaM2: { ...reviewedNumber, value: 180, evidence: "Area calculada por paredes internas." },
        },
        ceiling: {
          ceilingAreaM2: { ...reviewedNumber, value: 80, evidence: "Area de teto igual a area construida preliminar." },
          hasCeilingPlan: {
            value: false,
            confidence: "low",
            source: "visible",
            requiresReview: true,
            evidence: "Nao ha prancha de forro anexada.",
            pendingReason: "Confirmar se existe planta de forro.",
          },
        },
        structure: {
          visibleSystem: {
            value: "sem sistema estrutural definido",
            confidence: "low",
            source: "visible",
            requiresReview: true,
            evidence: "Nao ha locacao de pilares ou vigas na prancha.",
            pendingReason: "Estrutura exige revisao tecnica.",
          },
        },
        electrical: {
          estimatedByAverage: {
            value: true,
            confidence: "low",
            source: "estimated_rule",
            requiresReview: true,
            evidence: "A prancha nao contem projeto eletrico.",
            pendingReason: "Confirmar se deseja estimar pontos eletricos por media de ambiente.",
          },
        },
        fixtures: {
          toilets: { value: 1, confidence: "medium", source: "visible", requiresReview: true, evidence: "Uma bacia sanitaria desenhada no banheiro." },
          sinks: { value: 1, confidence: "medium", source: "visible", requiresReview: true, evidence: "Um lavatorio desenhado no banheiro." },
        },
        quantitySeeds: [
          {
            id: "seed-wall-area",
            category: "walls",
            description: "Area preliminar de paredes internas e externas",
            quantity: 120,
            unit: "m2",
            source: "system_calculated",
            confidence: "medium",
            requiresReview: true,
            evidence: "Calculado a partir do perimetro e pe-direito informados.",
            notes: "Nao desconta todas as aberturas.",
          },
          {
            id: "seed-electrical-average",
            category: "electrical",
            description: "Pontos eletricos estimados por media",
            quantity: 26,
            unit: "un",
            source: "rule_estimated",
            confidence: "low",
            requiresReview: true,
            pendingReason: "Confirmar estimativa de pontos eletricos por ambiente.",
            notes: "Sem projeto eletrico na prancha.",
          },
        ],
        questions: [
          {
            id: "q-scale-reference",
            question: "Qual medida real posso usar como referencia?",
            target: "scale",
            reason: "A escala esta pouco legivel.",
            requiredBeforeBudget: true,
          },
        ],
        extractionWarnings: [
          {
            code: "no-electrical-plan",
            message: "A prancha nao contem projeto eletrico.",
            severity: "warning",
            target: "electrical",
          },
        ],
        assumptions: [],
        missingInformation: ["Confirmar escala grafica."],
        warnings: ["Orcamento preliminar depende de revisao humana."],
      })
    );

    expect(result.extractionStatus).toBe("partial");
    expect(result.location?.city?.value).toBe("Salvador");
    expect(result.lot?.widthM?.value).toBe(10);
    expect(result.wallFinishes?.wetAreaWallTileM2?.value).toBe(14);
    expect(result.painting?.internalPaintingAreaM2?.value).toBe(180);
    expect(result.ceiling?.hasCeilingPlan?.pendingReason).toContain("planta de forro");
    expect(result.structure?.visibleSystem?.pendingReason).toContain("revisao tecnica");
    expect(result.fixtures?.toilets?.value).toBe(1);
    expect(result.questions?.[0]?.target).toBe("scale");
    expect(result.quantitySeeds?.map((seed) => seed.id)).toEqual(["seed-wall-area", "seed-electrical-average"]);
    expect(result.extractionWarnings?.[0]?.code).toBe("no-electrical-plan");
  });

  it("rejects AI extracted values that do not require human review", () => {
    const parsed = planExtractResultSchema.safeParse({
      version: "1.0",
      summary: "Planta com cidade visivel.",
      confidence: "high",
      extracted: { city: "Salvador", notes: [] },
      fieldConfidence: { city: "high" },
      location: {
        city: {
          value: "Salvador",
          unit: "texto",
          confidence: "high",
          evidence: "Cidade visivel no carimbo.",
          source: "visible",
          requiresReview: false,
        },
      },
      assumptions: [],
      missingInformation: [],
      warnings: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("requires pending items for low confidence and rule-estimated data", () => {
    const parsed = planExtractResultSchema.safeParse({
      version: "1.0",
      summary: "Planta sem projeto eletrico.",
      confidence: "low",
      extracted: { notes: [] },
      fieldConfidence: {},
      electrical: {
        estimatedByAverage: {
          value: true,
          confidence: "low",
          source: "estimated_rule",
          requiresReview: true,
          evidence: "A prancha nao contem projeto eletrico.",
        },
      },
      quantitySeeds: [
        {
          id: "seed-electrical",
          category: "electrical",
          description: "Pontos eletricos por media",
          quantity: 12,
          unit: "un",
          source: "rule_estimated",
          confidence: "low",
          requiresReview: true,
          notes: "Sem projeto eletrico.",
        },
      ],
      assumptions: [],
      missingInformation: [],
      warnings: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects forbidden price, composition, labor-hour and approval outputs", () => {
    expect(() =>
      parsePlanExtractResult(
        JSON.stringify({
          version: "1.0",
          summary: "Planta com tentativa de preco.",
          confidence: "medium",
          extracted: { notes: [] },
          fieldConfidence: {},
          quantitySeeds: [
            {
              id: "seed-price",
              category: "walls",
              description: "Alvenaria com preco inventado",
              quantity: 20,
              unit: "m2",
              source: "ai_visible",
              confidence: "medium",
              requiresReview: true,
              unitPriceBRL: 120,
            },
          ],
          assumptions: [],
          missingInformation: [],
          warnings: [],
        })
      )
    ).toThrow(/Forbidden AI plan extraction key/);

    expect(planExtractResultSchema.safeParse({
      version: "1.0",
      summary: "Tentativa de H/H.",
      confidence: "medium",
      extracted: { notes: [] },
      fieldConfidence: {},
      quantitySeeds: [
        {
          id: "seed-labor-hour",
          category: "labor",
          description: "Hora homem inventada",
          quantity: 8,
          unit: "h",
          source: "rule_estimated",
          confidence: "low",
          requiresReview: true,
          pendingReason: "Nao permitido.",
        },
      ],
      assumptions: [],
      missingInformation: [],
      warnings: [],
    }).success).toBe(false);
  });

  it("keeps the OpenAI prompt explicit about questions and forbidden outputs", () => {
    expect(planExtractSystemPrompt).toContain("Nao invente medida, escala, preco, H/H, consumo, perda, BDI");
    expect(planExtractSystemPrompt).toContain("Nao dimensione fundacao, estrutura, eletrica ou hidraulica");
    expect(planExtractSystemPrompt).toContain("pendingReason");
    expect(planExtractUserPrompt).toContain("questions");
    expect(planExtractUserPrompt).toContain("QuantitySeeds");
    expect(planExtractUserPrompt).toContain("cidade/UF");
    expect(planExtractUserPrompt).toContain("wallFinishes");
    expect(planExtractUserPrompt).toContain("fixtures");
  });
});
