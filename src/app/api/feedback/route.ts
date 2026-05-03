import { NextRequest, NextResponse } from "next/server";
import { createFeedbackIssue } from "@/lib/feedback/github";
import { feedbackSchema } from "@/lib/validation/feedback";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 3;
const rateLimit = new Map<string, RateLimitEntry>();

function getClientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const current = rateLimit.get(key);
  if (!current || current.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS) return false;
  current.count += 1;
  return true;
}

function buildIssueTitle(category: string, message: string) {
  const summary = message.replace(/\s+/g, " ").trim().slice(0, 72);
  return `[Feedback] ${category}: ${summary}`;
}

function buildIssueBody(values: {
  name?: string;
  contact?: string;
  category: string;
  message: string;
}) {
  return [
    "## Feedback publico",
    "",
    `Categoria: ${values.category}`,
    `Nome: ${values.name?.trim() || "Nao informado"}`,
    `Contato: ${values.contact?.trim() || "Nao informado"}`,
    "",
    "## Mensagem",
    "",
    values.message.trim(),
    "",
    "## Privacidade",
    "",
    "Enviado por formulario publico. Nao inclui IP no corpo da issue.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "JSON invalido." }, { status: 400 });
  }

  if (typeof body.company === "string" && body.company.length > 0) {
    return NextResponse.json({ message: "Obrigado. Mensagem recebida." });
  }

  const key = getClientKey(request);
  if (!checkRateLimit(key)) {
    return NextResponse.json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Revise os campos do formulario." }, { status: 400 });
  }

  try {
    const issue = await createFeedbackIssue({
      title: buildIssueTitle(parsed.data.category, parsed.data.message),
      body: buildIssueBody(parsed.data),
    });
    return NextResponse.json({
      message: "Mensagem enviada. Obrigado pela sugestao.",
      issue: { number: issue.number, status: issue.status, name: issue.name, category: issue.category },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "missing-github-token") {
      return NextResponse.json({ message: "Feedback ainda nao esta configurado no servidor." }, { status: 503 });
    }
    return NextResponse.json({ message: "Nao foi possivel criar a issue privada agora." }, { status: 502 });
  }
}
