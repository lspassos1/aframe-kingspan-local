import { describe, expect, it } from "vitest";
import { sanitizeProviderErrorMessage, serializeProviderErrorsForClient } from "@/app/api/ai/plan-extract/route";

describe("plan extract route diagnostics", () => {
  it("redacts provider URLs and token-like values from safe diagnostics", () => {
    const sanitized = sanitizeProviderErrorMessage(
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
});
