#!/usr/bin/env node

const DEFAULT_REPO = "lspassos1/aframe-kingspan-local";
const GITHUB_API_VERSION = "2022-11-28";
const MAX_SLACK_BLOCK_TEXT = 2900;

function stripDiacritics(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(value) {
  return stripDiacritics(value).toLowerCase();
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

export function extractIssueRefs(text = "") {
  const refs = [];
  const pattern = /\brefs\s+#(\d+)/gi;
  for (const match of String(text).matchAll(pattern)) {
    refs.push(Number(match[1]));
  }
  return uniqueSorted(refs);
}

export function findForbiddenClosingRefs(text = "") {
  const refs = [];
  const pattern = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
  for (const match of String(text).matchAll(pattern)) {
    refs.push(Number(match[1]));
  }
  return uniqueSorted(refs);
}

export function classifyIssue(issue) {
  const searchable = normalizeText(`${issue.title ?? ""}\n${issue.body ?? ""}`);

  if (issue.number >= 122 && issue.number <= 133) {
    return "Design Reset / Takeoff Assistido por IA";
  }
  if (searchable.includes("design reset") || searchable.includes("takeoff") || searchable.includes("ux recovery")) {
    return "Design Reset / Takeoff Assistido por IA";
  }
  if (searchable.includes("bug") || searchable.includes("erro") || searchable.includes("falha") || searchable.includes("regressao")) {
    return "Bugs reais";
  }
  if (searchable.includes("slack") || searchable.includes("github review") || searchable.includes("bridge") || searchable.includes("infra")) {
    return "Infraestrutura / Slack / GitHub Review Bridge";
  }
  if (searchable.includes("debito") || searchable.includes("tech debt") || searchable.includes("refactor")) {
    return "Débito técnico";
  }
  if (searchable.includes("obsoleto") || searchable.includes("antigo")) {
    return "Issues antigas possivelmente obsoletas";
  }
  if (searchable.includes("decisao") || searchable.includes("lucas") || searchable.includes("aprovar")) {
    return "Issues que dependem de decisão de Lucas";
  }
  return "Issues que dependem de decisão de Lucas";
}

export function parseLucasReview(body = "") {
  if (!String(body).includes("Lucas Review")) {
    return null;
  }

  const status = String(body).match(/^\s*Status:\s*(.+?)\s*$/im)?.[1]?.trim() || "sem status";
  const normalized = normalizeText(status).replace(/[-_]+/g, " ");

  let severity = "informativo";
  if (normalized.includes("bloqueado")) {
    severity = "bloqueado";
  } else if (normalized.includes("nao aprovado")) {
    severity = "não aprovado";
  } else if (normalized.includes("aprovado para merge manual")) {
    severity = "aprovado para merge manual";
  } else if (normalized.includes("aprovado para continuar")) {
    severity = "aprovado para continuar";
  } else if (normalized.includes("aprovado com ajustes")) {
    severity = "aprovado com ajustes";
  }

  return { status, severity };
}

export function latestLucasReview(entries = []) {
  const reviews = entries
    .map((entry) => {
      const parsed = parseLucasReview(entry.body);
      if (!parsed) return null;
      return {
        ...parsed,
        author: entry.user?.login || entry.author?.login || "unknown",
        createdAt: entry.created_at || entry.submitted_at || entry.createdAt || "",
        url: entry.html_url || entry.url || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return reviews[0] || null;
}

export function summarizeChecks({ checkRuns = [], statuses = [] } = {}) {
  const failedRuns = checkRuns.filter((run) => ["failure", "timed_out", "cancelled", "action_required"].includes(run.conclusion));
  const pendingRuns = checkRuns.filter((run) => run.status !== "completed" || !run.conclusion);
  const failedStatuses = statuses.filter((status) => ["failure", "error"].includes(status.state));
  const pendingStatuses = statuses.filter((status) => ["pending"].includes(status.state));
  const total = checkRuns.length + statuses.length;

  if (failedRuns.length || failedStatuses.length) {
    return {
      state: "failed",
      label: `falhando (${failedRuns.length + failedStatuses.length}/${total || "?"})`,
    };
  }
  if (pendingRuns.length || pendingStatuses.length) {
    return {
      state: "pending",
      label: `pendente (${pendingRuns.length + pendingStatuses.length}/${total || "?"})`,
    };
  }
  if (total > 0) {
    return { state: "success", label: `verde (${total})` };
  }
  return { state: "unknown", label: "sem checks detectados" };
}

function formatPrLine(pr) {
  const issueRefs = extractIssueRefs(pr.body || "");
  const forbiddenRefs = findForbiddenClosingRefs(pr.body || "");
  const draft = pr.draft ? "draft" : "open";
  const refs = issueRefs.length ? `Refs #${issueRefs.join(", #")}` : "sem Refs";
  const forbidden = forbiddenRefs.length ? ` ALERTA: closing ref #${forbiddenRefs.join(", #")}` : "";
  const lucas = pr.lucasReview ? `Lucas: ${pr.lucasReview.severity}` : "Lucas: sem review novo";
  const checks = pr.checkSummary?.label || "checks n/d";

  return `• #${pr.number} ${draft} · ${pr.title} · base ${pr.base?.ref || pr.baseRefName || "?"} · ${checks} · ${lucas} · ${refs}${forbidden}`;
}

function formatIssueLine(issue, prCoverage) {
  const coveredBy = prCoverage.get(issue.number) || [];
  const coverage = coveredBy.length ? `coberto por PR #${coveredBy.join(", #")}` : "sem PR aberto mapeado";
  return `• #${issue.number} ${issue.title} · ${coverage}`;
}

export function buildSlackReport({ repo = DEFAULT_REPO, generatedAt = new Date(), runUrl = "", issues = [], pullRequests = [] }) {
  const prCoverage = new Map();
  for (const pr of pullRequests) {
    for (const issueNumber of extractIssueRefs(pr.body || "")) {
      const current = prCoverage.get(issueNumber) || [];
      current.push(pr.number);
      prCoverage.set(issueNumber, current);
    }
  }

  const groupedIssues = new Map();
  for (const issue of issues) {
    const group = classifyIssue(issue);
    const current = groupedIssues.get(group) || [];
    current.push(issue);
    groupedIssues.set(group, current);
  }

  const blockedPrs = pullRequests.filter((pr) => ["bloqueado", "não aprovado"].includes(pr.lucasReview?.severity));
  const manualMergePrs = pullRequests.filter((pr) => pr.lucasReview?.severity === "aprovado para merge manual");
  const failingPrs = pullRequests.filter((pr) => pr.checkSummary?.state === "failed");
  const closingRefPrs = pullRequests.filter((pr) => findForbiddenClosingRefs(pr.body || "").length);
  const orphanIssues = issues.filter((issue) => !(prCoverage.get(issue.number) || []).length);

  const lines = [
    `*GitHub triage hourly — ${repo}*`,
    `Gerado: ${generatedAt.toISOString()}`,
    runUrl ? `Run: ${runUrl}` : "",
    "",
    `*Resumo*`,
    `• Issues abertas: ${issues.length}`,
    `• PRs abertos: ${pullRequests.length}`,
    `• PRs bloqueados/não aprovados por Lucas: ${blockedPrs.length}`,
    `• PRs aprovados para merge manual: ${manualMergePrs.length}`,
    `• PRs com checks falhando: ${failingPrs.length}`,
    `• PRs com closing refs proibidos: ${closingRefPrs.length}`,
    "",
    `*Atenção agora*`,
  ].filter(Boolean);

  if (!blockedPrs.length && !failingPrs.length && !closingRefPrs.length) {
    lines.push("• Nenhum bloqueio automático detectado. Seguir a ordem da stack e aguardar decisão de Lucas.");
  } else {
    for (const pr of [...blockedPrs, ...failingPrs, ...closingRefPrs].slice(0, 8)) {
      lines.push(formatPrLine(pr));
    }
  }

  lines.push("", "*PRs abertos*");
  if (pullRequests.length) {
    pullRequests.slice(0, 12).forEach((pr) => lines.push(formatPrLine(pr)));
  } else {
    lines.push("• Nenhum PR aberto.");
  }

  lines.push("", "*Issues abertas por grupo*");
  for (const [group, groupIssues] of groupedIssues) {
    lines.push(`_${group}_ (${groupIssues.length})`);
    groupIssues.slice(0, 8).forEach((issue) => lines.push(formatIssueLine(issue, prCoverage)));
  }

  if (orphanIssues.length) {
    lines.push("", "*Issues sem PR aberto mapeado*");
    orphanIssues.slice(0, 10).forEach((issue) => lines.push(`• #${issue.number} ${issue.title}`));
  }

  lines.push("", "_Automação informativa: não marca ready, não faz merge, não fecha issues e não usa Closes._");

  return lines.join("\n");
}

export function buildSlackPayload(reportText) {
  const chunks = [];
  let remaining = reportText;
  while (remaining.length > MAX_SLACK_BLOCK_TEXT) {
    const splitAt = remaining.lastIndexOf("\n", MAX_SLACK_BLOCK_TEXT);
    const index = splitAt > 500 ? splitAt : MAX_SLACK_BLOCK_TEXT;
    chunks.push(remaining.slice(0, index));
    remaining = remaining.slice(index).trimStart();
  }
  if (remaining) chunks.push(remaining);

  return {
    text: reportText.split("\n").slice(0, 12).join("\n"),
    blocks: chunks.slice(0, 8).map((chunk) => ({
      type: "section",
      text: {
        type: "mrkdwn",
        text: chunk,
      },
    })),
  };
}

async function fetchJson(path, { token, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${path} returned ${response.status}`);
  }

  return response.json();
}

async function fetchAllPages(path, options) {
  const results = [];
  for (let page = 1; page <= 10; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const rows = await fetchJson(`${path}${separator}per_page=100&page=${page}`, options);
    results.push(...rows);
    if (!Array.isArray(rows) || rows.length < 100) break;
  }
  return results;
}

async function collectTriage({ repo, token }) {
  const [issueRows, pullRequests] = await Promise.all([
    fetchAllPages(`/repos/${repo}/issues?state=open`, { token }),
    fetchAllPages(`/repos/${repo}/pulls?state=open`, { token }),
  ]);
  const issues = issueRows.filter((issue) => !issue.pull_request);

  const enrichedPullRequests = await Promise.all(
    pullRequests.map(async (pr) => {
      const [comments, reviews, checkRunsResponse, combinedStatus] = await Promise.all([
        fetchAllPages(`/repos/${repo}/issues/${pr.number}/comments`, { token }),
        fetchAllPages(`/repos/${repo}/pulls/${pr.number}/reviews`, { token }),
        fetchJson(`/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`, { token }),
        fetchJson(`/repos/${repo}/commits/${pr.head.sha}/status`, { token }),
      ]);

      const checkRuns = checkRunsResponse.check_runs || [];
      const statuses = combinedStatus.statuses || [];
      return {
        ...pr,
        lucasReview: latestLucasReview([...comments, ...reviews]),
        checkSummary: summarizeChecks({ checkRuns, statuses }),
      };
    })
  );

  return { issues, pullRequests: enrichedPullRequests };
}

async function postSlack(webhookUrl, payload, fetchImpl = fetch) {
  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}`);
  }
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REVIEW_REPO || DEFAULT_REPO;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_REVIEW_TOKEN;
  const webhookUrl = process.env.SLACK_TRIAGE_WEBHOOK_URL;
  const dryRun = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");
  const runUrl = process.env.GITHUB_RUN_URL || "";

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN or GH_TOKEN.");
  }

  const triage = await collectTriage({ repo, token });
  const report = buildSlackReport({
    repo,
    generatedAt: new Date(),
    runUrl,
    issues: triage.issues,
    pullRequests: triage.pullRequests,
  });

  if (dryRun) {
    console.log(report);
    return;
  }

  if (!webhookUrl) {
    throw new Error("Missing SLACK_TRIAGE_WEBHOOK_URL. Configure it as a GitHub Actions repository secret.");
  }

  await postSlack(webhookUrl, buildSlackPayload(report));
  console.log(`Posted hourly GitHub triage for ${repo} to Slack.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
