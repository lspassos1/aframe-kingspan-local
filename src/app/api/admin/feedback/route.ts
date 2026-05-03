import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/admin";
import { listFeedbackIssues, updateFeedbackStatus } from "@/lib/feedback/github";

const updateSchema = z.object({
  issueNumber: z.number().int().positive(),
  status: z.enum(["approved", "rejected"]),
});

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Acesso restrito ao admin." }, { status: 403 });

  try {
    return NextResponse.json({ items: await listFeedbackIssues() });
  } catch {
    return NextResponse.json({ message: "Nao foi possivel carregar as melhorias." }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Acesso restrito ao admin." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Solicitacao invalida." }, { status: 400 });
  }

  try {
    await updateFeedbackStatus(parsed.data.issueNumber, parsed.data.status);
    return NextResponse.json({ message: "Status atualizado." });
  } catch {
    return NextResponse.json({ message: "Nao foi possivel atualizar o status." }, { status: 502 });
  }
}
