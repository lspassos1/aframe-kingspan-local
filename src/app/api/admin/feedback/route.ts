import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/admin";
import { FeedbackGitHubError, listFeedbackIssues, updateFeedbackStatus } from "@/lib/feedback/github";

const updateSchema = z.object({
  issueNumber: z.number().int().positive(),
  status: z.enum(["approved", "rejected"]),
});

function adminErrorResponse(error: unknown, action: "load" | "update") {
  if (error instanceof FeedbackGitHubError && error.code === "missing-github-token") {
    return NextResponse.json(
      {
        status: "missing_token",
        code: "missing_github_feedback_token",
        message: "Token GitHub de feedback ausente no servidor.",
        action: "Configure GITHUB_FEEDBACK_TOKEN no ambiente do servidor e faça redeploy.",
      },
      { status: 503 }
    );
  }

  if (error instanceof FeedbackGitHubError) {
    return NextResponse.json(
      {
        status: "github_error",
        code: error.code,
        githubStatus: error.status ?? null,
        message: action === "load" ? "GitHub API falhou ao carregar as melhorias." : "GitHub API falhou ao atualizar a melhoria.",
        action: "Verifique token, repositório configurado e permissão de issues no GitHub.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      status: "server_error",
      code: "admin_feedback_unexpected_error",
      message: action === "load" ? "Não foi possível carregar as melhorias." : "Não foi possível atualizar o status.",
    },
    { status: 500 }
  );
}

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json(
      {
        status: "forbidden",
        code: "admin_required",
        message: "Sem permissão de admin para ver melhorias.",
      },
      { status: 403 }
    );
  }

  try {
    const items = await listFeedbackIssues();
    return NextResponse.json({
      status: items.length > 0 ? "ok" : "empty",
      items,
      message: items.length > 0 ? "Melhorias carregadas." : "Nenhuma melhoria recebida ainda.",
    });
  } catch (error) {
    return adminErrorResponse(error, "load");
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json(
      {
        status: "forbidden",
        code: "admin_required",
        message: "Sem permissão de admin para alterar melhorias.",
      },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "invalid_request",
        code: "invalid_payload",
        message: "Solicitação inválida.",
      },
      { status: 400 }
    );
  }

  try {
    await updateFeedbackStatus(parsed.data.issueNumber, parsed.data.status);
    return NextResponse.json({ status: "ok", message: "Status atualizado." });
  } catch (error) {
    return adminErrorResponse(error, "update");
  }
}
