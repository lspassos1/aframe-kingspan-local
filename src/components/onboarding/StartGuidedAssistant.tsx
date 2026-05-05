"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileUp, FolderOpen, Keyboard } from "lucide-react";
import { PlanImportCard } from "@/components/ai/PlanImportCard";
import { StartProjectForm } from "@/components/onboarding/StartProjectForm";
import { Button } from "@/components/ui/button";
import { defaultProject } from "@/data/defaultProject";
import { createStartAssistantViewModel, type StartAssistantMode } from "@/lib/onboarding/start-guided-assistant";
import { cloneProject } from "@/lib/store/project-normalization";
import { useProjectStore } from "@/lib/store/project-store";
import { cn } from "@/lib/utils";

const optionIcons = {
  ai: FileUp,
  manual: Keyboard,
  example: FolderOpen,
} as const;

export function StartGuidedAssistant({
  planExtractEnabled,
  initialMode = "choose",
}: {
  planExtractEnabled: boolean;
  initialMode?: StartAssistantMode;
}) {
  const router = useRouter();
  const setProject = useProjectStore((state) => state.setProject);
  const setOnboardingCompleted = useProjectStore((state) => state.setOnboardingCompleted);
  const [mode, setMode] = useState<StartAssistantMode>(initialMode);
  const viewModel = useMemo(() => createStartAssistantViewModel({ mode, planExtractEnabled }), [mode, planExtractEnabled]);

  function openExampleProject() {
    setMode("example");
    setProject({
      ...cloneProject(defaultProject),
      onboardingCompleted: true,
    });
    setOnboardingCompleted(true);
    router.push("/model-3d");
  }

  function selectMode(nextMode: StartAssistantMode) {
    if (nextMode === "example") {
      openExampleProject();
      return;
    }
    setMode(nextMode);
  }

  return (
    <div className="space-y-6">
      <section className="border-b pb-6">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">Novo estudo</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-balance sm:text-5xl">{viewModel.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{viewModel.subtitle}</p>
        </div>

        {mode === "choose" ? (
          <div className="mt-7 grid gap-3 lg:grid-cols-3">
            {viewModel.options.map((option) => {
              const Icon = optionIcons[option.id];
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectMode(option.id)}
                  className={cn(
                    "group flex min-h-40 flex-col items-start rounded-lg border bg-card p-4 text-left shadow-sm shadow-foreground/5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
                    option.primary && "border-primary/35 bg-primary/[0.035]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors",
                      option.primary && "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="mt-5 flex items-center gap-2 font-semibold">
                    {option.title}
                    {option.primary ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                  </span>
                  <span className="mt-2 text-sm leading-6 text-muted-foreground">{option.description}</span>
                  {option.disabledReason ? <span className="mt-auto pt-4 text-xs font-medium text-muted-foreground">{option.disabledReason}</span> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <Button type="button" variant="outline" className="mt-6" onClick={() => setMode("choose")}>
            <ArrowLeft className="h-4 w-4" />
            Trocar caminho
          </Button>
        )}
      </section>

      {viewModel.showAiDisabledNotice ? (
        <div className="rounded-lg border bg-muted/25 p-4 text-sm leading-6 text-muted-foreground">
          A leitura por IA está desligada neste ambiente. Configure `AI_PLAN_EXTRACT_ENABLED=true` e `OPENAI_API_KEY` no servidor para habilitar upload,
          ou continue preenchendo manualmente.
        </div>
      ) : null}

      {viewModel.showPlanImport ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">Planta baixa</h2>
            <p className="mt-1 text-sm text-muted-foreground">Nenhum dado extraído é aplicado sem revisão.</p>
          </div>
          <PlanImportCard />
        </section>
      ) : null}

      {viewModel.showManualForm ? (
        <section id="manual-start" className="scroll-mt-6 space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">{mode === "ai" ? "Revisar ou completar manualmente" : "Medidas iniciais"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Depois das medidas, você confirma o método construtivo e segue para o estudo.</p>
          </div>
          <StartProjectForm />
        </section>
      ) : null}
    </div>
  );
}
