import { NextResponse } from "next/server";
import { listApprovedFeedbackIssues } from "@/lib/feedback/github";

export async function GET() {
  try {
    const items = (await listApprovedFeedbackIssues()).slice(0, 8).map((issue) => ({
      id: issue.number,
      name: issue.name,
      category: issue.category,
    }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
