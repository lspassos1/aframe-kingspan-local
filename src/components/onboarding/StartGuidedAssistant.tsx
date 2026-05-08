"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, Clock3, FileCheck2, FileUp, FolderOpen, Keyboard, RotateCcw, ShieldCheck } from "lucide-react";
import { PlanImportCard } from "@/components/ai/PlanImportCard";
import { StartProjectForm } from "@/components/onboarding/StartProjectForm";
import { ActionCard, InlineHelp, PageFrame, PageHeader, SectionHeader, StepProgress, StatusPill, StickySummary } from "@/components/shared/design-system";
import { Button } from "@/components/ui/button";
import { defaultProject } from "@/data/defaultProject";
import { createStartAssistantViewModel, type StartAssistantMode } from "@/lib/onboarding/start-guided-assistant";
import type { StartRedirectReason } from "@/lib/routes/shell";
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

const nextSteps = [
  "Revisar campos e evidências.",
  "Responder dúvidas de escala, UF e premissas.",
  "Confirmar premissas técnicas só depois dos dados base.",
  "Gerar quantitativos e orçamento preliminar com fonte.",
];

const aiOperationalFacts = [
  { label: "Provider", value: "OpenAI API" },
  { label: "Arquivo", value: "PDF, PNG ou JPG até o limite configurado" },
  { label: "Limite diário", value: "Validado no servidor por usuário e IP" },
  { label: "Cache", value: "Hash do arquivo evita análise repetida" },
  { label: "Fallback", value: "Preenchimento manual continua disponível" },
];

