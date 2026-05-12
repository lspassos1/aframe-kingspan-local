import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createStatusCounts,
  readSinapiSyncInput,
  runSinapiSyncDryRun,
  validateSinapiDryRunRow,
} from "../scripts/sinapi-sync-monthly.mjs";

const fixturePath = join(process.cwd(), "scripts/fixtures/sinapi-monthly-dry-run-sample.json");

describe("SINAPI monthly sync dry-run", () => {
  it("validates fixture rows without enabling write mode", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const result = runSinapiSyncDryRun(input);

    expect(result).toMatchObject({
      dryRun: true,
      writeModeAvailable: false,
      importedRows: 3,
      reviewRows: 1,
      valid: true,
      source: {
        title: "SINAPI BA 2026-05 dry-run",
        state: "BA",
        referenceDate: "2026-05",
        regime: "desonerado",
      },
    });
    expect(result.statusCounts).toMatchObject({ valid: 2, zeroed: 1 });
  });

  it("fails clearly when required columns are missing", () => {
    const result = validateSinapiDryRunRow({ codigo: "SINAPI-1", descricao: "Sem preco" }, 2, "BA");

    expect(result.status).toBe("invalid");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-column", message: expect.stringContaining("preco_total") }),
        expect.objectContaining({ code: "missing-column", message: expect.stringContaining("unidade") }),
      ])
    );
  });

  it("reports status counts for pending and invalid rows", () => {
    expect(createStatusCounts(["valid", "zeroed", "missing", "invalid_unit", "out_of_region", "requires_review", "invalid"])).toEqual({
      valid: 1,
      zeroed: 1,
      missing: 1,
      requires_review: 1,
      invalid_unit: 1,
      out_of_region: 1,
      invalid: 1,
    });
  });

  it("requires source metadata before the dry-run can be considered valid", () => {
    const result = runSinapiSyncDryRun({
      source: { title: "", state: "", referenceDate: "", regime: "" },
      rows: [],
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-source-metadata", message: expect.stringContaining("title") }),
        expect.objectContaining({ code: "empty-input" }),
      ])
    );
  });

  it("keeps Supabase write credentials and write paths out of dry-run files", () => {
    const files = [
      "scripts/sinapi-sync-monthly.mjs",
      ".github/workflows/sinapi-monthly-sync-dry-run.yml",
      "scripts/fixtures/sinapi-monthly-dry-run-sample.json",
    ].map((file) => readFileSync(join(process.cwd(), file), "utf8"));

    const content = files.join("\n");
    const forbiddenCredentialName = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
    const forbiddenCredentialRole = ["service", "role"].join("_");
    const forbiddenWriteTerms = ["up" + "sert", "insert\\s+into", "update\\s+public\\.", "delete\\s+from"].join("|");
    expect(content).not.toContain(forbiddenCredentialName);
    expect(content).not.toContain(forbiddenCredentialRole);
    expect(content).not.toMatch(new RegExp(forbiddenWriteTerms, "i"));
    expect(content).toContain("--dry-run");
  });
});
