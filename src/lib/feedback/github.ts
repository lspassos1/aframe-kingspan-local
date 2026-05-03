export type FeedbackStatus = "pending" | "approved" | "rejected";

export type FeedbackIssue = {
  id: number;
  number: number;
  title: string;
  name: string;
  contact: string;
  category: string;
  message: string;
  status: FeedbackStatus;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
};

type GitHubLabel = {
  name: string;
};

type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: GitHubLabel[];
};

export const APPROVED_LABEL = "feedback-approved";
export const REJECTED_LABEL = "feedback-rejected";

function getGitHubConfig() {
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  const repo = process.env.GITHUB_FEEDBACK_REPO ?? "lspassos1/aframe-kingspan-local";
  return { token, repo };
}

function headers(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function parseBodyField(body: string, label: string) {
  const match = body.match(new RegExp(`${label}:\\s*(.+)`));
  return match?.[1]?.trim() ?? "";
}

function parseFeedbackMessage(body: string) {
  const match = body.match(/## Mensagem\s+([\s\S]*?)\s+## Privacidade/);
  return match?.[1]?.trim() ?? "";
}

function issueStatus(labels: GitHubLabel[]): FeedbackStatus {
  if (labels.some((label) => label.name === APPROVED_LABEL)) return "approved";
  if (labels.some((label) => label.name === REJECTED_LABEL)) return "rejected";
  return "pending";
}

export function mapFeedbackIssue(issue: GitHubIssue): FeedbackIssue {
  const body = issue.body ?? "";
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    name: parseBodyField(body, "Nome") || "Colaborador",
    contact: parseBodyField(body, "Contato"),
    category: parseBodyField(body, "Categoria") || "melhoria",
    message: parseFeedbackMessage(body),
    status: issueStatus(issue.labels),
    htmlUrl: issue.html_url,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  };
}

export async function createFeedbackIssue(values: {
  title: string;
  body: string;
}) {
  const { token, repo } = getGitHubConfig();
  if (!token) throw new Error("missing-github-token");

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(values),
  });

  if (!response.ok) throw new Error("github-create-failed");
  const createdIssue = (await response.json()) as GitHubIssue;

  const closeResponse = await fetch(`https://api.github.com/repos/${repo}/issues/${createdIssue.number}`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({ state: "closed", state_reason: "not_planned" }),
  });

  if (!closeResponse.ok) throw new Error("github-close-failed");
  return mapFeedbackIssue((await closeResponse.json()) as GitHubIssue);
}

export async function listFeedbackIssues() {
  const { token, repo } = getGitHubConfig();
  if (!token) throw new Error("missing-github-token");

  const response = await fetch(`https://api.github.com/repos/${repo}/issues?state=all&per_page=100&sort=updated&direction=desc`, {
    headers: headers(token),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("github-list-failed");
  const issues = (await response.json()) as GitHubIssue[];
  return issues.filter((issue) => issue.title.startsWith("[Feedback]")).map(mapFeedbackIssue);
}

export async function listApprovedFeedbackIssues() {
  return (await listFeedbackIssues()).filter((issue) => issue.status === "approved");
}

export async function getFeedbackIssuesByNumber(numbers: number[]) {
  const wanted = new Set(numbers);
  return (await listFeedbackIssues()).filter((issue) => wanted.has(issue.number));
}

async function ensureLabel(token: string, repo: string, label: string, color: string, description: string) {
  const response = await fetch(`https://api.github.com/repos/${repo}/labels`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ name: label, color, description }),
  });
  if (response.ok || response.status === 422) return;
  throw new Error("github-label-create-failed");
}

async function removeLabel(token: string, repo: string, issueNumber: number, label: string) {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`, {
    method: "DELETE",
    headers: headers(token),
  });
  if (response.ok || response.status === 404) return;
  throw new Error("github-label-remove-failed");
}

export async function updateFeedbackStatus(issueNumber: number, status: Exclude<FeedbackStatus, "pending">) {
  const { token, repo } = getGitHubConfig();
  if (!token) throw new Error("missing-github-token");

  await ensureLabel(token, repo, APPROVED_LABEL, "2f855a", "Feedback aprovado para aparecer na landing.");
  await ensureLabel(token, repo, REJECTED_LABEL, "b42318", "Feedback recusado pelo admin.");

  const nextLabel = status === "approved" ? APPROVED_LABEL : REJECTED_LABEL;
  const staleLabel = status === "approved" ? REJECTED_LABEL : APPROVED_LABEL;
  await removeLabel(token, repo, issueNumber, staleLabel);

  const updateIssueResponse = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({
      state: status === "approved" ? "open" : "closed",
      state_reason: status === "approved" ? null : "not_planned",
    }),
  });
  if (!updateIssueResponse.ok) throw new Error("github-state-update-failed");

  const labelResponse = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ labels: [nextLabel] }),
  });
  if (!labelResponse.ok) throw new Error("github-label-update-failed");

  const commentBody =
    status === "approved"
      ? "Obrigado pela contribuicao. Esta melhoria foi aprovada e pode aparecer de forma discreta na pagina inicial."
      : "Obrigado pela contribuicao. Esta sugestao foi recusada nesta etapa, mas continue enviando ideias e melhorias.";

  await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ body: commentBody }),
  });
}
