import { describe, expect, it } from "vitest";
import { createExternalPriceDbOperationalStatus, sanitizeOperationalError } from "@/lib/pricing/price-db-operations";

describe("external price DB operational status", () => {
  it("keeps missing central DB configuration as a safe optional fallback state", () => {
    const status = createExternalPriceDbOperationalStatus({ configured: false });

    expect(status).toMatchObject({
      configured: false,
      status: "missing-config",
      centralLabel: "não configurada",
      syncLabel: "sem configuração",
      tone: "muted",
      stale: false,
    });
    expect(status.detail).toContain("importação local");
    expect(status.technicalDetail).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("reports failed sync with sanitized error details", () => {
    const status = createExternalPriceDbOperationalStatus({
      configured: true,
      latestSource: { referenceMonth: "2026-05", status: "active" },
      latestSyncRun: {
        status: "failed",
        errorMessage: "Authorization Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdef1234567890 failed at https://example.supabase.co/rest/v1",
      },
    });

    expect(status.status).toBe("sync-failed");
    expect(status.syncLabel).toBe("falha no sync");
    expect(status.tone).toBe("warning");
    expect(status.safeError).toContain("[redacted]");
    expect(status.safeError).toContain("[url]");
    expect(JSON.stringify(status)).not.toContain("example.supabase.co");
    expect(JSON.stringify(status)).not.toContain("eyJhbGci");
  });

  it("marks active references stale after the operational freshness window", () => {
    const status = createExternalPriceDbOperationalStatus({
      configured: true,
      latestSource: { referenceMonth: "2026-03", status: "active" },
      latestSyncRun: { status: "completed", finishedAt: "2026-03-05T00:00:00Z" },
      now: "2026-05-13T00:00:00Z",
      staleAfterDays: 45,
    });

    expect(status.status).toBe("stale-data");
    expect(status.syncLabel).toBe("dados antigos");
    expect(status.stale).toBe(true);
    expect(status.detail).toContain("referência está antiga");
  });

  it("reports a configured, fresh central DB as ready without approving prices", () => {
    const status = createExternalPriceDbOperationalStatus({
      configured: true,
      latestSource: { referenceMonth: "2026-05", status: "active" },
      latestSyncRun: { status: "completed", finishedAt: "2026-05-10T00:00:00Z" },
      now: "2026-05-13T00:00:00Z",
    });

    expect(status).toMatchObject({
      status: "ready",
      centralLabel: "configurada",
      syncLabel: "atualizada 2026-05",
      tone: "ok",
      stale: false,
    });
    expect(status.detail).toContain("preços ainda exigem aprovação");
  });

  it("requires an active source with a reference month before reporting ready", () => {
    const status = createExternalPriceDbOperationalStatus({
      configured: true,
      latestSource: { status: "active" },
      latestSyncRun: { status: "completed", finishedAt: "2026-05-10T00:00:00Z" },
      now: "2026-05-13T00:00:00Z",
    });

    expect(status).toMatchObject({
      status: "missing-sync",
      syncLabel: "sem registro",
      tone: "warning",
      lastReferenceMonth: "",
    });
  });

  it("does not report non-active source snapshots as ready", () => {
    const status = createExternalPriceDbOperationalStatus({
      configured: true,
      latestSource: { referenceMonth: "2026-05", status: "staging" },
      latestSyncRun: { status: "completed", finishedAt: "2026-05-10T00:00:00Z" },
      now: "2026-05-13T00:00:00Z",
    });

    expect(status.status).toBe("missing-sync");
    expect(status.detail).toContain("sem fonte ativa");
  });

  it("does not treat invalid reference months as ready", () => {
    const status = createExternalPriceDbOperationalStatus({
      configured: true,
      latestSource: { referenceMonth: "2026-13", status: "active" },
      latestSyncRun: { status: "completed", finishedAt: "2026-05-10T00:00:00Z" },
      now: "2026-05-13T00:00:00Z",
    });

    expect(status.status).toBe("missing-sync");
    expect(status.lastReferenceMonth).toBe("");
    expect(JSON.stringify(status)).not.toContain("2026-13");
  });

  it("rejects malformed reference month suffixes before ready status", () => {
    const status = createExternalPriceDbOperationalStatus({
      configured: true,
      latestSource: { referenceMonth: "2026-05-extra", status: "active" },
      latestSyncRun: { status: "completed", finishedAt: "2026-05-10T00:00:00Z" },
      now: "2026-05-13T00:00:00Z",
    });

    expect(status.status).toBe("missing-sync");
    expect(status.lastReferenceMonth).toBe("");
    expect(JSON.stringify(status)).not.toContain("2026-05-extra");
  });

  it("sanitizes secret-shaped operational errors", () => {
    const sanitized = sanitizeOperationalError(
      "SUPABASE_SERVICE_ROLE_KEY=abc123 service_role=short Authorization: Bearer token123 Bearer loose456 https://host/path apikey: verylongsecretvalue1234567890 x-api-key: short123 api_key=short456\n    at query (/repo/src/db.ts:10:3)"
    );

    expect(sanitized).toContain("[url]");
    expect(sanitized).toContain("Authorization [redacted]");
    expect(sanitized).toContain("Bearer [redacted]");
    expect(sanitized).toContain("apikey [redacted]");
    expect(sanitized).toContain("x-api-key [redacted]");
    expect(sanitized).toContain("api_key [redacted]");
    expect(sanitized).not.toContain("abc123");
    expect(sanitized).not.toContain("short");
    expect(sanitized).not.toContain("token123");
    expect(sanitized).not.toContain("loose456");
    expect(sanitized).not.toContain("/repo/src/db.ts");
    expect(sanitized).not.toContain(" at query");
  });
});
