"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileUp, FolderOpen, Keyboard } from "lucide-react";
import { PlanImportCard } from "@/components/ai/PlanImportCard";
import { StartProjectForm } from "@/components/onboarding/StartProjectForm";
import { ActionCard, InlineHelp, PageFrame, SectionHeader, StepProgress, StatusPill } from "@/components/shared/design-system";
import { Button } from "@/components/ui/button";
import { defaultProject } from "@/data/defaultProject";
import { createStartAssistantViewModel, type StartAssistantMode } from "@/lib/onboarding/start-guided-assistant";
import { cloneProject } from "@/lib/store/project-normalization";
import { useProjectStore } from "@/lib/store/project-store";

const optionIcons = {
  ai: FileUp,
  manual: Keyboard,
  example: FolderOpen,
} as const;

const startSteps = [
  { label: "Entrada", description: "Planta, medidas ou exemplo." },
  { label: "Revisão", description: "Campos editáveis antes de aplicar." },
  { label: "Estudo", description: "3D, quantitativos e orçamento." },
];

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
  const openedInitialExampleRef = useRef(false);
  const viewModel = useMemo(() => createStartAssistantViewModel({ mode, planExtractEnabled }), [mode, planExtractEnabled]);

  const loadExampleProject = useCallback(() => {
    setProject({
      ...cloneProject(defaultProject),
      onboardingCompleted: true,
    });
    setOnboardingCompleted(true);
    router.push("/model-3d");
  }, [router, setOnboardingCompleted, setProject]);

  useEffect(() => {
    if (initialMode !== "example" || openedInitialExampleRef.current) return;

    openedInitialExampleRef.current = true;
    loadExampleProject();
  }, [initialMode, loadExampleProject]);

  function openExampleProject() {
    setMode("example");
    loadExampleProject();
  }

  function selectMode(nextMode: StartAssistantMode) {
    if (nextMode === "example") {
      openExampleProject();
      return;
    }
    setMode(nextMode);
  }

  const currentStepIndex = mode === "choose" ? 0 : 1;

  return (
    <PageFrame>
      <section className="rounded-2xl border bg-card/86 p-5 shadow-sm shadow-foreground/5 sm:p-6">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">Novo estudo</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-balance sm:text-5xl">{viewModel.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{viewModel.subtitle}</p>
        </div>
        <StepProgress steps={startSteps} currentIndex={currentStepIndex} className="mt-7" />

        {mode === "choose" ? (
          <div className="mt-7 grid gap-3 lg:grid-cols-3">
            {viewModel.options.map((option) => {
              const Icon = optionIcons[option.id];
              return (
                <ActionCard
                  key={option.id}
                  onClick={() => selectMode(option.id)}
                  icon={Icon}
                  primary={option.primary}
                  title={
                    <span className="flex items-center gap-2">
                    {option.title}
                      {option.primary ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                  </span>
                  }
                  description={option.description}
                  disabledReason={option.disabledReason}
                />
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
        <InlineHelp tone="warning">
          A leitura por IA está desligada neste ambiente. Configure `AI_PLAN_EXTRACT_ENABLED=true` e `OPENAI_API_KEY` no servidor para habilitar upload,
          ou continue preenchendo manualmente.
        </InlineHelp>
      ) : null}

      {viewModel.showPlanImport ? (
        <section className="space-y-3">
          <SectionHeader
            title="Planta baixa"
            description="Nenhum dado extraído é aplicado sem revisão."
            action={<StatusPill tone="pending">Revisão obrigatória</StatusPill>}
          />
          <PlanImportCard planExtractEnabled={planExtractEnabled} />
        </section>
      ) : null}

      {viewModel.showManualForm ? (
        <section id="manual-start" className="scroll-mt-6 space-y-3">
          <SectionHeader
            title={mode === "ai" ? "Revisar ou completar manualmente" : "Medidas iniciais"}
            description="Depois das medidas, você confirma o método construtivo e segue para o estudo."
          />
          <StartProjectForm />
        </section>
      ) : null}
    </PageFrame>
  );
}
