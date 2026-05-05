import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";

export async function GET() {
  const admin = await requireAdminUser();

  return NextResponse.json({ isAdmin: Boolean(admin) });
}
