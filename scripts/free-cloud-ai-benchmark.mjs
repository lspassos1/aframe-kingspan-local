#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultFixturePath = path.join(repoRoot, "docs/free-cloud-ai/fixtures/synthetic-plan-benchmark.json");
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
    else if (arg === "--format") args.format = argv[++index] || args.format;
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage: npm run ai:free-cloud:benchmark -- [--dry-run|--real] [--output docs/free-cloud-ai/benchmark.md]

Default mode is --dry-run. It uses sanitized fixture outputs and performs no network calls.
Use --real only against a local/preview endpoint configured with free-cloud providers.
`);
}

async function loadFixtures(filePath) {
  const content = await readFile(filePath, "utf8");
  const fixtures = JSON.parse(content);
  if (!Array.isArray(fixtures)) throw new Error("Benchmark fixtures must be an array.");
  return fixtures;
}

function assertNoPaidProvider(run) {
  if (run?.provider === "openai") {
    throw new Error("OpenAI is blocked in free-cloud benchmark fixtures.");
  }
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
    let status = "failed";
    let httpStatus = 0;
    try {
      const response = await fetch(endpoint, { method: "POST", body: form });
      httpStatus = response.status;
      payload = await response.json().catch(() => ({}));
      status = response.ok ? "success" : "failed";
    } catch (error) {
      payload = { error: error instanceof Error ? error.message : "Unknown request failure." };
    }

    const latencyMs = Math.round(performance.now() - start);
    const result = payload.result;
    const review = payload.review;
    const comparison = review?.comparison || { agreements: [], divergences: [], unresolved: [] };
    const pending = collectPending(result, comparison);

    fixtureReports.push({
      id: fixture.id,
      title: fixture.title,
      mimeType: fixture.mimeType,
      mode: "real",
      primary: {
        task: "plan-primary",
        provider: payload.provider || "api",
        model: payload.model || "",
        status,
        latencyMs,
        schemaValid: isSchemaValid(result),
        fieldsExtracted: countExtractedFields(result, fixture.expectedFields),
        cacheStatus: payload.cached ? "hit" : "miss",
        zeroCost: true,
        httpStatus,
        error: responseError(payload),
      },
      review: review
        ? {
            task: "plan-review",
            provider: review.provider || "unknown",
            model: review.model || "",
            status: review.status || "unknown",
            latencyMs: 0,
            schemaValid: review.status === "completed",
            fieldsExtracted: 0,
            cacheStatus: payload.cached ? "hit" : "miss",
            zeroCost: true,
            error: review.error?.message,
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const fixtures = await loadFixtures(args.fixtures);
  const report = args.mode === "real" ? await runRealBenchmark(fixtures, args.endpoint) : runDryBenchmark(fixtures);

  if (args.output) {
    await mkdir(path.dirname(args.output), { recursive: true });
    await writeFile(args.output, renderMarkdown(report));
  }

  if (args.format === "markdown") console.log(renderMarkdown(report));
  else console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
