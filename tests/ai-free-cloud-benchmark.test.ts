import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/free-cloud-ai-benchmark.mjs";
const fixturePath = "docs/free-cloud-ai/fixtures/synthetic-plan-benchmark.json";

function runBenchmark(args: string[] = []) {
  const output = execFileSync(process.execPath, [scriptPath, "--dry-run", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return JSON.parse(output);
}

describe("free-cloud benchmark harness", () => {
  it("runs dry-run fixtures without network access or paid providers", () => {
    const report = runBenchmark();

    expect(report.mode).toBe("dry-run");
    expect(report.fixtureCount).toBe(2);
    expect(report.providers).toEqual(["gemini", "groq", "openrouter"]);
    expect(report.summary.estimatedCostUsd).toBe(0);
    expect(JSON.stringify(report)).not.toContain("openai");
  });

  it("reports comparison divergences, pending items and PDF review skip states", () => {
    const report = runBenchmark();
    const rectangular = report.fixtures.find((fixture: { id: string }) => fixture.id === "synthetic-rectangular-house");
    const pdf = report.fixtures.find((fixture: { id: string }) => fixture.id === "synthetic-pdf-plan");

    expect(rectangular.comparison.divergences).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "builtAreaM2", primaryValue: 96, reviewValue: 98 })])
    );
    expect(rectangular.pending).toEqual(expect.arrayContaining(["Divergence on builtAreaM2"]));
    expect(pdf.review).toMatchObject({
      provider: "openrouter",
      status: "skipped",
      error: expect.stringContaining("application/pdf"),
    });
    expect(report.summary.divergenceCount).toBeGreaterThan(0);
    expect(report.summary.pendingCount).toBeGreaterThan(0);
  });

  it("keeps fixtures sanitized and writes markdown reports", () => {
    const fixtures = readFileSync(fixturePath, "utf8");
    expect(fixtures).not.toMatch(/api[_-]?key|secret|cliente|client plan/i);

    const markdown = execFileSync(process.execPath, [scriptPath, "--dry-run", "--format", "markdown"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(markdown).toContain("# Free-cloud AI benchmark");
    expect(markdown).toContain("Estimated cost USD: 0");
    expect(markdown).toContain("OpenAI remains in standby");
  });
});
