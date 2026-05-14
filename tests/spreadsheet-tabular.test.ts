import { describe, expect, it } from "vitest";
import { createXlsxBlobPartFromSheets, rowsToCsv } from "@/lib/spreadsheet/tabular";

describe("spreadsheet tabular helpers", () => {
  it("creates an XLSX blob for browser downloads", async () => {
    const blobPart = await createXlsxBlobPartFromSheets([
      {
        name: "Resumo",
        rows: [
          { Codigo: "MAT-1", Descricao: "Bloco ceramico", Total: 120 },
          { Codigo: "MAT-2", Descricao: "Argamassa", Total: 45 },
        ],
      },
    ]);

    expect(blobPart).toBeInstanceOf(Blob);
    expect((blobPart as Blob).type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect((blobPart as Blob).size).toBeGreaterThan(0);
  });

  it("keeps CSV values escaped for spreadsheet import", () => {
    expect(rowsToCsv([{ codigo: "MAT-1", descricao: "texto, com virgula", nota: 'usa "aspas"' }])).toBe(
      'codigo,descricao,nota\nMAT-1,"texto, com virgula","usa ""aspas"""'
    );
  });
});
