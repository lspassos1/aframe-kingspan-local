#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultEndpoint = "http://localhost:3000/api/ai/plan-extract";
const defaultTimeoutMs = 60_000;
const supportedModes = ["free-cloud", "paid", "both"];
const supportedFixtures = ["png", "jpg", "pdf"];
const fixturePaths = {
  png: path.join(repoRoot, "tests/fixtures/plan-small.png"),
  jpg: path.join(repoRoot, "tests/fixtures/plan-small.jpg"),
  pdf: path.join(repoRoot, "tests/fixtures/plan-small.pdf"),
};
const mimeTypesByExtension = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".webp": "image/webp",
};

class SmokeExit extends Error {
  constructor(message, code, reason) {
    super(message);
    this.name = "SmokeExit";
    this.code = code;
    this.reason = reason;
  }
}

function parseArgs(argv) {
  const args = {
    mode: "free-cloud",
    file: "",
    fixture: "",
    endpoint: defaultEndpoint,
    output: "",
    timeoutMs: defaultTimeoutMs,
    authCookie: process.env.AI_SMOKE_AUTH_COOKIE || "",
    authBearer: process.env.AI_SMOKE_AUTH_BEARER || "",
    authHeader: process.env.AI_SMOKE_AUTH_HEADER || "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") {
      const mode = argv[++index] || "";
      if (!supportedModes.includes(mode)) throw new SmokeExit(`Unsupported --mode "${mode}".`, 3, "invalid-mode");
      args.mode = mode;
    } else if (arg === "--file") {
      args.file = path.resolve(argv[++index] || "");
    } else if (arg === "--fixture") {
      const fixture = argv[++index] || "";
      if (!supportedFixtures.includes(fixture)) throw new SmokeExit(`Unsupported --fixture "${fixture}".`, 3, "invalid-fixture");
      args.fixture = fixture;
    } else if (arg === "--endpoint") {
      args.endpoint = argv[++index] || defaultEndpoint;
    } else if (arg === "--output") {
      args.output = path.resolve(argv[++index] || "");
    } else if (arg === "--timeout-ms") {
      const timeoutMs = Number(argv[++index]);
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new SmokeExit("--timeout-ms must be a positive number.", 3, "invalid-timeout");
      args.timeoutMs = Math.round(timeoutMs);
    } else if (arg === "--auth-cookie") {
      args.authCookie = argv[++index] || "";
    } else if (arg === "--auth-bearer") {
      args.authBearer = argv[++index] || "";
    } else if (arg === "--auth-header") {
      args.authHeader = argv[++index] || "";
    } else if (arg === "--json") {
      // JSON is the only output format; this flag keeps the command explicit in workflows.
    } else if (arg === "--help") {
      args.help = true;
    } else {
      throw new SmokeExit(`Unknown argument: ${arg}`, 3, "invalid-argument");
    }
  }

  if (args.fixture && args.file) throw new SmokeExit("Use either --fixture or --file, not both.", 3, "invalid-input");
  if (!args.fixture && !args.file) throw new SmokeExit("Provide --file or --fixture.", 3, "missing-file");
  if (args.fixture) args.file = fixturePaths[args.fixture];

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/ai-plan-extract-smoke.mjs --mode free-cloud --file ./tests/fixtures/plan-small.png
  node scripts/ai-plan-extract-smoke.mjs --mode paid --file ./tests/fixtures/plan-small.pdf
  node scripts/ai-plan-extract-smoke.mjs --mode both --fixture png --endpoint https://preview.example.app/api/ai/plan-extract

Required:
  AI_LIVE_PROVIDER_SMOKE=true

