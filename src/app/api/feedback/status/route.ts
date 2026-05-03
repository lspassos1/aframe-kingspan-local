import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFeedbackIssuesByNumber } from "@/lib/feedback/github";

const statusRequestSchema = z.object({
  numbers: z.array(z.number().int().positive()).max(20),
});

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = statusRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Solicitacao invalida." }, { status: 400 });
  }

  try {
    const items = (await getFeedbackIssuesByNumber(parsed.data.numbers)).map((issue) => ({
      number: issue.number,
      status: issue.status,
      name: issue.name,
      category: issue.category,
    }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
