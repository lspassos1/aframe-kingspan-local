import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/free-cloud-ai-benchmark.mjs";
const fixturePath = "docs/free-cloud-ai/fixtures/synthetic-plan-benchmark.json";
const execFileAsync = promisify(execFile);

function runBenchmark(args: string[] = []) {
  const output = execFileSync(process.execPath, [scriptPath, "--dry-run", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return JSON.parse(output);
}

async function startJsonServer(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to allocate test server port.");

  return {
    endpoint: `http://127.0.0.1:${address.port}/api/ai/plan-extract`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function respondJson(request: IncomingMessage, response: ServerResponse, payload: unknown) {
  request.resume();
  request.on("end", () => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  });
}

function validPlanPayload() {
  return {
    provider: "gemini",
    model: "gemini-2.5-flash",
    result: {
      version: "1.0",
      extracted: {
        city: "Curitiba",
        state: "PR",
        builtAreaM2: 96,
      },
      missingInformation: [],
      questions: [],
      quantitySeeds: [],
    },
  };
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

  it("writes --output using the selected format without changing stdout serialization", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "free-cloud-benchmark-"));
    try {
      const jsonPath = path.join(directory, "benchmark.json");
      const jsonStdout = execFileSync(process.execPath, [scriptPath, "--dry-run", "--output", jsonPath], {
        cwd: process.cwd(),
        encoding: "utf8",
      });
      const jsonFile = readFileSync(jsonPath, "utf8");
      expect(jsonFile).toBe(jsonStdout);
      expect(JSON.parse(jsonFile).summary.estimatedCostUsd).toBe(0);

      const markdownPath = path.join(directory, "benchmark.md");
      const markdownStdout = execFileSync(process.execPath, [scriptPath, "--dry-run", "--format", "markdown", "--output", markdownPath], {
        cwd: process.cwd(),
        encoding: "utf8",
      });
      const markdownFile = readFileSync(markdownPath, "utf8");
      expect(markdownFile).toBe(markdownStdout);
      expect(markdownFile).toContain("# Free-cloud AI benchmark");
      expect(markdownFile).toContain("Estimated cost USD: 0");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("passes optional auth headers to real benchmark endpoints", async () => {
    const receivedHeaders: IncomingMessage["headers"][] = [];
    const server = await startJsonServer((request, response) => {
      receivedHeaders.push(request.headers);
      respondJson(request, response, validPlanPayload());
    });

    try {
      const { stdout } = await execFileAsync(process.execPath, [scriptPath, "--real", "--endpoint", server.endpoint], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          AI_FREE_CLOUD_BENCHMARK_COOKIE: "__session=test-session",
          AI_FREE_CLOUD_BENCHMARK_AUTH_BEARER: "test-bearer",
          AI_FREE_CLOUD_BENCHMARK_TIMEOUT_MS: "5000",
        },
      });
      const report = JSON.parse(stdout);

      expect(report.fixtures.every((fixture: { primary: { status: string } }) => fixture.primary.status === "success")).toBe(true);
      expect(receivedHeaders.length).toBe(report.fixtureCount);
      expect(receivedHeaders[0].cookie).toContain("__session=test-session");
      expect(receivedHeaders[0].authorization).toBe("Bearer test-bearer");
    } finally {
      await server.close();
    }
  });

  it("marks real benchmark responses without a valid extraction schema as failed", async () => {
    const server = await startJsonServer((request, response) => {
      respondJson(request, response, { provider: "gemini", model: "gemini-2.5-flash", result: { version: "1.0" } });
    });

    try {
      const { stdout } = await execFileAsync(process.execPath, [scriptPath, "--real", "--endpoint", server.endpoint], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, AI_FREE_CLOUD_BENCHMARK_TIMEOUT_MS: "5000" },
      });
      const report = JSON.parse(stdout);

      expect(report.fixtures.every((fixture: { primary: { status: string; schemaValid: boolean; error: string } }) => fixture.primary.status === "failed")).toBe(
        true
      );
      expect(report.fixtures[0].primary.schemaValid).toBe(false);
      expect(report.fixtures[0].primary.error).toContain("valid PlanExtractResult");
    } finally {
      await server.close();
    }
  });

  it("returns a clear timeout error for real benchmark requests that do not complete", async () => {
    const server = await startJsonServer((request) => {
      request.resume();
    });

    try {
      const { stdout } = await execFileAsync(process.execPath, [scriptPath, "--real", "--endpoint", server.endpoint], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, AI_FREE_CLOUD_BENCHMARK_TIMEOUT_MS: "20" },
      });
      const report = JSON.parse(stdout);

      expect(report.fixtures[0].primary.status).toBe("failed");
      expect(report.fixtures[0].primary.error).toContain("timed out after 20ms");
    } finally {
      await server.close();
    }
  });
});
