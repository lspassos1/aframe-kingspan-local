import { describe, expect, it } from "vitest";
import { getAiPlanExtractMaxFileBytes, sanitizePlanExtractFileName, validatePlanExtractFile } from "@/lib/ai/plan-extract-request";

describe("AI plan extract request validation", () => {
  it("uses a safe default max file size when env is missing or invalid", () => {
    expect(getAiPlanExtractMaxFileBytes({})).toBe(8 * 1024 * 1024);
    expect(getAiPlanExtractMaxFileBytes({ AI_PLAN_EXTRACT_MAX_FILE_MB: "-4" })).toBe(8 * 1024 * 1024);
    expect(getAiPlanExtractMaxFileBytes({ AI_PLAN_EXTRACT_MAX_FILE_MB: "2" })).toBe(2 * 1024 * 1024);
  });

  it("rejects unsupported file types before provider calls", () => {
    const result = validatePlanExtractFile(
      {
        name: "planta.txt",
        type: "text/plain",
        size: 1200,
      },
      { AI_PLAN_EXTRACT_MAX_FILE_MB: "2" }
    );

    expect(result.valid).toBe(false);
    expect(result.status).toBe(415);
  });

  it("rejects empty and oversized files", () => {
    const env = { AI_PLAN_EXTRACT_MAX_FILE_MB: "1" };

    expect(validatePlanExtractFile({ name: "empty.png", type: "image/png", size: 0 }, env)).toMatchObject({
      valid: false,
      status: 400,
    });
    expect(validatePlanExtractFile({ name: "large.pdf", type: "application/pdf", size: 2 * 1024 * 1024 }, env)).toMatchObject({
      valid: false,
      status: 413,
    });
  });

  it("accepts supported image and PDF files", () => {
    expect(validatePlanExtractFile({ name: "planta.png", type: "image/png", size: 1024 }, { AI_PLAN_EXTRACT_MAX_FILE_MB: "1" })).toMatchObject({
      valid: true,
      mimeType: "image/png",
    });
    expect(validatePlanExtractFile({ name: "planta.pdf", type: "application/pdf", size: 1024 }, { AI_PLAN_EXTRACT_MAX_FILE_MB: "1" })).toMatchObject({
      valid: true,
      mimeType: "application/pdf",
    });
  });

  it("sanitizes file names passed to providers", () => {
    expect(sanitizePlanExtractFileName(" ../planta@@final.pdf ")).toBe(".._planta_final.pdf");
    expect(sanitizePlanExtractFileName("   ")).toBe("planta");
  });
});
