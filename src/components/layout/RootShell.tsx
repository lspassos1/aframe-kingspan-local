"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PublicShell } from "@/components/layout/PublicShell";

const publicRoutePrefixes = ["/sign-in", "/sign-up"];
const publicRoutes = new Set(["/", "/privacy", "/terms", "/feedback"]);

function isPublicRoute(pathname: string) {
  return publicRoutes.has(pathname) || publicRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicRoute(pathname)) {
    return <PublicShell>{children}</PublicShell>;
  }

  return <AppShell>{children}</AppShell>;
}
