import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type LucasReviewStatus =
  | "não aprovado"
  | "bloqueado"
  | "aprovado com ajustes"
  | "aprovado para continuar"
  | "aprovado para merge manual";

export type LucasReviewCommand = {
  prNumber: number;
  status: LucasReviewStatus;
  message: string;
};

export type SlackSignatureVerification =
  | { ok: true }
  | {
      ok: false;
      reason: "missing-secret" | "missing-signature" | "missing-timestamp" | "expired-timestamp" | "invalid-signature";
    };

export type LucasReviewParseResult =
  | { ok: true; value: LucasReviewCommand }
  | {
      ok: false;
      reason: "missing-pr" | "invalid-pr" | "invalid-status" | "missing-message" | "message-too-long";
    };

export type LucasReviewAccessResult =
  | { ok: true }
  | { ok: false; reason: "user-not-allowed" | "channel-not-allowed" };

export type GitHubIssueComment = {
  id: number;
  body: string | null;
  html_url?: string;
};

type FetchLike = typeof fetch;
type EnvLike = Record<string, string | undefined>;

const DEFAULT_STATUS: LucasReviewStatus = "não aprovado";
const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_SLACK_TOLERANCE_SECONDS = 5 * 60;
const DEFAULT_REPO = "lspassos1/aframe-kingspan-local";

const STATUS_BY_KEY: Record<string, LucasReviewStatus> = {
  "nao-aprovado": "não aprovado",
  "nao-aprovada": "não aprovado",
  "nao-aprovar": "não aprovado",
  bloqueado: "bloqueado",
  bloqueada: "bloqueado",
  "aprovado-com-ajustes": "aprovado com ajustes",
  "aprovada-com-ajustes": "aprovado com ajustes",
  "aprovado-para-continuar": "aprovado para continuar",
  "aprovada-para-continuar": "aprovado para continuar",
  "aprovado-para-merge-manual": "aprovado para merge manual",
  "aprovada-para-merge-manual": "aprovado para merge manual",
};

function normalizeStatusKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function parsePositivePrNumber(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, "");
  if (!/^\d+$/.test(normalized)) return null;
  const prNumber = Number(normalized);
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) return null;
  return prNumber;
}

