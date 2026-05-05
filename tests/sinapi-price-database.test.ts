import JSZip from "jszip";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import {
  importSinapiPriceBase,
  mapSinapiCompositionToServiceComposition,
  normalizeSinapiRows,
  searchSinapiCompositions,
  sinapiImportLimits,
  validateSinapiSource,
  type SinapiSource,
} from "@/lib/sinapi";
import { normalizeProject } from "@/lib/store/project-normalization";
import type { Project } from "@/types/project";

const source: SinapiSource = {
  id: "sinapi-ba-2026-05",
  title: "SINAPI BA 2026-05",
  supplier: "CAIXA",
  state: "BA",
  city: "",
  referenceDate: "2026-05",
  regime: "desonerado",
  reliability: "high",
  notes: "Base oficial importada pelo usuario.",
};

const csvHeader = "codigo,descricao,unidade,preco_total,material,mao_obra,equipamento,hh,data_base,uf,regime,etapa,tags,metodo";

describe("SINAPI controlled price database", () => {
  it("imports CSV rows as read-only SINAPI compositions and service compositions", async () => {
    const result = await importSinapiPriceBase({
      fileName: "sinapi-ba.csv",
      data: [csvHeader, "SINAPI-123,Alvenaria de vedacao,m2,80,45,30,5,0.4,2026-05,BA,desonerado,alvenaria,parede;bloco,alvenaria"].join("\n"),
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });

    expect(result.issues).toEqual([]);
    expect(result.importedRows).toBe(1);
    expect(result.reviewRows).toBe(0);
    expect(result.statusCounts.valid).toBe(1);
    expect(result.priceSource).toMatchObject({ id: source.id, type: "sinapi", state: "Bahia", referenceDate: "2026-05" });
    expect(result.compositions[0]).toMatchObject({
      code: "SINAPI-123",
      constructionMethod: "conventional-masonry",
      category: "civil",
      unit: "m2",
      priceStatus: "valid",
      directUnitCostBRL: 80,
      totalLaborHoursPerUnit: 0.4,
      requiresReview: false,
    });
    expect(result.serviceCompositions[0]).toMatchObject({
      sourceId: source.id,
      serviceCode: "SINAPI-123",
      confidence: "high",
      requiresReview: false,
      sinapi: {
        code: "SINAPI-123",
        state: "Bahia",
        referenceDate: "2026-05",
        regime: "desonerado",
        priceStatus: "valid",
      },
    });
  });

  it("imports XLSX rows with official metadata", async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      {
        codigo: "SINAPI-200",
        descricao: "Concreto usinado",
        unidade: "m3",
        preco_total: 520,
        material: 420,
        mao_obra: 80,
        equipamento: 20,
        hh: 1.2,
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "SINAPI");
    const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;

    const result = await importSinapiPriceBase({
      fileName: "sinapi-ba.xlsx",
      data,
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });

    expect(result.importedRows).toBe(1);
    expect(result.compositions[0]).toMatchObject({ code: "SINAPI-200", unit: "m3", priceStatus: "valid", directUnitCostBRL: 520 });
    expect(result.serviceCompositions[0].laborRoles[0]).toMatchObject({ role: "Mão de obra SINAPI importada", hoursPerUnit: 1.2, total: 80 });
  });

  it("imports JSON rows and keeps zero prices pending instead of valid R$ 0", async () => {
    const result = await importSinapiPriceBase({
      fileName: "sinapi-ba.json",
      data: JSON.stringify({
        rows: [{ codigo: "SINAPI-300", descricao: "Servico zerado", unidade: "m2", preco_total: 0, uf: "BA", data_base: "2026-05", regime: "desonerado" }],
      }),
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });

    expect(result.statusCounts.zeroed).toBe(1);
    expect(result.reviewRows).toBe(1);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "zeroed-price", status: "zeroed" })]));
    expect(result.serviceCompositions[0]).toMatchObject({
      directUnitCostBRL: 0,
      confidence: "unverified",
      requiresReview: true,
      sinapi: { priceStatus: "zeroed", requiresReview: true },
    });
  });

  it("imports ZIP files in memory without filesystem persistence", async () => {
    const zip = new JSZip();
    zip.file("sinapi-a.csv", [csvHeader, "SINAPI-401,Alvenaria estrutural,m2,95,55,35,5,0.5,2026-05,BA,desonerado,alvenaria,estrutura,alvenaria"].join("\n"));
    zip.file(
      "sinapi-b.json",
      JSON.stringify([{ codigo: "SINAPI-402", descricao: "Forma de madeira", unidade: "m2", preco_total: 42, uf: "BA", data_base: "2026-05", regime: "desonerado" }])
    );
    const data = await zip.generateAsync({ type: "arraybuffer" });

    const result = await importSinapiPriceBase({
      fileName: "sinapi-ba.zip",
      data,
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });

    expect(result.importedRows).toBe(2);
    expect(result.compositions.map((composition) => composition.code)).toEqual(["SINAPI-401", "SINAPI-402"]);
  });

  it("rejects ZIP archives with too many entries before expanding all files", async () => {
    const zip = new JSZip();
    for (let index = 0; index <= sinapiImportLimits.maxZipEntries; index += 1) {
      zip.file(`sinapi-${index}.csv`, [csvHeader, `SINAPI-ZIP-${index},Servico ${index},m2,10,6,4,0,0.1,2026-05,BA,desonerado,civil,,alvenaria`].join("\n"));
    }
    const data = await zip.generateAsync({ type: "arraybuffer" });

    await expect(
      importSinapiPriceBase({
        fileName: "sinapi-too-many-files.zip",
        data,
        source,
        defaultConstructionMethod: "conventional-masonry",
        expectedState: "BA",
      })
    ).rejects.toThrow(/limite atual/);
  });

  it("classifies missing price, invalid unit, out-of-region and missing source metadata", async () => {
    const missingPrice = await importSinapiPriceBase({
      rows: [{ codigo: "SINAPI-501", descricao: "Servico sem preco", unidade: "m2", uf: "BA", data_base: "2026-05", regime: "desonerado" }],
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });
    const invalidUnit = await importSinapiPriceBase({
      rows: [{ codigo: "SINAPI-502", descricao: "Servico com unidade externa", unidade: "saco", preco_total: 10, uf: "BA", data_base: "2026-05", regime: "desonerado" }],
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });
    const outOfRegion = await importSinapiPriceBase({
      rows: [{ codigo: "SINAPI-503", descricao: "Servico de outra UF", unidade: "m2", preco_total: 10, uf: "SP", data_base: "2026-05", regime: "desonerado" }],
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });
    const invalidRowState = await importSinapiPriceBase({
      rows: [{ codigo: "SINAPI-503-B", descricao: "Servico com UF invalida", unidade: "m2", preco_total: 10, uf: "XX", data_base: "2026-05", regime: "desonerado" }],
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });
    const missingMetadata = await importSinapiPriceBase({
      rows: [{ codigo: "SINAPI-504", descricao: "Servico sem metadados", unidade: "m2", preco_total: 10 }],
      source: { id: "sinapi-missing-metadata", title: "SINAPI sem metadados" },
      defaultConstructionMethod: "conventional-masonry",
    });
    const invalidBreakdown = await importSinapiPriceBase({
      rows: [{ codigo: "SINAPI-505", descricao: "Servico contraditorio", unidade: "m2", preco_total: 50, material: 80, mao_obra: 20, uf: "BA", data_base: "2026-05", regime: "desonerado" }],
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });

    expect(missingPrice.compositions[0]).toMatchObject({ priceStatus: "missing", requiresReview: true });
    expect(invalidUnit.compositions[0]).toMatchObject({ priceStatus: "invalid_unit", unit: "lot", requiresReview: true });
    expect(outOfRegion.compositions[0]).toMatchObject({ priceStatus: "out_of_region", requiresReview: true });
    expect(invalidRowState.compositions[0]).toMatchObject({ state: "XX", priceStatus: "requires_review", requiresReview: true });
    expect(invalidRowState.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-state" })]));
    expect(missingMetadata.compositions[0]).toMatchObject({ priceStatus: "requires_review", regime: "unknown", requiresReview: true });
    expect(invalidBreakdown.compositions[0]).toMatchObject({
      priceStatus: "invalid",
      directUnitCostBRL: 100,
      requiresReview: true,
    });
    expect(invalidBreakdown.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-row", status: "invalid" })]));
    expect(missingMetadata.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-state" }),
        expect.objectContaining({ code: "missing-reference" }),
        expect.objectContaining({ code: "unknown-regime" }),
      ])
    );
  });

  it("validates SINAPI source UF, reference and regime", () => {
    expect(validateSinapiSource(source)).toMatchObject({ valid: true });
    expect(validateSinapiSource({ title: "SINAPI incompleto", state: "XX", regime: "sem dado" })).toMatchObject({
      valid: false,
      source: { state: "XX", referenceDate: "", regime: "unknown" },
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "invalid-state" }),
        expect.objectContaining({ code: "missing-reference" }),
        expect.objectContaining({ code: "unknown-regime" }),
      ]),
    });
  });

  it("searches compositions deterministically by query, UF, reference, regime and unit", () => {
    const normalized = normalizeSinapiRows(
      [
        { codigo: "SINAPI-601", descricao: "Alvenaria de vedacao", unidade: "m2", preco_total: 80, uf: "BA", data_base: "2026-05", regime: "desonerado" },
        { codigo: "SINAPI-602", descricao: "Pintura acrilica", unidade: "m2", preco_total: 40, uf: "BA", data_base: "2026-05", regime: "desonerado" },
        { codigo: "SINAPI-603", descricao: "Alvenaria de vedacao", unidade: "m2", preco_total: 120, uf: "BA", data_base: "2026-04", regime: "onerado" },
      ],
      { source, defaultConstructionMethod: "conventional-masonry", expectedState: "BA" }
    );

    const matches = searchSinapiCompositions(normalized.compositions, {
      query: "alvenaria vedacao",
      state: "BA",
      referenceDate: "2026-05",
      regime: "desonerado",
      unit: "m2",
      limit: 2,
    });

    expect(matches.map((composition) => composition.code)).toEqual(["SINAPI-601", "SINAPI-603"]);
  });

  it("maps and serializes SINAPI metadata through the current project store shape", async () => {
    const result = await importSinapiPriceBase({
      rows: [{ codigo: "SINAPI-701", descricao: "Alvenaria seriada", unidade: "m2", preco_total: 88, uf: "BA", data_base: "2026-05", regime: "desonerado" }],
      source,
      defaultConstructionMethod: "conventional-masonry",
      expectedState: "BA",
    });
    const mapped = mapSinapiCompositionToServiceComposition(result.compositions[0], source);
    const project = normalizeProject({
      ...defaultProject,
      budgetAssistant: {
        ...defaultProject.budgetAssistant,
        priceSources: [result.priceSource],
        serviceCompositions: [mapped],
      },
    });
    const parsed = JSON.parse(JSON.stringify(project)) as Project;

    expect(parsed.budgetAssistant.priceSources[0]).toMatchObject({ type: "sinapi" });
    expect(parsed.budgetAssistant.serviceCompositions[0]).toMatchObject({
      serviceCode: "SINAPI-701",
      directUnitCostBRL: 88,
      sinapi: {
        code: "SINAPI-701",
        priceStatus: "valid",
        regime: "desonerado",
        requiresReview: false,
      },
    });
  });
});
