import { StartGuidedAssistant } from "@/components/onboarding/StartGuidedAssistant";
import { getSafePlanImportProviderUiStatus } from "@/lib/ai/plan-import-status";
import { isAiPlanExtractEnabled } from "@/lib/ai/plan-extract-request";
import { normalizeStartAssistantModeParam } from "@/lib/onboarding/start-guided-assistant";
import type { StartRedirectReason } from "@/lib/routes/shell";

export default async function StartPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string | string[]; reason?: string | string[]; next?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const planExtractEnabled = isAiPlanExtractEnabled();
  const aiProviderStatus = getSafePlanImportProviderUiStatus({ ...process.env, AI_MODE: "free-cloud" });
  const proProviderStatus = getSafePlanImportProviderUiStatus({ ...process.env, AI_MODE: "paid" });
  const initialMode = normalizeStartAssistantModeParam(resolvedSearchParams?.mode);
  const reasonParam = Array.isArray(resolvedSearchParams?.reason) ? resolvedSearchParams?.reason[0] : resolvedSearchParams?.reason;
  const nextParam = Array.isArray(resolvedSearchParams?.next) ? resolvedSearchParams?.next[0] : resolvedSearchParams?.next;
  const redirectReason = reasonParam === "project-required" || reasonParam === "project-invalid" ? (reasonParam as StartRedirectReason) : undefined;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <StartGuidedAssistant
        key={`${initialMode}-${redirectReason ?? "direct"}`}
        planExtractEnabled={planExtractEnabled}
        aiProviderStatus={aiProviderStatus}
        proProviderStatus={proProviderStatus.primaryConfigured ? proProviderStatus : undefined}
        initialMode={initialMode}
        redirectReason={redirectReason}
        redirectNext={nextParam}
      />
    </main>
  );
}
