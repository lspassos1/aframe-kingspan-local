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
  it("backfills actionable legacy fields from advanced sections", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        summary: "Planta respondida com blocos avançados.",
        confidence: "medium",
        extractionStatus: "partial",
        extracted: {
          notes: ["Provider preencheu blocos avançados, mas não os campos legados."],
        },
        document: {
          title: { ...reviewedValue, value: "Residência Alfa", evidence: "Título visível no carimbo." },
        },
        location: {
          city: { ...reviewedValue, value: "Salvador" },
          state: { ...reviewedValue, value: "BA" },
        },
        lot: {
          widthM: { ...reviewedNumber, value: 12, unit: "m", evidence: "Cota frontal do lote." },
          depthM: { ...reviewedNumber, value: 24, unit: "m", evidence: "Cota lateral do lote." },
        },
        building: {
          widthM: { ...reviewedNumber, value: 8, unit: "m", evidence: "Largura da construção." },
          depthM: { ...reviewedNumber, value: 10, unit: "m", evidence: "Profundidade da construção." },
          floorHeightM: { ...reviewedNumber, value: 2.8, unit: "m", evidence: "Pé-direito anotado." },
          floors: { ...reviewedNumber, value: 1, unit: "un", evidence: "Um pavimento visível." },
        },
        openings: {
          doorCount: { value: 3, unit: "un", confidence: "medium", source: "visible", requiresReview: true, evidence: "Três portas visíveis." },
          windows: [
            {
              id: "window-1",
              type: { value: "janela", unit: "texto", confidence: "medium", source: "visible", requiresReview: true, evidence: "Janela identificada." },
            },
            {
              id: "window-2",
              type: { value: "janela", unit: "texto", confidence: "medium", source: "visible", requiresReview: true, evidence: "Janela identificada." },
            },
          ],
        },
        assumptions: [],
        missingInformation: [],
        warnings: [],
      })
    );

    expect(result.extracted).toMatchObject({
      projectName: "Residência Alfa",
      city: "Salvador",
      state: "BA",
      terrainWidthM: 12,
      terrainDepthM: 24,
      houseWidthM: 8,
      houseDepthM: 10,
      floorHeightM: 2.8,
      floors: 1,
      doorCount: 3,
      windowCount: 2,
    });
    expect(result.fieldConfidence).toMatchObject({
      projectName: "high",
      city: "high",
      terrainWidthM: "medium",
      houseWidthM: "medium",
      windowCount: "medium",
    });
    expect(result.fieldEvidence?.terrainWidthM).toBe("Cota frontal do lote.");
    expect(result.fieldEvidence?.windowCount).toBe("Quantidade derivada dos itens visíveis em windows.");
  });

  it("ignores non-integer explicit opening counts when deriving legacy fields", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        summary: "Planta com contagem fracionada de esquadrias.",
        confidence: "medium",
        extracted: {
          notes: ["Contagem explícita inválida deve ser ignorada."],
        },
        openings: {
          doorCount: { value: 2.5, unit: "un", confidence: "medium", source: "visible", requiresReview: true, evidence: "Contagem fracionada retornada pelo provider." },
          doors: [
            {
              id: "door-1",
              type: { value: "porta", unit: "texto", confidence: "medium", source: "visible", requiresReview: true, evidence: "Porta identificada." },
            },
            {
              id: "door-2",
              type: { value: "porta", unit: "texto", confidence: "medium", source: "visible", requiresReview: true, evidence: "Porta identificada." },
            },
          ],
        },
        assumptions: [],
        missingInformation: [],
        warnings: [],
      })
    );

    expect(result.extracted.doorCount).toBe(2);
    expect(result.fieldEvidence?.doorCount).toBe("Quantidade derivada dos itens visíveis em doors.");
  });

  it("ignores non-integer floor counts from advanced building data", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        summary: "Planta com pavimentos fracionados.",
        confidence: "medium",
        extracted: {
          notes: ["Pavimentos fracionados não devem quebrar a extração."],
        },
        building: {
          widthM: { ...reviewedNumber, value: 8, unit: "m", evidence: "Largura da construção." },
          depthM: { ...reviewedNumber, value: 10, unit: "m", evidence: "Profundidade da construção." },
          floors: { ...reviewedNumber, value: 1.5, unit: "un", evidence: "Valor fracionado retornado pelo provider." },
        },
        assumptions: [],
        missingInformation: [],
        warnings: [],
      })
    );

    expect(result.extracted.houseWidthM).toBe(8);
    expect(result.extracted.houseDepthM).toBe(10);
    expect(result.extracted.floors).toBeUndefined();
  });

  it("uses building lot dimensions when the lot section is absent", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        summary: "Planta com dimensões de lote no bloco de construção.",
        confidence: "medium",
        extracted: {
          notes: ["Lote informado apenas no bloco building."],
        },
        building: {
          lotWidthM: { ...reviewedNumber, value: 14, unit: "m", evidence: "Largura do lote anotada no bloco building." },
          lotDepthM: { ...reviewedNumber, value: 28, unit: "m", evidence: "Profundidade do lote anotada no bloco building." },
        },
        assumptions: [],
        missingInformation: [],
        warnings: [],
      })
    );

    expect(result.extracted.terrainWidthM).toBe(14);
    expect(result.extracted.terrainDepthM).toBe(28);
    expect(result.fieldEvidence?.terrainWidthM).toBe("Largura do lote anotada no bloco building.");
  });

  it("preserves existing confidence and evidence when explicit opening counts are backfilled", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        summary: "Planta com metadados legados e contagem avançada.",
        confidence: "medium",
        extracted: {
          notes: ["Metadados legados devem ser preservados."],
        },
        fieldConfidence: {
          doorCount: "high",
        },
        fieldEvidence: {
          doorCount: "Contagem revisada no campo legado.",
        },
        openings: {
          doorCount: { value: 3, unit: "un", confidence: "medium", source: "visible", requiresReview: true, evidence: "Três portas visíveis no bloco avançado." },
        },
        assumptions: [],
        missingInformation: [],
        warnings: [],
      })
    );

    expect(result.extracted.doorCount).toBe(3);
    expect(result.fieldConfidence.doorCount).toBe("high");
    expect(result.fieldEvidence?.doorCount).toBe("Contagem revisada no campo legado.");
  });

  it("preserves existing confidence and evidence when construction method is backfilled", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        summary: "Planta com sugestão de método no bloco avançado.",
        confidence: "medium",
        extracted: {
          notes: ["Método compatível apenas no bloco building."],
        },
        fieldConfidence: {
          constructionMethod: "high",
        },
        fieldEvidence: {
          constructionMethod: "Método revisado no campo legado.",
        },
        building: {
          constructionMethodSuggestion: {
            value: "conventional-masonry",
            unit: "texto",
            confidence: "medium",
            source: "visible",
            requiresReview: true,
            evidence: "Alvenaria sugerida pelo bloco avançado.",
          },
        },
        assumptions: [],
        missingInformation: [],
        warnings: [],
      })
    );

    expect(result.extracted.constructionMethod).toBe("conventional-masonry");
    expect(result.fieldConfidence.constructionMethod).toBe("high");
    expect(result.fieldEvidence?.constructionMethod).toBe("Método revisado no campo legado.");
  });

  it("normalizes rich legacy extracted values into actionable fields", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        summary: "Provider retornou campos legados em formato rico.",
        confidence: "medium",
        extracted: {
          city: { ...reviewedValue, value: " Salvador ", evidence: "Cidade visível no carimbo." },
          state: { ...reviewedValue, value: "BA", evidence: "UF visível no carimbo." },
          constructionMethod: {
            value: "conventional-masonry",
            unit: "texto",
            confidence: "medium",
            source: "visible",
            requiresReview: true,
            evidence: "Blocos de alvenaria indicados na legenda.",
          },
          builtAreaM2: { ...reviewedNumber, value: 83.4, evidence: "Área construída visível no quadro." },
          floors: { ...reviewedNumber, value: 1, unit: "un", evidence: "Um pavimento indicado." },
          doorCount: { ...reviewedNumber, value: 3, unit: "un", evidence: "Três portas visíveis." },
          windowCount: { ...reviewedNumber, value: 5, unit: "un", evidence: "Cinco janelas visíveis." },
          notes: ["Campos legados vieram como objetos ricos."],
        },
        assumptions: [],
        missingInformation: [],
        warnings: [],
      })
    );

    expect(result.extracted).toMatchObject({
      city: "Salvador",
      state: "BA",
      constructionMethod: "conventional-masonry",
      builtAreaM2: 83.4,
      floors: 1,
      doorCount: 3,
      windowCount: 5,
    });
    expect(result.fieldConfidence).toMatchObject({
      city: "high",
      constructionMethod: "medium",
      builtAreaM2: "medium",
      floors: "medium",
    });
    expect(result.fieldEvidence?.city).toBe("Cidade visível no carimbo.");
    expect(result.fieldEvidence?.windowCount).toBe("Cinco janelas visíveis.");
  });

  it("drops invalid rich legacy extracted values without rejecting valid fields", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        summary: "Provider retornou alguns campos legados inválidos.",
        confidence: "medium",
        extracted: {
          city: { ...reviewedValue, value: "Salvador" },
          constructionMethod: {
            value: "wood-frame",
            unit: "texto",
            confidence: "medium",
            source: "visible",
            requiresReview: true,
            evidence: "Método fora do contrato atual.",
          },
          floors: { ...reviewedNumber, value: 1.5, unit: "un", evidence: "Valor fracionado retornado pelo provider." },
          doorCount: { ...reviewedNumber, value: -1, unit: "un", evidence: "Contagem negativa inválida." },
        },
        assumptions: [],
        missingInformation: [],
        warnings: [],
      })
    );

    expect(result.extracted.city).toBe("Salvador");
    expect(result.extracted.constructionMethod).toBeUndefined();
    expect(result.extracted.floors).toBeUndefined();
    expect(result.extracted.doorCount).toBeUndefined();
  });

  it("preserves explicit metadata when normalizing rich legacy extracted values", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        summary: "Provider retornou metadados legados e metadados explícitos.",
        confidence: "medium",
        extracted: {
          city: { ...reviewedValue, value: "Salvador", confidence: "medium", evidence: "Cidade sugerida pelo provider." },
          notes: ["Metadados explícitos devem prevalecer."],
        },
        fieldConfidence: {
          city: "high",
        },
        fieldEvidence: {
          city: "Cidade revisada no campo legado.",
        },
        assumptions: [],
        missingInformation: [],
        warnings: [],
      })
    );

    expect(result.extracted.city).toBe("Salvador");
    expect(result.fieldConfidence.city).toBe("high");
    expect(result.fieldEvidence?.city).toBe("Cidade revisada no campo legado.");
  });

  it("allows advanced sections to backfill invalid rich legacy extracted values", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        summary: "Campos legados inválidos não devem bloquear backfill avançado.",
        confidence: "medium",
        extracted: {
          city: { ...reviewedValue, value: { label: "Salvador" } },
          state: { ...reviewedValue, value: "" },
          floors: { ...reviewedNumber, value: 1.5, unit: "un" },
          notes: ["Campos legados inválidos devem ser descartados."],
        },
        location: {
          city: { ...reviewedValue, value: "Salvador", evidence: "Cidade visível no bloco de localização." },
          state: { ...reviewedValue, value: "BA", evidence: "UF visível no bloco de localização." },
        },
        building: {
          floors: { ...reviewedNumber, value: 1, unit: "un", evidence: "Um pavimento visível no bloco building." },
        },
        assumptions: [],
        missingInformation: [],
        warnings: [],
      })
    );

    expect(result.extracted.city).toBe("Salvador");
    expect(result.extracted.state).toBe("BA");
    expect(result.extracted.floors).toBe(1);
    expect(result.fieldEvidence?.city).toBe("Cidade visível no bloco de localização.");
    expect(result.fieldEvidence?.floors).toBe("Um pavimento visível no bloco building.");
  });

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

  it("recovers a plan extraction object wrapped in a provider root array", () => {
    const result = parsePlanExtractResult(
      JSON.stringify([
        {
          version: "1.0",
          summary: "Planta baixa com contagens visíveis.",
          confidence: "medium",
          extracted: {
            doorCount: 2,
            windowCount: 4,
            notes: ["Resposta veio embrulhada em array."],
          },
          fieldConfidence: {
            doorCount: "medium",
            windowCount: "medium",
          },
          assumptions: [],
          missingInformation: [],
          warnings: [],
        },
      ])
    );

    expect(result.extracted.doorCount).toBe(2);
    expect(result.extracted.windowCount).toBe(4);
  });

  it("uses a clear no-content error for unrecoverable provider root arrays", () => {
    expect(() =>
      parsePlanExtractResult(
        JSON.stringify([
          { label: "porta", count: 2 },
          { label: "janela", count: 4 },
        ])
      )
    ).toThrow("AI plan extraction returned no usable content.");
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

  it("normalizes sparse provider JSON into a review-safe extraction result", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        extracted: {
          city: "Salvador",
          notes: null,
        },
        document: null,
        location: {
          city: "Salvador",
        },
        rooms: null,
        questions: [
          {
            id: "q-scale",
            question: "Qual medida posso usar como referência?",
            target: "scale",
            requiredBeforeBudget: true,
          },
          {
            id: "",
            question: "",
          },
        ],
        fieldConfidence: {
          city: "high",
          ignored: "certain",
        },
        providerMeta: {
          provider: null,
          model: null,
        },
        extraProviderKey: "ignored",
      })
    );

    expect(result).toMatchObject({
      version: "1.0",
      summary: "Extração preliminar da planta. Revise os campos antes de aplicar.",
      confidence: "low",
      extracted: {
        city: "Salvador",
        notes: [],
      },
      fieldConfidence: {
        city: "high",
      },
      assumptions: [],
      missingInformation: [],
      warnings: [],
    });
    expect(result.document).toBeUndefined();
    expect(result.location).toBeUndefined();
    expect(result.rooms).toBeUndefined();
    expect(result.providerMeta).toBeUndefined();
    expect(result.questions).toHaveLength(1);
    expect(result.questions?.[0]?.id).toBe("q-scale");
    expect(JSON.stringify(result)).not.toContain("extraProviderKey");
  });

  it("keeps assumptions-only insufficient extractions reviewable", () => {
    const result = parsePlanExtractResult(
      JSON.stringify({
        version: "1.0",
        extractionStatus: "insufficient",
        extracted: {
          notes: [],
        },
        assumptions: ["A imagem parece conter uma planta, mas não há escala legível."],
      })
    );

    expect(result).toMatchObject({
      version: "1.0",
      extractionStatus: "insufficient",
      confidence: "low",
      extracted: {
        notes: [],
      },
      assumptions: ["A imagem parece conter uma planta, mas não há escala legível."],
      missingInformation: [],
      warnings: [],
    });
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
    expect(planExtractSystemPrompt).toContain("nunca retorne array como resposta raiz");
    expect(planExtractSystemPrompt).toContain("quantidade de portas");
    expect(planExtractUserPrompt).toContain("questions");
    expect(planExtractUserPrompt).toContain("QuantitySeeds");
    expect(planExtractUserPrompt).toContain("Contagens de portas e janelas nao exigem escala");
    expect(planExtractUserPrompt).toContain("Ambientes identificados nao exigem escala");
    expect(planExtractUserPrompt).toContain("cidade/UF");
    expect(planExtractUserPrompt).toContain("wallFinishes");
    expect(planExtractUserPrompt).toContain("fixtures");
  });
});
