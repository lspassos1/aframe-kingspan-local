"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PublicShell } from "@/components/layout/PublicShell";
import { FeedbackStatusNotifier } from "@/components/feedback/FeedbackStatusNotifier";
import { shouldUsePublicShell } from "@/lib/routes/shell";

export function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();
  const signedIn = isLoaded ? isSignedIn : false;

  if (shouldUsePublicShell(pathname, signedIn)) {
    return (
      <PublicShell>
        {children}
        <FeedbackStatusNotifier />
      </PublicShell>
    );
  }

  return (
    <AppShell>
      {children}
      <FeedbackStatusNotifier />
    </AppShell>
  );
}
