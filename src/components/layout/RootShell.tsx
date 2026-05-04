"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PublicShell } from "@/components/layout/PublicShell";
import { FeedbackStatusNotifier } from "@/components/feedback/FeedbackStatusNotifier";
import { shouldUsePublicShell } from "@/lib/routes/shell";
import { useProjectStore } from "@/lib/store/project-store";

export function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();
  const onboardingCompleted = useProjectStore((state) => state.project.onboardingCompleted);
  const signedIn = isLoaded ? isSignedIn : false;

  if (shouldUsePublicShell(pathname, signedIn, onboardingCompleted)) {
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
