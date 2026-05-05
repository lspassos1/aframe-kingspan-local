import { StartGuidedAssistant } from "@/components/onboarding/StartGuidedAssistant";
import { isAiPlanExtractEnabled } from "@/lib/ai/plan-extract-request";
import { normalizeStartAssistantModeParam } from "@/lib/onboarding/start-guided-assistant";

export default async function StartPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string | string[] }>;
}) {
  const planExtractEnabled = isAiPlanExtractEnabled();
  const initialMode = normalizeStartAssistantModeParam((await searchParams)?.mode);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <StartGuidedAssistant key={initialMode} planExtractEnabled={planExtractEnabled} initialMode={initialMode} />
    </main>
  );
}
