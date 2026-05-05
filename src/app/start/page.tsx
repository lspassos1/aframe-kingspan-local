import { StartGuidedAssistant } from "@/components/onboarding/StartGuidedAssistant";
import { isAiPlanExtractEnabled } from "@/lib/ai/plan-extract-request";

export default function StartPage() {
  const planExtractEnabled = isAiPlanExtractEnabled();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <StartGuidedAssistant planExtractEnabled={planExtractEnabled} />
    </main>
  );
}
