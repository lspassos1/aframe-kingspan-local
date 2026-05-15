import { describe, expect, it } from "vitest";
import { getPlanExtractErrorPayload, serializeProviderErrorsForClient } from "@/app/api/ai/plan-extract/route";
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
    const previousMode = process.env.AI_MODE;
    process.env.AI_MODE = "free-cloud";

    try {
      const payload = getPlanExtractErrorPayload(
        new AiProviderChainError([
          {
            provider: "gemini",
            message: "Provider gemini failed at https://example.test with x-api-key=secret-token",
          },
        ]),
        { mimeType: "application/pdf" }
      );

      expect(payload).toMatchObject({
        reason: "free-pdf-provider-unavailable",
        message: "Não consegui ler este PDF agora. Exporte a primeira página como imagem ou continue manualmente.",
      });
      expect(JSON.stringify(payload)).not.toContain("example.test");
      expect(JSON.stringify(payload)).not.toContain("secret-token");
    } finally {
      if (previousMode === undefined) {
        delete process.env.AI_MODE;
      } else {
        process.env.AI_MODE = previousMode;
      }
    }
  });
});