export function StartGuidedAssistant({
  planExtractEnabled,
  initialMode = "choose",
  redirectReason,
  redirectNext,
}: {
  planExtractEnabled: boolean;
  initialMode?: StartAssistantMode;
  redirectReason?: StartRedirectReason;
  redirectNext?: string;
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

  function openManualCompletion() {
    setMode("manual");
    setTimeout(() => {
      document.getElementById("manual-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const currentStepIndex = mode === "choose" ? 0 : 1;
  const redirectNotice =
    redirectReason === "project-invalid"
      ? {
          tone: "warning" as const,
          text: "Não foi possível carregar o estudo salvo neste navegador. Comece um novo estudo ou importe um JSON válido.",
        }
      : redirectReason === "project-required"
        ? {
            tone: "info" as const,
            text: `Você tentou abrir ${redirectNext ?? "uma rota interna"} sem um estudo carregado. Comece pela planta, preencha manualmente ou use o exemplo.`,
          }
        : null;

  if (mode === "choose") {
    return (
      <PageFrame className="mx-auto max-w-7xl">
        {redirectNotice ? <InlineHelp tone={redirectNotice.tone}>{redirectNotice.text}</InlineHelp> : null}

        <PageHeader
          eyebrow="Novo estudo"
          title={viewModel.title}
          description={viewModel.subtitle}
          status={<StatusPill tone={planExtractEnabled ? "success" : "warning"}>{planExtractEnabled ? "OpenAI pronta" : "IA desligada"}</StatusPill>}
          className="bg-[radial-gradient(circle_at_18%_18%,hsl(var(--primary)/0.09),transparent_32%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--background)))]"
        />

        <section className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="grid gap-3 lg:grid-cols-3">
            {viewModel.options.map((option) => {
              const Icon = optionIcons[option.id];
              return (
                <ActionCard
                  key={option.id}
                  title={option.title}
                  description={option.description}
                  icon={Icon}
                  primary={option.primary}
                  disabledReason={option.disabledReason}
                  onClick={() => selectMode(option.id)}
                  badge={
                    option.id === "ai" ? (
                      <StatusPill tone={planExtractEnabled ? "success" : "warning"}>{planExtractEnabled ? "Principal" : "Configurar"}</StatusPill>
                    ) : option.id === "manual" ? (
                      <StatusPill tone="info">Sem IA</StatusPill>
                    ) : (
                      <StatusPill tone="neutral">Demonstração</StatusPill>
                    )
                  }
                  footer={
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                      {option.id === "ai" ? "Enviar arquivo" : option.id === "manual" ? "Começar medidas" : "Abrir estudo"}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  }
                />
              );
            })}
          </div>

          <StickySummary title="O que acontece depois" description="A primeira decisão é como informar a planta ou as medidas. A confirmação técnica vem depois.">
            <div className="space-y-2">
              {nextSteps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-2xl border bg-background/70 p-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">{index + 1}</span>
                  <span className="leading-6 text-muted-foreground">{step}</span>
                </div>
              ))}
            </div>
            <InlineHelp tone="info" className="mt-3">
              IA sugere dados e perguntas. O sistema calcula. Você aprova antes de gerar orçamento e 3D.
            </InlineHelp>
          </StickySummary>
        </section>
      </PageFrame>
    );
  }

  return (
    <PageFrame className="mx-auto max-w-7xl">
      {redirectNotice ? <InlineHelp tone={redirectNotice.tone}>{redirectNotice.text}</InlineHelp> : null}

      <PageHeader
        eyebrow="Novo estudo"
        title={viewModel.title}
        description={viewModel.subtitle}
        status={
          mode === "ai" ? (
            <StatusPill tone={planExtractEnabled ? "success" : "warning"}>{planExtractEnabled ? "OpenAI configurada" : "IA desligada"}</StatusPill>
          ) : (
            <StatusPill tone="info">Entrada manual</StatusPill>
          )
        }
        actions={
          <Button type="button" variant="outline" onClick={() => setMode("choose")}>
            <ArrowLeft className="h-4 w-4" />
            Trocar caminho
          </Button>
        }
      />

      <StepProgress steps={startSteps} currentIndex={currentStepIndex} />

      {viewModel.showAiDisabledNotice ? (
        <InlineHelp tone="warning">
          A leitura por IA está desligada neste ambiente. Configure `AI_PLAN_EXTRACT_ENABLED=true` e `OPENAI_API_KEY` no servidor para habilitar upload,
          ou continue preenchendo manualmente.
        </InlineHelp>
      ) : null}

      {viewModel.showPlanImport ? (
        <section className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="space-y-3">
            <SectionHeader
              eyebrow="Caminho principal"
              title="Enviar planta baixa"
              description="Arraste ou selecione um arquivo. O app mostra cache, limite, análise e revisão antes de aplicar qualquer dado."
              action={<StatusPill tone="pending">Revisão obrigatória</StatusPill>}
            />
            <PlanImportCard planExtractEnabled={planExtractEnabled} onManualFallback={openManualCompletion} />
          </div>

          <StickySummary title="Status da IA" description="Somente metadados seguros aparecem nesta tela. A chave da OpenAI fica no servidor.">
            <div className="space-y-2">
              {aiOperationalFacts.map((fact) => (
                <div key={fact.label} className="rounded-2xl border bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{fact.label}</p>
                  <p className="mt-1 text-sm font-medium leading-6">{fact.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2">
              <StatusPill tone={planExtractEnabled ? "success" : "warning"} icon={planExtractEnabled ? FileCheck2 : CircleHelp}>
                {planExtractEnabled ? "Upload habilitado" : "Upload aguardando configuração"}
              </StatusPill>
              <StatusPill tone="pending" icon={Clock3}>Cache por hash ativo quando houver resultado</StatusPill>
              <StatusPill tone="info" icon={RotateCcw}>Fallback manual disponível</StatusPill>
            </div>
            <InlineHelp tone="warning" className="mt-3">
              Nenhum campo extraído altera o estudo sem revisão humana. Método incerto fica como sugestão.
            </InlineHelp>
          </StickySummary>
        </section>
      ) : null}

      {mode === "ai" ? (
        <section id="manual-start" className="scroll-mt-6">
          <ActionCard
            title="Preencher manualmente"
            description="Use este caminho se a planta não estiver pronta, se o upload estiver desligado ou se preferir informar medidas por etapas."
            icon={Keyboard}
            badge={<StatusPill tone="info">Fallback</StatusPill>}
            onClick={() => setMode("manual")}
            footer={
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                Abrir preenchimento manual
                <ArrowRight className="h-4 w-4" />
              </span>
            }
          />
        </section>
      ) : null}

      {viewModel.showManualForm ? (
        <section id="manual-start" className="grid scroll-mt-6 gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            <SectionHeader
              eyebrow={mode === "ai" ? "Fallback" : "Caminho manual"}
              title={mode === "ai" ? "Revisar ou completar manualmente" : "Preencher medidas iniciais"}
              description="Use esta etapa quando a planta não estiver disponível ou quando dados extraídos precisarem de complemento."
            />
            <StartProjectForm />
          </div>
          <StickySummary title="Resumo antes da confirmação técnica" description="O sistema construtivo só deve ser confirmado depois dos dados base.">
            <div className="space-y-2 text-muted-foreground">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
                Local, UF e dimensões definem o estudo inicial.
              </p>
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
                Quantitativos e orçamento continuam preliminares e revisáveis.
              </p>
              <p className="flex items-start gap-2">
                <Clock3 className="mt-1 h-4 w-4 shrink-0 text-amber-700" />
                Ambientes, paredes, portas, janelas e premissas entram em etapas próprias.
              </p>
            </div>
          </StickySummary>
        </section>
      ) : null}
    </PageFrame>
  );
}
