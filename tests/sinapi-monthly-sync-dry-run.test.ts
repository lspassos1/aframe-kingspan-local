import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createStatusCounts,
  parseSinapiSyncArgs,
  readSinapiSyncInput,
  runSinapiSyncDryRun,
  validateSinapiDryRunRow,
} from "../scripts/sinapi-sync-monthly.mjs";

const fixturePath = join(process.cwd(), "scripts/fixtures/sinapi-monthly-dry-run-sample.json");

describe("SINAPI semiannual sync dry-run", () => {
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

  it("reports malformed null rows without throwing", () => {
    const result = runSinapiSyncDryRun({
      source: {
        title: "SINAPI BA",
        supplier: "CAIXA",
        state: "BA",
        referenceDate: "2026-05",
        regime: "desonerado",
      },
      rows: [null],
    });

    expect(result.valid).toBe(false);
    expect(result.statusCounts).toMatchObject({ invalid: 1 });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-row", message: "Row 2 must be an object." }),
        expect.objectContaining({ code: "missing-column", message: expect.stringContaining("codigo") }),
      ])
    );
  });

  it("preserves invalid row status when unit validation also fails", () => {
    const result = validateSinapiDryRunRow(
      {
        codigo: "",
        descricao: "",
        unidade: "cx",
        preco_total: 10,
        uf: "BA",
        data_base: "2026-05",
        regime: "desonerado",
      },
      2,
      "BA"
    );

    expect(result.status).toBe("invalid");
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["invalid-row", "invalid-unit"]));
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

  it("rejects malformed source reference months before write mode", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const result = runSinapiSyncDryRun({
      ...input,
      source: { ...input.source, referenceDate: "2026/05" },
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-source-reference-month", severity: "invalid" })]));
  });

  it("rejects malformed row reference months before write mode", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const result = runSinapiSyncDryRun({
      ...input,
      rows: [{ ...input.rows[0], data_base: "May-2026" }],
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-reference-month", severity: "invalid" })]));
  });

  it("rejects row reference months that do not match the monthly source", async () => {
    const input = await readSinapiSyncInput(fixturePath);
    const result = runSinapiSyncDryRun({
      ...input,
      rows: [{ ...input.rows[0], data_base: "2026-06-01" }],
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "reference-month-mismatch", severity: "invalid" })]));
  });

  it("fails clearly when --input is missing a value", () => {
    expect(() => parseSinapiSyncArgs(["--input"])).toThrow("--input requires a value.");
    expect(() => parseSinapiSyncArgs(["--input", "--json"])).toThrow("--input requires a value.");
  });

  it("keeps Supabase write credentials and write paths out of dry-run workflow and fixture", () => {
    const files = [
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

  it("runs the scheduled dry-run on the semiannual cadence", () => {
    const workflow = readFileSync(join(process.cwd(), ".github/workflows/sinapi-monthly-sync-dry-run.yml"), "utf8");

    expect(workflow).toContain('cron: "17 6 1 1,7 *"');
    expect(workflow).toContain("Semiannual SINAPI Sync Dry Run");
  });
});
