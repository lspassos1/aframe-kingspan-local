#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultFixturePath = path.join(repoRoot, "docs/free-cloud-ai/fixtures/synthetic-plan-benchmark.json");
const defaultFetchTimeoutMs = 30_000;
const comparableFields = [
  "city",
  "state",
  "constructionMethod",
  "terrainWidthM",
  "terrainDepthM",
  "houseWidthM",
  "houseDepthM",
  "builtAreaM2",
  "floorHeightM",
  "floors",
  "doorCount",
  "windowCount",
];

function parseArgs(argv) {
  const args = {
    mode: "dry-run",
    fixtures: defaultFixturePath,
    output: "",
    endpoint: process.env.AI_FREE_CLOUD_BENCHMARK_ENDPOINT || "http://localhost:3000/api/ai/plan-extract",
    format: "json",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.mode = "dry-run";
    else if (arg === "--real") args.mode = "real";
    else if (arg === "--fixtures") args.fixtures = path.resolve(argv[++index] || "");
    else if (arg === "--output") args.output = path.resolve(argv[++index] || "");
    else if (arg === "--endpoint") args.endpoint = argv[++index] || args.endpoint;
    else if (arg === "--format") {
      const format = argv[++index] || args.format;
      if (!["json", "markdown"].includes(format)) throw new Error(`Unsupported format "${format}". Use json or markdown.`);
      args.format = format;
    }
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage: npm run ai:free-cloud:benchmark -- [--dry-run|--real] [--output docs/free-cloud-ai/benchmark-report.md]

Default mode is --dry-run. It uses sanitized fixture outputs and performs no network calls.
Use --real only against a local/preview endpoint configured with free-cloud providers.
Protected endpoints can receive auth through AI_FREE_CLOUD_BENCHMARK_COOKIE,
AI_FREE_CLOUD_BENCHMARK_AUTH_BEARER or AI_FREE_CLOUD_BENCHMARK_AUTH_HEADER.
AI_FREE_CLOUD_BENCHMARK_TIMEOUT_MS controls real-mode request timeout. Default: 30000.
`);
}

async function loadFixtures(filePath) {
  const content = await readFile(filePath, "utf8");
  const fixtures = JSON.parse(content);
  if (!Array.isArray(fixtures)) throw new Error("Benchmark fixtures must be an array.");
  return fixtures;
}

function assertNoPaidProvider(run) {
  const error = paidProviderError(run?.provider);
  if (error) throw new Error(error);
}

function paidProviderError(provider) {
  if (provider === "openai") return "OpenAI is blocked in free-cloud benchmark runs.";
  return undefined;
}

function countExtractedFields(result, expectedFields = []) {
  const extracted = result?.extracted || {};
  const fields = expectedFields.length ? expectedFields : Object.keys(extracted);
  return fields.filter((field) => {
    const value = extracted[field];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== "";
  }).length;
}

function isSchemaValid(result) {
  return Boolean(result && result.version === "1.0" && result.extracted && typeof result.extracted === "object");
}

function readFetchTimeoutMs() {
  const value = Number(process.env.AI_FREE_CLOUD_BENCHMARK_TIMEOUT_MS);
  if (!Number.isFinite(value) || value <= 0) return defaultFetchTimeoutMs;
  return Math.round(value);
}

function createRealBenchmarkHeaders() {
  const headers = {};
  const cookie = process.env.AI_FREE_CLOUD_BENCHMARK_COOKIE?.trim();
  const bearer = process.env.AI_FREE_CLOUD_BENCHMARK_AUTH_BEARER?.trim();
  const authHeader = process.env.AI_FREE_CLOUD_BENCHMARK_AUTH_HEADER?.trim();

  if (cookie) headers.Cookie = cookie;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  else if (authHeader) headers.Authorization = authHeader;

  return headers;
}

function compareResults(primary, review) {
  if (!primary || !review) return { agreements: [], divergences: [], unresolved: [] };

  const agreements = [];
  const divergences = [];
  const unresolved = [];

  for (const field of comparableFields) {
    const primaryValue = primary.extracted?.[field];
    const reviewValue = review.extracted?.[field];
    if (primaryValue === undefined && reviewValue === undefined) continue;
    if (primaryValue === undefined || reviewValue === undefined) {
      unresolved.push({ field, primaryValue, reviewValue });
    } else if (String(primaryValue) === String(reviewValue)) {
      agreements.push({ field, primaryValue, reviewValue });
    } else {
      divergences.push({ field, primaryValue, reviewValue });
    }
  }

  return { agreements, divergences, unresolved };
}

function collectPending(result, comparison) {
  const questions = Array.isArray(result?.questions) ? result.questions.map((question) => question.question).filter(Boolean) : [];
  const missing = Array.isArray(result?.missingInformation) ? result.missingInformation : [];
  const divergenceItems = comparison.divergences.map((item) => `Divergence on ${item.field}`);
  return [...missing, ...questions, ...divergenceItems];
}

function createRunOutcome(run, fixture, seenCacheKeys) {
  assertNoPaidProvider(run);
  const cacheStatus =
    run?.cacheStatus || (run?.task === "plan-primary" ? (seenCacheKeys.has(fixture.cacheKey) ? "hit" : "miss") : "n/a");
  if (run?.task === "plan-primary") seenCacheKeys.add(fixture.cacheKey);

  if (run?.task === "text-summary") {
    return {
      task: run.task,
      provider: run.provider,
      model: run.model,
      status: run.status || "success",
      latencyMs: run.latencyMs || 0,
      schemaValid: true,
      fieldsExtracted: 0,
      cacheStatus,
      zeroCost: true,
      error: run.error,
    };
  }

  if (!run || run.status === "skipped") {
    return {
      task: run?.task || "unknown",
      provider: run?.provider || "unknown",
      model: run?.model || "",
      status: "skipped",
      latencyMs: run?.latencyMs || 0,
      schemaValid: false,
      fieldsExtracted: 0,
      cacheStatus,
      zeroCost: true,
      error: run?.error || "Provider skipped.",
    };
  }

  const schemaValid = isSchemaValid(run.result);
  return {
    task: run.task,
    provider: run.provider,
    model: run.model,
    status: schemaValid ? "success" : "failed",
    latencyMs: run.latencyMs || 0,
    schemaValid,
    fieldsExtracted: countExtractedFields(run.result, fixture.expectedFields),
    cacheStatus,
    zeroCost: true,
    error: schemaValid ? undefined : "Invalid or missing PlanExtractResult schema.",
  };
}

function runDryBenchmark(fixtures) {
  const seenCacheKeys = new Set();
  const fixtureReports = fixtures.map((fixture) => {
    const primary = fixture.dryRun?.primary;
    const review = fixture.dryRun?.review;
    const primaryOutcome = createRunOutcome(primary, fixture, seenCacheKeys);
    const reviewOutcome = createRunOutcome(review, fixture, seenCacheKeys);
    const comparison = compareResults(primary?.result, review?.result);
    const pending = collectPending(primary?.result, comparison);
    const textSummary = fixture.dryRun?.textSummary ? createRunOutcome(fixture.dryRun.textSummary, fixture, seenCacheKeys) : undefined;

    return {
      id: fixture.id,
      title: fixture.title,
      mimeType: fixture.mimeType,
      mode: "dry-run",
      primary: primaryOutcome,
      review: reviewOutcome,
      textSummary,
      comparison,
      pending,
      quantitySeeds: Array.isArray(primary?.result?.quantitySeeds) ? primary.result.quantitySeeds.length : 0,
      estimatedCostUsd: 0,
    };
  });

  return createReport("dry-run", fixtureReports);
}

async function runRealBenchmark(fixtures, endpoint) {
  const fixtureReports = [];
  for (const fixture of fixtures) {
    const form = new FormData();
    const bytes = Buffer.from(fixture.sampleFileBase64 || "", "base64");
    const file = new File([bytes], fixture.fileName || `${fixture.id}.bin`, { type: fixture.mimeType });
    form.append("file", file);

    const start = performance.now();
    let payload = {};
    let httpStatus = 0;
    const timeoutMs = readFetchTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = createRealBenchmarkHeaders();
      const response = await fetch(endpoint, {
        method: "POST",
        body: form,
        signal: controller.signal,
        ...(Object.keys(headers).length ? { headers } : {}),
      });
      httpStatus = response.status;
      payload = await response.json().catch(() => ({}));
    } catch (error) {
      payload = {
        error:
          error instanceof Error && error.name === "AbortError"
            ? `Benchmark request timed out after ${timeoutMs}ms.`
            : error instanceof Error
              ? error.message
              : "Unknown request failure.",
      };
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Math.round(performance.now() - start);
    const result = payload.result;
    const review = payload.review;
    const comparison = review?.comparison || { agreements: [], divergences: [], unresolved: [] };
    const pending = collectPending(result, comparison);
    const schemaValid = isSchemaValid(result);
    const requestSucceeded = httpStatus >= 200 && httpStatus < 300;
    const primaryProvider = payload.provider || "api";
    const primaryPaidProviderError = paidProviderError(primaryProvider);
    const schemaError = requestSucceeded && !schemaValid ? "Endpoint returned a 2xx response without a valid PlanExtractResult." : undefined;
    const reviewProvider = review?.provider || "unknown";
    const reviewPaidProviderError = paidProviderError(reviewProvider);

    fixtureReports.push({
      id: fixture.id,
      title: fixture.title,
      mimeType: fixture.mimeType,
      mode: "real",
      primary: {
        task: "plan-primary",
        provider: primaryProvider,
        model: payload.model || "",
        status: requestSucceeded && schemaValid && !primaryPaidProviderError ? "success" : "failed",
        latencyMs,
        schemaValid,
        fieldsExtracted: countExtractedFields(result, fixture.expectedFields),
        cacheStatus: payload.cached ? "hit" : "miss",
        zeroCost: !primaryPaidProviderError,
        httpStatus,
        error: primaryPaidProviderError || responseError(payload) || schemaError,
      },
      review: review
        ? {
            task: "plan-review",
            provider: reviewProvider,
            model: review.model || "",
            status: reviewPaidProviderError ? "failed" : review.status || "unknown",
            latencyMs: 0,
            schemaValid: !reviewPaidProviderError && review.status === "completed",
            fieldsExtracted: 0,
            cacheStatus: payload.cached ? "hit" : "miss",
            zeroCost: !reviewPaidProviderError,
            error: reviewPaidProviderError || review.error?.message,
          }
        : undefined,
      comparison,
      pending,
      quantitySeeds: Array.isArray(result?.quantitySeeds) ? result.quantitySeeds.length : 0,
      estimatedCostUsd: 0,
    });
  }

  return createReport("real", fixtureReports);
}

function responseError(payload) {
  if (!payload || typeof payload !== "object") return undefined;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;
  if (payload.error && typeof payload.error.message === "string") return payload.error.message;
  return undefined;
}

function createReport(mode, fixtures) {
  const providers = new Set();
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let divergenceCount = 0;
  let pendingCount = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  for (const fixture of fixtures) {
    for (const run of [fixture.primary, fixture.review, fixture.textSummary].filter(Boolean)) {
      providers.add(run.provider);
      if (run.status === "success" || run.status === "completed") successCount += 1;
      else if (run.status === "skipped") skippedCount += 1;
      else failedCount += 1;
      if (run.cacheStatus === "hit") cacheHits += 1;
      if (run.cacheStatus === "miss") cacheMisses += 1;
    }
    divergenceCount += fixture.comparison?.divergences?.length || 0;
    pendingCount += fixture.pending?.length || 0;
  }

  return {
    generatedAt: new Date().toISOString(),
    mode,
    fixtureCount: fixtures.length,
    providers: Array.from(providers).sort(),
    summary: {
      successCount,
      failedCount,
      skippedCount,
      divergenceCount,
      pendingCount,
      cacheHits,
      cacheMisses,
      estimatedCostUsd: 0,
    },
    fixtures,
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Free-cloud AI benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Summary",
    "",
    `- Fixtures: ${report.fixtureCount}`,
    `- Providers: ${report.providers.join(", ") || "none"}`,
    `- Success: ${report.summary.successCount}`,
    `- Failed: ${report.summary.failedCount}`,
    `- Skipped: ${report.summary.skippedCount}`,
    `- Divergences: ${report.summary.divergenceCount}`,
    `- Pending items: ${report.summary.pendingCount}`,
    `- Cache hits/misses: ${report.summary.cacheHits}/${report.summary.cacheMisses}`,
    `- Estimated cost USD: ${report.summary.estimatedCostUsd}`,
    "",
    "## Fixture results",
    "",
  ];

  for (const fixture of report.fixtures) {
    lines.push(`### ${fixture.title}`);
    lines.push("");
    lines.push(`- ID: ${fixture.id}`);
    lines.push(`- MIME: ${fixture.mimeType}`);
    lines.push(`- Primary: ${fixture.primary.provider} / ${fixture.primary.status} / ${fixture.primary.latencyMs}ms`);
    if (fixture.review) lines.push(`- Review: ${fixture.review.provider} / ${fixture.review.status} / ${fixture.review.error || "no error"}`);
    if (fixture.textSummary) lines.push(`- Text: ${fixture.textSummary.provider} / ${fixture.textSummary.status}`);
    lines.push(`- Fields extracted: ${fixture.primary.fieldsExtracted}`);
    lines.push(`- Quantity seeds: ${fixture.quantitySeeds}`);
    lines.push(`- Divergences: ${fixture.comparison.divergences.length}`);
    lines.push(`- Pending: ${fixture.pending.length ? fixture.pending.join("; ") : "none"}`);
    lines.push("");
  }

  lines.push("## Constraints");
  lines.push("");
  lines.push("- Dry-run mode uses only sanitized mock fixtures and performs no network calls.");
  lines.push("- Real mode posts fixture files to the configured app endpoint and must be run manually.");
  lines.push("- OpenAI remains in standby; the benchmark blocks OpenAI in free-cloud fixtures and records estimated cost as zero.");
  lines.push("- Divergences and missing data remain pending for human review.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function serializeReport(report, format) {
  if (format === "markdown") return renderMarkdown(report);
  return `${JSON.stringify(report, null, 2)}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const fixtures = await loadFixtures(args.fixtures);
  const report = args.mode === "real" ? await runRealBenchmark(fixtures, args.endpoint) : runDryBenchmark(fixtures);
  const serializedReport = serializeReport(report, args.format);

  if (args.output) {
    await mkdir(path.dirname(args.output), { recursive: true });
    await writeFile(args.output, serializedReport);
  }

  process.stdout.write(serializedReport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
