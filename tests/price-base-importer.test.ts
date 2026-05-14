import { DOMParser } from "@xmldom/xmldom";
import writeXlsxFile from "write-excel-file/node";
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

globalThis.DOMParser ??= DOMParser as typeof globalThis.DOMParser;

describe("price base importer", () => {
  it("imports a mapped CSV row as sourced service composition", async () => {
    const rows = await parsePriceBaseCsv(
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

  it("validates required mapped columns before importing rows", async () => {
    const rows = await parsePriceBaseCsv("descricao,unidade,preco_total\nAlvenaria,m2,80");

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

  it("parses Brazilian dot-thousand monetary values without shrinking totals", async () => {
    const rows = await parsePriceBaseCsv(
      [
        "codigo,descricao,unidade,preco_total,material,mao_obra,equipamento",
        "SINAPI-999,Servico com milhar,m2,1.234,1.000,200,34",
      ].join("\n")
    );

    const result = importPriceBaseRows({
      rows,
      mapping: defaultPriceBaseColumnMapping,
      source,
      defaultConstructionMethod: "conventional-masonry",
    });

    expect(result.serviceCompositions[0]).toMatchObject({
      materialCostBRL: 1000,
      laborCostBRL: 200,
      equipmentCostBRL: 34,
      directUnitCostBRL: 1234,
    });
  });

  it("parses semicolon-delimited CSV rows from Brazilian exports", async () => {
    const rows = await parsePriceBaseCsv(
      [
        "codigo;descricao;unidade;preco_total;material;mao_obra;equipamento",
        "SINAPI-997;Servico com separador brasileiro;m2;1.234;1.000;200;34",
      ].join("\n")
    );

    const result = importPriceBaseRows({
      rows,
      mapping: defaultPriceBaseColumnMapping,
      source,
      defaultConstructionMethod: "conventional-masonry",
    });

    expect(result.importedRows).toBe(1);
    expect(result.serviceCompositions[0]).toMatchObject({
      sourceCode: "SINAPI-997",
      directUnitCostBRL: 1234,
      materialCostBRL: 1000,
    });
  });

  it("keeps dot-decimal labor hours separate from dot-thousand money parsing", async () => {
    const rows = await parsePriceBaseCsv(
      [
        "codigo,descricao,unidade,preco_total,material,mao_obra,equipamento,hh",
        "SINAPI-998,Servico com horas decimais,m2,1.234,1.000,200,34,0.400",
      ].join("\n")
    );

    const result = importPriceBaseRows({
      rows,
      mapping: defaultPriceBaseColumnMapping,
      source,
      defaultConstructionMethod: "conventional-masonry",
    });

    expect(result.serviceCompositions[0]).toMatchObject({
      directUnitCostBRL: 1234,
      materialCostBRL: 1000,
      totalLaborHoursPerUnit: 0.4,
    });
    expect(result.serviceCompositions[0].laborRoles[0]).toMatchObject({
      hoursPerUnit: 0.4,
      totalHours: 0.4,
    });
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

  it("parses XLSX rows with explicit column mapping", async () => {
    const data = toArrayBuffer(
      await writeXlsxFile([
        ["Cod", "Desc", "Un", "Total", "Material", "Labor", "HH", "UF", "Cidade", "Metodo", "Etapa"],
        ["EPS-1", "Painel EPS monolitico", "m²", 120, 85, 35, 0.3, "BA", "Cruz das Almas", "eps", "paineis"],
      ]).toBuffer()
    );
    const rows = await parsePriceBaseXlsx(data);

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

  it("uses the first populated worksheet when an XLSX starts with a cover sheet", async () => {
    const data = toArrayBuffer(
      await writeXlsxFile([
        {
          sheet: "Capa",
          data: [["Relatorio gerado pelo fornecedor"]],
        },
        {
          sheet: "Base",
          data: [
            ["Cod", "Desc", "Un", "Total", "Material", "Labor"],
            ["MULTI-1", "Servico na segunda aba", "m2", 75, 50, 25],
          ],
        },
      ]).toBuffer()
    );
    const rows = await parsePriceBaseXlsx(data);

    const result = importPriceBaseRows({
      rows,
      mapping: {
        sourceCode: "Cod",
        description: "Desc",
        unit: "Un",
        totalUnitPrice: "Total",
        materialCostBRL: "Material",
        laborCostBRL: "Labor",
      },
      source,
      defaultConstructionMethod: "conventional-masonry",
    });

    expect(result.importedRows).toBe(1);
    expect(result.serviceCompositions[0]).toMatchObject({
      sourceCode: "MULTI-1",
      directUnitCostBRL: 75,
    });
  });

  it("serializes imported sources and compositions with the project JSON", async () => {
    const rows = await parsePriceBaseCsv("codigo,descricao,unidade,preco_total\nSINAPI-123,Alvenaria,m2,80");
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

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}
