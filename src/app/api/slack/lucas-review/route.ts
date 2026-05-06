import { NextRequest, NextResponse } from "next/server";
import {
  buildLucasReviewComment,
  createLucasReviewHash,
  findExistingLucasReviewComment,
  getLucasReviewRepo,
  getLucasReviewToken,
  isValidGitHubRepo,
  parseLucasReviewCommand,
  postGitHubIssueComment,
  validateLucasReviewAccess,
  verifySlackSignature,
} from "@/lib/slack/lucas-review";

export const runtime = "nodejs";

function slackText(message: string, status = 200) {
  return new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function safeParseError(reason: string) {
  switch (reason) {
    case "missing-pr":
      return "Informe o PR. Exemplo: /lucas-review 141 nao-aprovado mensagem.";
    case "invalid-pr":
      return "PR invalido. Use um numero positivo.";
    case "invalid-status":
      return "Status invalido para Lucas Review.";
    case "missing-message":
      return "Informe a mensagem da revisao.";
    case "message-too-long":
      return "Mensagem muito longa para registrar no PR.";
    default:
      return "Nao foi possivel interpretar o comando.";
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-slack-signature");
  const timestamp = request.headers.get("x-slack-request-timestamp");

  const signatureResult = verifySlackSignature({
    rawBody,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    signature,
    timestamp,
  });

  if (!signatureResult.ok) {
    const status = signatureResult.reason === "missing-secret" ? 503 : 401;
    return slackText("Lucas Review Bridge nao autorizado ou nao configurado.", status);
  }

  const form = new URLSearchParams(rawBody);
  const command = form.get("command")?.trim();
  if (command && command !== "/lucas-review") {
    return slackText("Comando Slack invalido para Lucas Review.", 400);
  }

  const slackUserId = form.get("user_id");
  const slackChannelId = form.get("channel_id");
  const access = validateLucasReviewAccess({
    slackUserId,
    slackChannelId,
    allowedUserIds: process.env.SLACK_ALLOWED_USER_IDS,
    allowedChannelIds: process.env.SLACK_ALLOWED_CHANNEL_IDS,
  });

  if (!access.ok) {
    return slackText("Usuario ou canal nao autorizado para Lucas Review.", 403);
  }

  const parsed = parseLucasReviewCommand(form.get("text") ?? "");
  if (!parsed.ok) {
    return slackText(safeParseError(parsed.reason), 400);
  }

  const repo = getLucasReviewRepo();
  if (!isValidGitHubRepo(repo)) {
    return slackText("Repositorio GitHub invalido na configuracao do servidor.", 503);
  }

  const token = getLucasReviewToken();
  if (!token) {
    return slackText("GitHub Review token nao configurado no servidor.", 503);
  }

  const hash = createLucasReviewHash({
    prNumber: parsed.value.prNumber,
    status: parsed.value.status,
    message: parsed.value.message,
    slackUser: slackUserId ?? "unknown-user",
    slackChannel: slackChannelId ?? "unknown-channel",
    slackExecutionId: form.get("trigger_id") || form.get("response_url") || undefined,
  });
  const body = buildLucasReviewComment({ ...parsed.value, hash });

  try {
    const existing = await findExistingLucasReviewComment({
      token,
      repo,
      prNumber: parsed.value.prNumber,
      hash,
    });

    if (existing) {
      return slackText(`Revisao ja registrada no PR #${parsed.value.prNumber}.`);
    }

    await postGitHubIssueComment({
      token,
      repo,
      prNumber: parsed.value.prNumber,
      body,
    });

    return slackText(`Lucas Review registrada no PR #${parsed.value.prNumber}.`);
  } catch {
    return slackText("Nao foi possivel registrar Lucas Review no GitHub agora.", 502);
  }
}
