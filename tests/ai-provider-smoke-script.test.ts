import { execFile, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/ai-plan-extract-smoke.mjs";
const pngFixture = "tests/fixtures/plan-small.png";
const childProcessTimeoutMs = 30_000;
const execFileAsync = promisify(execFile);

function runSmoke(args: string[], env: Record<string, string | undefined> = {}) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AI_LIVE_PROVIDER_SMOKE: undefined,
      OPENAI_API_KEY: undefined,
      AI_OPENAI_MODEL: undefined,
      GEMINI_API_KEY: undefined,
      GEMINI_MODEL: undefined,
      OPENROUTER_API_KEY: undefined,
      OPENROUTER_PLAN_REVIEW_MODEL: undefined,
      AI_SMOKE_AUTH_BEARER: undefined,
      AI_SMOKE_AUTH_COOKIE: undefined,
      AI_SMOKE_AUTH_HEADER: undefined,
      ...env,
    },
    encoding: "utf8",
    timeout: childProcessTimeoutMs,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

async function runSmokeAsync(args: string[], env: Record<string, string | undefined> = {}) {
  const result = await execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AI_LIVE_PROVIDER_SMOKE: undefined,
      OPENAI_API_KEY: undefined,
      AI_OPENAI_MODEL: undefined,
      GEMINI_API_KEY: undefined,
      GEMINI_MODEL: undefined,
      OPENROUTER_API_KEY: undefined,
      OPENROUTER_PLAN_REVIEW_MODEL: undefined,
      AI_SMOKE_AUTH_BEARER: undefined,
      AI_SMOKE_AUTH_COOKIE: undefined,
      AI_SMOKE_AUTH_HEADER: undefined,
      ...env,
    },
    encoding: "utf8",
    timeout: childProcessTimeoutMs,
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    json: JSON.parse(result.stdout),
  };
}

async function startJsonServer(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to allocate test server port.");

  return {
    endpoint: `http://127.0.0.1:${address.port}/api/ai/plan-extract?token=should-not-print`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function respondJson(request: IncomingMessage, response: ServerResponse, payload: unknown) {
  request.on("end", () => {
    response.writeHead(200, {
      "content-type": "application/json",
      "X-AI-Cache": "MISS",
      "X-AI-Diagnostic-Id": "diag_header_123",
    });
    response.end(JSON.stringify(payload));
  });
  request.resume();
}

const localFreeEnv = {
  AI_LIVE_PROVIDER_SMOKE: "true",
  GEMINI_API_KEY: "gemini-secret",
  GEMINI_MODEL: "gemini-test",
  OPENROUTER_API_KEY: "openrouter-secret",
  OPENROUTER_PLAN_REVIEW_MODEL: "openrouter/free",
};

describe("AI provider smoke script", () => {
  it("does not run live provider checks without the explicit guard", () => {
    const result = runSmoke(["--mode", "paid", "--file", pngFixture]);

    expect(result.status).toBe(2);
    expect(result.json).toMatchObject({
      status: "blocked",
      reason: "live-smoke-disabled",
    });
    expect(result.stdout).not.toContain("base64");
    expect(result.stdout).not.toContain("sk-");
  });

  it("fails clearly when local provider configuration is absent", () => {
    const result = runSmoke(["--mode", "paid", "--file", pngFixture], {
      AI_LIVE_PROVIDER_SMOKE: "true",
    });

    expect(result.status).toBe(3);
    expect(result.json).toMatchObject({
      status: "blocked",
      reason: "missing-provider-config",
    });
    expect(result.json.message).toContain("OPENAI_API_KEY");
    expect(result.stdout).not.toContain("sk-");
  });

  it("produces a sanitized report for a successful endpoint response", async () => {
    const receivedHeaders: IncomingMessage["headers"][] = [];
    const server = await startJsonServer((request, response) => {
      receivedHeaders.push(request.headers);
      respondJson(request, response, {
        provider: "gemini",
        model: "gemini-2.5-flash-secret-should-not-print",
        tokens: 123,
        diagnosticId: "diag_body_123",
        raw: {
          fileBase64: "data:image/png;base64,abcdefghijklmnopqrstuvwxyz1234567890",
          authorization: "Bearer abcdefghijklmnopqrstuvwxyz123456",
        },
        result: {
          version: "1.0",
          extracted: {
            city: "Curitiba",
            state: "PR",
          },
          missingInformation: [],
          questions: [],
          quantitySeeds: [],
        },
      });
    });

    try {
      const result = await runSmokeAsync(["--mode", "free-cloud", "--file", pngFixture, "--endpoint", server.endpoint, "--auth-bearer", "test-bearer-secret"], localFreeEnv);

      expect(result.json).toMatchObject({
        kind: "ai-plan-extract-smoke",
        endpoint: expect.stringContaining("/api/ai/plan-extract"),
        summary: {
          total: 1,
          success: 1,
          failed: 0,
        },
      });
      expect(result.json.endpoint).not.toContain("token=should-not-print");
      expect(result.json.runs[0]).toMatchObject({
        mode: "free-cloud",
        status: "success",
        httpStatus: 200,
        providersTried: ["gemini"],
        diagnosticId: "diag_body_123",
      });
      expect(receivedHeaders[0].authorization).toBe("Bearer test-bearer-secret");
      expect(result.stdout).not.toContain("test-bearer-secret");
      expect(result.stdout).not.toContain("gemini-2.5-flash-secret-should-not-print");
      expect(result.stdout).not.toContain("abcdefghijklmnopqrstuvwxyz1234567890");
      expect(result.stdout).not.toContain("Bearer abcdefghijklmnopqrstuvwxyz123456");
    } finally {
      await server.close();
    }
  });

  it("writes sanitized JSON reports to --output", async () => {
    const server = await startJsonServer((request, response) => {
      respondJson(request, response, {
        provider: "gemini",
        result: {
          version: "1.0",
          extracted: {},
          missingInformation: [],
          questions: [],
          quantitySeeds: [],
        },
      });
    });
    const directory = mkdtempSync(path.join(tmpdir(), "ai-provider-smoke-"));

    try {
      const outputPath = path.join(directory, "report.json");
      const { stdout } = await execFileAsync(
        process.execPath,
        [scriptPath, "--mode", "free-cloud", "--file", pngFixture, "--endpoint", server.endpoint, "--output", outputPath],
        {
          cwd: process.cwd(),
          env: { ...process.env, ...localFreeEnv },
          encoding: "utf8",
          timeout: childProcessTimeoutMs,
        }
      );
      const file = readFileSync(outputPath, "utf8");

      expect(file).toBe(stdout);
      expect(JSON.parse(file).summary.success).toBe(1);
      expect(file).not.toContain("base64");
    } finally {
      rmSync(directory, { recursive: true, force: true });
      await server.close();
    }
  });

  it("keeps the GitHub workflow manual-only and secret-safe", () => {
    const workflow = readFileSync(path.join(process.cwd(), ".github/workflows/ai-provider-smoke.yml"), "utf8");

    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).not.toContain("pull_request");
    expect(workflow).not.toContain("schedule:");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(workflow).toContain("AI_LIVE_PROVIDER_SMOKE");
  });
});
