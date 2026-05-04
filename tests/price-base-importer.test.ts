import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import {
  createImportedPriceSource,
  defaultPriceBaseColumnMapping,
  importPriceBaseRows,
  parsePriceBaseCsv,
  parsePriceBaseJson,
  parsePriceBaseXlsx,
  validatePriceBaseColumnMapping,
  type PriceSource,
} from "@/lib/budget-assistant";
import { normalizeProject } from "@/lib/store/project-normalization";
import type { Project } from "@/types/project";

const source = createImportedPriceSource({
  id: "price-source-sinapi-ba-2026-05",
  type: "sinapi",
  title: "SINAPI BA maio 2026",
  supplier: "CAIXA/IBGE",
  state: "Bahia",
  city: "Cruz das Almas",
  referenceDate: "2026-05-04",
  reliability: "high",
});

describe("price base importer", () => {
  it("imports a mapped CSV row as sourced service composition", () => {
    const rows = parsePriceBaseCsv(
      [
        "codigo,descricao,unidade,preco_total,material,mao_obra,equipamento,hh,data_base,uf,cidade,etapa,tags,metodo",
        "SINAPI-123,Alvenaria de vedacao,m2,80,45,30,5,0.4,2026-05-04,BA,Cruz das Almas,alvenaria,parede;bloco,alvenaria",
      ].join("\n")
    );

    const result = importPriceBaseRows({
      rows,
      mapping: defaultPriceBaseColumnMapping,
      source,
      defaultConstructionMethod: "conventional-masonry",
    });

    expect(result.issues).toEqual([]);
    expect(result.importedRows).toBe(1);
    expect(result.reviewRows).toBe(0);
    expect(result.serviceCompositions[0]).toMatchObject({
      sourceId: source.id,
      sourceCode: "SINAPI-123",
      serviceCode: "SINAPI-123",
      constructionMethod: "conventional-masonry",
      category: "civil",
      unit: "m2",
      materialCostBRL: 45,
      laborCostBRL: 30,
      equipmentCostBRL: 5,
      directUnitCostBRL: 80,
      totalLaborHoursPerUnit: 0.4,
      confidence: "high",
      requiresReview: false,
    });
    expect(result.serviceCompositions[0].inputs).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "material", total: 45 }), expect.objectContaining({ kind: "equipment", total: 5 })])
    );
    expect(result.serviceCompositions[0].laborRoles[0]).toMatchObject({ role: "Mao de obra importada", hoursPerUnit: 0.4, total: 30 });
  });

  it("validates required mapped columns before importing rows", () => {
    const rows = parsePriceBaseCsv("descricao,unidade,preco_total\nAlvenaria,m2,80");

    expect(validatePriceBaseColumnMapping(rows, defaultPriceBaseColumnMapping)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "required-column-missing", columnKey: "sourceCode" })])
    );
    expect(
      importPriceBaseRows({
        rows,
        mapping: defaultPriceBaseColumnMapping,
        source,
        defaultConstructionMethod: "conventional-masonry",
      })
    ).toMatchObject({ importedRows: 0, serviceCompositions: [] });
  });

  it("keeps incomplete JSON rows importable but pending human review", () => {
    const rows = parsePriceBaseJson(JSON.stringify([{ codigo: "COMP-1", descricao: "Servico sem preco", unidade: "m2", etapa: "civil" }]));
    const lowReliabilitySource = createImportedPriceSource({
      id: "price-source-import-low",
      type: "manual",
      title: "Base interna incompleta",
      supplier: "Equipe local",
      state: "Bahia",
      city: "Cruz das Almas",
      referenceDate: "2026-05-04",
      reliability: "low",
    });

    const result = importPriceBaseRows({
      rows,
      mapping: defaultPriceBaseColumnMapping,
      source: lowReliabilitySource,
      defaultConstructionMethod: "conventional-masonry",
    });

    expect(result.importedRows).toBe(1);
    expect(result.reviewRows).toBe(1);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "missing-price" })]));
    expect(result.serviceCompositions[0]).toMatchObject({
      directUnitCostBRL: 0,
      confidence: "unverified",
      requiresReview: true,
    });
  });

  it("parses XLSX rows with explicit column mapping", () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      {
        Cod: "EPS-1",
        Desc: "Painel EPS monolitico",
        Un: "m²",
        Total: 120,
        Material: 85,
        Labor: 35,
        HH: 0.3,
        UF: "BA",
        Cidade: "Cruz das Almas",
        Metodo: "eps",
        Etapa: "paineis",
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Base");
    const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const rows = parsePriceBaseXlsx(data);

    const result = importPriceBaseRows({
      rows,
      mapping: {
        sourceCode: "Cod",
        description: "Desc",
        unit: "Un",
        totalUnitPrice: "Total",
        materialCostBRL: "Material",
        laborCostBRL: "Labor",
        totalLaborHoursPerUnit: "HH",
        state: "UF",
        city: "Cidade",
        constructionMethod: "Metodo",
        stage: "Etapa",
      },
      source,
      defaultConstructionMethod: "conventional-masonry",
    });

    expect(result.importedRows).toBe(1);
    expect(result.serviceCompositions[0]).toMatchObject({
      sourceCode: "EPS-1",
      constructionMethod: "monolithic-eps",
      unit: "m2",
      directUnitCostBRL: 120,
    });
  });

  it("serializes imported sources and compositions with the project JSON", () => {
    const rows = parsePriceBaseCsv("codigo,descricao,unidade,preco_total\nSINAPI-123,Alvenaria,m2,80");
    const result = importPriceBaseRows({
      rows,
      mapping: defaultPriceBaseColumnMapping,
      source,
      defaultConstructionMethod: "conventional-masonry",
    });
    const project = normalizeProject({
      ...defaultProject,
      budgetAssistant: {
        ...defaultProject.budgetAssistant,
        costSources: [source as PriceSource],
        priceSources: [source],
        serviceCompositions: result.serviceCompositions,
      },
    });
    const parsed = JSON.parse(JSON.stringify(project)) as Project;

    expect(parsed.budgetAssistant.priceSources[0]).toMatchObject({
      id: source.id,
      referenceDate: source.referenceDate,
      city: source.city,
      state: source.state,
    });
    expect(parsed.budgetAssistant.serviceCompositions[0]).toMatchObject({
      sourceId: source.id,
      serviceCode: "SINAPI-123",
      directUnitCostBRL: 80,
    });
  });
});
