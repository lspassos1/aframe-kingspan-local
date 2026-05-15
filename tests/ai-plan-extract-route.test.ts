import { describe, expect, it } from "vitest";
import { getPlanExtractErrorPayload, readRequestedPlanExtractMode, serializeProviderErrorsForClient } from "@/app/api/ai/plan-extract/route";
import { AiProviderChainError } from "@/lib/ai/errors";
import { sanitizeAiDiagnosticMessage } from "@/lib/ai/safe-errors";

describe("plan extract route diagnostics", () => {
  it("redacts provider URLs and token-like values from safe diagnostics", () => {
    const sanitized = sanitizeAiDiagnosticMessage(
      "Provider failed at https://example.test/path with Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456 and x-api-key=short-key"
    );

    expect(sanitized).toContain("[url]");
    expect(sanitized).toContain("[redacted]");
    expect(sanitized).not.toContain("example.test");
    expect(sanitized).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(sanitized).not.toContain("short-key");
  });

  it("sanitizes provider chain errors before returning them to the client", () => {
    const errors = serializeProviderErrorsForClient([
      {
        provider: "gemini",
        message: "Provider gemini failed at https://generativelanguage.googleapis.com/v1beta with apikey=secret-token",
      },
    ]);

    expect(errors).toEqual([
      {
        provider: "gemini",
        message: "Provider gemini failed at [url] with [redacted]",
      },
    ]);
  });

  it("returns a specific recovery reason when free PDF extraction providers fail", () => {
    const payload = getPlanExtractErrorPayload(
      new AiProviderChainError([
        {
          provider: "gemini",
          message: "Provider gemini failed at https://example.test with x-api-key=secret-token",
        },
      ]),
      { mimeType: "application/pdf", env: { AI_MODE: "free-cloud" } }
    );

    expect(payload).toMatchObject({
      reason: "free-pdf-provider-unavailable",
      message: "Não consegui ler este PDF agora. Exporte a primeira página como imagem ou continue manualmente.",
    });
    expect(JSON.stringify(payload)).not.toContain("example.test");
    expect(JSON.stringify(payload)).not.toContain("secret-token");
  });

  it("reads only the explicit supported plan extraction modes from form data", () => {
    const freeForm = new FormData();
    freeForm.set("aiMode", "free-cloud");
    const paidForm = new FormData();
    paidForm.set("aiMode", "paid");
    const invalidForm = new FormData();
    invalidForm.set("aiMode", "openai");

    expect(readRequestedPlanExtractMode(freeForm)).toBe("free-cloud");
    expect(readRequestedPlanExtractMode(paidForm)).toBe("paid");
    expect(readRequestedPlanExtractMode(invalidForm)).toBe("free-cloud");
    expect(readRequestedPlanExtractMode(null)).toBe("free-cloud");
  });
});