The script prints sanitized JSON only. It never prints API keys, base64, raw provider payloads or auth headers.
`);
}

function safeEndpoint(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[invalid-endpoint]";
  }
}

function isLocalEndpoint(value) {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(?:Bearer|Authorization|apikey|api_key|x-api-key)\b\s*[:=]?\s*[^\s,;]+/gi, "[redacted]")
    .replace(/data:[^,;\s]+;base64,[^\s,;]+/gi, "[base64]")
    .replace(/[A-Za-z0-9_-]{28,}/g, "[redacted]")
    .slice(0, 240);
}

function sanitizeToken(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9_./-]/g, "").slice(0, 80);
}

function getSizeBucket(bytes) {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 1) return "<1MB";
  if (megabytes <= 5) return "1-5MB";
  if (megabytes <= 10) return "5-10MB";
  return ">10MB";
}

function inferMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypesByExtension[extension];
  if (!mimeType) throw new SmokeExit(`Unsupported fixture extension "${extension}".`, 3, "unsupported-file");
  return mimeType;
}

function getModes(mode) {
  return mode === "both" ? ["free-cloud", "paid"] : [mode];
}

function assertLiveSmokeEnabled(env) {
  if (env.AI_LIVE_PROVIDER_SMOKE !== "true") {
    throw new SmokeExit("AI live provider smoke is disabled. Set AI_LIVE_PROVIDER_SMOKE=true for manual runs.", 2, "live-smoke-disabled");
  }
}

function missingLocalProviderConfig(mode, env) {
  const required =
    mode === "paid"
      ? ["OPENAI_API_KEY", "AI_OPENAI_MODEL"]
      : ["GEMINI_API_KEY", "GEMINI_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_PLAN_REVIEW_MODEL"];
  return required.filter((key) => !env[key]?.trim());
}

function assertProviderConfig(args, env) {
  if (!isLocalEndpoint(args.endpoint)) return;
  const missing = Array.from(new Set(getModes(args.mode).flatMap((mode) => missingLocalProviderConfig(mode, env))));
  if (missing.length > 0) {
    throw new SmokeExit(`Missing local provider configuration: ${missing.join(", ")}.`, 3, "missing-provider-config");
  }
}

function createAuthHeaders(args) {
  const headers = {};
  if (args.authCookie.trim()) headers.Cookie = args.authCookie.trim();
  if (args.authBearer.trim()) headers.Authorization = `Bearer ${args.authBearer.trim()}`;
  else if (args.authHeader.trim()) headers.Authorization = args.authHeader.trim();
  return headers;
}

function collectProviders(payload) {
  const providers = [];
  if (payload?.provider) providers.push(payload.provider);
  if (payload?.review?.provider) providers.push(payload.review.provider);
  if (Array.isArray(payload?.providers)) {
    for (const item of payload.providers) {
      if (item?.provider) providers.push(item.provider);
    }
  }
  return Array.from(new Set(providers.map(sanitizeToken).filter(Boolean)));
}

function readReason(payload, responseOk) {
  if (payload?.reason) return sanitizeText(payload.reason);
  if (payload?.code) return sanitizeText(payload.code);
  if (payload?.message) return sanitizeText(payload.message);
  return responseOk ? "ok" : "request-failed";
}

function isValidPlanResult(payload) {
  return Boolean(payload?.result?.version === "1.0" && payload.result.extracted && typeof payload.result.extracted === "object");
}

async function runSmokeMode(mode, args, file) {
  const form = new FormData();
  form.append("file", new Blob([file.bytes], { type: file.mimeType }), file.name);
  form.append("aiMode", mode);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const startedAt = performance.now();
  let response;
  let payload = {};

  try {
    response = await fetch(args.endpoint, {
      method: "POST",
      body: form,
      headers: createAuthHeaders(args),
      signal: controller.signal,
    });
    payload = await response.json().catch(() => ({}));
  } catch (error) {
    return {
      mode,
      status: "failed",
      reason: error?.name === "AbortError" ? `timed-out-after-${args.timeoutMs}ms` : sanitizeText(error instanceof Error ? error.message : String(error)),
      durationMs: Math.round(performance.now() - startedAt),
      providersTried: [],
      httpStatus: 0,
    };
  } finally {
    clearTimeout(timeout);
  }

  const schemaValid = isValidPlanResult(payload);
  const status = response.ok && schemaValid ? "success" : "failed";
  return {
    mode,
    status,
    reason: readReason(payload, response.ok),
    durationMs: Math.round(performance.now() - startedAt),
    providersTried: collectProviders(payload),
    httpStatus: response.status,
    cache: sanitizeToken(response.headers.get("X-AI-Cache") || ""),
    diagnosticId: sanitizeToken(payload?.diagnosticId || response.headers.get("X-AI-Diagnostic-Id") || ""),
    reviewStatus: sanitizeToken(payload?.review?.status || ""),
    schemaValid,
  };
}

async function readSmokeFile(filePath) {
  const bytes = await readFile(filePath);
  return {
    path: path.relative(repoRoot, filePath),
    name: path.basename(filePath),
    mimeType: inferMimeType(filePath),
    sizeBytes: bytes.byteLength,
    sizeBucket: getSizeBucket(bytes.byteLength),
    bytes,
  };
}

async function writeReport(report, outputPath) {
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) await writeFile(outputPath, serialized, "utf8");
  process.stdout.write(serialized);
}

async function createFatalReport(args, error) {
  const report = {
    kind: "ai-plan-extract-smoke",
    generatedAt: new Date().toISOString(),
    endpoint: safeEndpoint(args?.endpoint || defaultEndpoint),
    status: "blocked",
    reason: error instanceof SmokeExit ? error.reason : "unexpected-error",
    message: sanitizeText(error instanceof Error ? error.message : String(error)),
    runs: [],
  };
  await writeReport(report, args?.output || "");
  return error instanceof SmokeExit ? error.code : 1;
}

export async function runAiPlanExtractSmoke(argv = process.argv.slice(2), env = process.env) {
  let args;
  try {
    args = parseArgs(argv);
    if (args.help) {
      printHelp();
      return 0;
    }
    assertLiveSmokeEnabled(env);
    assertProviderConfig(args, env);
    const file = await readSmokeFile(args.file);
    const runs = [];
    for (const mode of getModes(args.mode)) {
      runs.push(await runSmokeMode(mode, args, file));
    }
    const failed = runs.filter((run) => run.status !== "success").length;
    const report = {
      kind: "ai-plan-extract-smoke",
      generatedAt: new Date().toISOString(),
      endpoint: safeEndpoint(args.endpoint),
      live: true,
      file: {
        path: file.path,
        name: file.name,
        mimeType: file.mimeType,
        sizeBucket: file.sizeBucket,
      },
      summary: {
        total: runs.length,
        success: runs.length - failed,
        failed,
      },
      runs,
    };
    await writeReport(report, args.output);
    return failed > 0 ? 1 : 0;
  } catch (error) {
    return createFatalReport(args, error);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAiPlanExtractSmoke()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(async (error) => {
      process.exitCode = await createFatalReport(undefined, error);
    });
}