function tokenizeCommand(text: string) {
  const tokens: string[] = [];
  let current = "";
  let quote: "\"" | "'" | null = null;
  let escaping = false;

  for (const char of text.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if ((char === "\"" || char === "'") && (!quote || quote === char)) {
      quote = quote ? null : char;
      continue;
    }
    if (!quote && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

function findMessageAssignment(text: string) {
  const match = /(^|\s)(message|mensagem)=/i.exec(text);
  if (!match) return null;

  const keyStart = match.index + match[1].length;
  const valueStart = keyStart + match[2].length + 1;
  let rawValue = text.slice(valueStart).trimStart();
  if (!rawValue) return { message: "", textWithoutMessage: text.slice(0, keyStart).trim() };

  const quote = rawValue[0];
  if (quote === "\"" || quote === "'") {
    rawValue = rawValue.slice(1);
    let message = "";
    let escaping = false;
    for (const char of rawValue) {
      if (escaping) {
        message += char;
        escaping = false;
        continue;
      }
      if (char === "\\") {
        escaping = true;
        continue;
      }
      if (char === quote) break;
      message += char;
    }
    return { message, textWithoutMessage: text.slice(0, keyStart).trim() };
  }

  return { message: rawValue, textWithoutMessage: text.slice(0, keyStart).trim() };
}

function splitAllowedList(value: string | undefined | null) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export function getLucasReviewRepo(env: EnvLike = process.env) {
  return env.GITHUB_REVIEW_REPO?.trim() || DEFAULT_REPO;
}

export function getLucasReviewToken(env: EnvLike = process.env) {
  return env.GITHUB_REVIEW_TOKEN?.trim() || env.GITHUB_FEEDBACK_TOKEN?.trim() || "";
}

export function isValidGitHubRepo(repo: string) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

export function verifySlackSignature(values: {
  rawBody: string;
  signingSecret: string | undefined;
  signature: string | null;
  timestamp: string | null;
  nowMs?: number;
  toleranceSeconds?: number;
}): SlackSignatureVerification {
  const signingSecret = values.signingSecret?.trim();
  if (!signingSecret) return { ok: false, reason: "missing-secret" };
  if (!values.signature) return { ok: false, reason: "missing-signature" };
  if (!values.timestamp) return { ok: false, reason: "missing-timestamp" };

  const timestamp = Number(values.timestamp);
  const nowSeconds = Math.floor((values.nowMs ?? Date.now()) / 1000);
  const toleranceSeconds = values.toleranceSeconds ?? DEFAULT_SLACK_TOLERANCE_SECONDS;
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { ok: false, reason: "expired-timestamp" };
  }

  const baseString = `v0:${values.timestamp}:${values.rawBody}`;
  const expected = `v0=${createHmac("sha256", signingSecret).update(baseString).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(values.signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return { ok: false, reason: "invalid-signature" };
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer) ? { ok: true } : { ok: false, reason: "invalid-signature" };
}

export function normalizeLucasReviewStatus(input?: string | null): LucasReviewStatus | null {
  if (!input?.trim()) return DEFAULT_STATUS;
  return STATUS_BY_KEY[normalizeStatusKey(input)] ?? null;
}

export function parseLucasReviewCommand(text: string): LucasReviewParseResult {
  const explicitMessage = findMessageAssignment(text);
  const tokens = tokenizeCommand(explicitMessage?.textWithoutMessage ?? text);
  const keyValues = new Map<string, string>();
  const positional: string[] = [];

  for (const token of tokens) {
    const equalsIndex = token.indexOf("=");
    if (equalsIndex > 0) {
      keyValues.set(token.slice(0, equalsIndex).trim().toLowerCase(), token.slice(equalsIndex + 1).trim());
    } else {
      positional.push(token);
    }
  }

  const keyedPr = keyValues.get("pr") ?? keyValues.get("pull") ?? keyValues.get("pull_request");
  const positionalPrIndex = positional.findIndex((token) => /^#?\d+$/.test(token));
  const prToken = keyedPr ?? (positionalPrIndex >= 0 ? positional[positionalPrIndex] : undefined);
  if (!prToken) return { ok: false, reason: "missing-pr" };

  const prNumber = parsePositivePrNumber(prToken);
  if (!prNumber) return { ok: false, reason: "invalid-pr" };

  const remaining = positionalPrIndex >= 0 ? positional.filter((_, index) => index !== positionalPrIndex) : positional;
  let status = normalizeLucasReviewStatus(keyValues.get("status"));
  if (!status) return { ok: false, reason: "invalid-status" };

  let message = explicitMessage?.message ?? keyValues.get("message") ?? keyValues.get("mensagem") ?? "";
  if (!message) {
    const maybeStatus = remaining[0] ? normalizeLucasReviewStatus(remaining[0]) : null;
    const messageTokens = maybeStatus ? remaining.slice(1) : remaining;
    if (maybeStatus) status = maybeStatus;
    message = messageTokens.join(" ");
  }

  message = message.replace(/\s+/g, " ").trim();
  if (!message) return { ok: false, reason: "missing-message" };
  if (message.length > MAX_MESSAGE_LENGTH) return { ok: false, reason: "message-too-long" };

  return { ok: true, value: { prNumber, status, message } };
}

export function validateLucasReviewAccess(values: {
  slackUserId: string | null;
  slackChannelId: string | null;
  allowedUserIds?: string | null;
  allowedChannelIds?: string | null;
}): LucasReviewAccessResult {
  const allowedUsers = splitAllowedList(values.allowedUserIds);
  const allowedChannels = splitAllowedList(values.allowedChannelIds);

  if (allowedUsers.size > 0 && (!values.slackUserId || !allowedUsers.has(values.slackUserId))) {
    return { ok: false, reason: "user-not-allowed" };
  }

  if (allowedChannels.size > 0 && (!values.slackChannelId || !allowedChannels.has(values.slackChannelId))) {
    return { ok: false, reason: "channel-not-allowed" };
  }

  return { ok: true };
}

export function createLucasReviewHash(values: {
  prNumber: number;
  status: LucasReviewStatus;
  message: string;
  slackUser: string;
  slackChannel: string;
  slackExecutionId?: string;
}) {
  return createHash("sha256")
    .update([values.prNumber, values.status, values.message, values.slackUser, values.slackChannel, values.slackExecutionId ?? ""].join("\n"))
    .digest("hex");
}

export function buildLucasReviewComment(values: {
  prNumber: number;
  status: LucasReviewStatus;
  message: string;
  hash: string;
}) {
  return [
    "## Lucas Review",
    "",
    `Status: ${values.status}`,
    "",
    "Fonte: Slack",
    "",
    `PR: #${values.prNumber}`,
    "",
    "Mensagem:",
    values.message.trim(),
    "",
    "Regras:",
    "- Não marcar ready.",
    "- Não fazer merge.",
    "- Não fechar issue.",
    "- Corrigir antes de avançar.",
    "",
    `<!-- lucas-review-slack:${values.hash} -->`,
  ].join("\n");
}

export async function findExistingLucasReviewComment(values: {
  token: string;
  repo: string;
  prNumber: number;
  hash: string;
  fetchImpl?: FetchLike;
}) {
  if (!values.token) throw new Error("missing-github-token");
  if (!isValidGitHubRepo(values.repo)) throw new Error("invalid-github-repo");
  if (!Number.isSafeInteger(values.prNumber) || values.prNumber <= 0) throw new Error("invalid-pr-number");

  const fetcher = values.fetchImpl ?? fetch;
  const marker = `<!-- lucas-review-slack:${values.hash} -->`;
  const response = await fetcher(`https://api.github.com/repos/${values.repo}/issues/${values.prNumber}/comments?per_page=100`, {
    headers: githubHeaders(values.token),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("github-comments-list-failed");
  const comments = (await response.json()) as GitHubIssueComment[];
  return comments.find((comment) => comment.body?.includes(marker)) ?? null;
}

export async function postGitHubIssueComment(values: {
  token: string;
  repo: string;
  prNumber: number;
  body: string;
  fetchImpl?: FetchLike;
}) {
  if (!values.token) throw new Error("missing-github-token");
  if (!isValidGitHubRepo(values.repo)) throw new Error("invalid-github-repo");
  if (!Number.isSafeInteger(values.prNumber) || values.prNumber <= 0) throw new Error("invalid-pr-number");

  const fetcher = values.fetchImpl ?? fetch;
  const response = await fetcher(`https://api.github.com/repos/${values.repo}/issues/${values.prNumber}/comments`, {
    method: "POST",
    headers: githubHeaders(values.token),
    body: JSON.stringify({ body: values.body }),
  });

  if (!response.ok) throw new Error("github-comment-create-failed");
  return (await response.json()) as GitHubIssueComment;
}
