import type { PlanImportProviderUiStatus, PlanImportState } from "@/lib/ai/plan-import-ui";

export type StartAssistantMode = "choose" | "ai" | "manual" | "example";

export type StartAiStatusTone = "success" | "warning" | "pending" | "info";

export type StartAiStatusPill = {
  label: string;
  tone: StartAiStatusTone;
};

export type StartAssistantOption = {
  id: Exclude<StartAssistantMode, "choose">;
  title: string;
  description: string;
  primary: boolean;
  disabledReason?: string;
};

export type StartAssistantViewModel = {
  mode: StartAssistantMode;
  title: string;
  subtitle: string;
  options: StartAssistantOption[];
  showPlanImport: boolean;
  showManualForm: boolean;
  showAiDisabledNotice: boolean;
  shouldRunExample: boolean;
};

export function normalizeStartAssistantModeParam(value: string | string[] | undefined): StartAssistantMode {
  const mode = Array.isArray(value) ? value[0] : value;

  return mode === "ai" || mode === "manual" || mode === "example" ? mode : "choose";
}

export function createStartAssistantViewModel({
  mode,
  planExtractEnabled,
  aiMode = "paid",
}: {
  mode: StartAssistantMode;
  planExtractEnabled: boolean;
  aiMode?: "free-cloud" | "paid";
}): StartAssistantViewModel {
  const options: StartAssistantOption[] = [
    {
      id: "ai",
      title: "Enviar planta",
      description: planExtractEnabled
        ? aiMode === "free-cloud"
          ? "Análise rápida lê a planta; você revisa tudo."
          : "A IA lê a planta e você revisa os campos."
        : aiMode === "free-cloud"
          ? "Disponível quando o modo gratuito estiver configurado."
          : "Disponível quando o Modo Pro estiver configurado.",
      primary: planExtractEnabled,
      disabledReason: planExtractEnabled ? undefined : "IA desligada",
    },
    {
      id: "manual",
      title: "Preencher manualmente",
      description: "Informe medidas simples e avance para revisão.",
      primary: !planExtractEnabled,
    },
    {
      id: "example",
      title: "Usar exemplo",
      description: "Abrir um estudo preenchido para explorar o fluxo.",
      primary: false,
    },
  ];

  return {
    mode,
    title:
      mode === "ai"
        ? "Envie a planta baixa."
        : mode === "manual"
          ? "Preencha os dados da obra."
          : mode === "example"
            ? "Abrindo exemplo."
            : "Comece pela planta baixa.",
    subtitle:
      mode === "choose"
        ? "Envie uma planta, preencha medidas simples ou use um exemplo. IA sugere, sistema calcula e você aprova antes de gerar orçamento e 3D."
        : "Revise os dados antes de confirmar método, quantitativos e orçamento.",
    options,
    showPlanImport: mode === "ai",
    showManualForm: mode === "manual",
    showAiDisabledNotice: mode === "ai" && !planExtractEnabled,
    shouldRunExample: mode === "example",
  };
}

export function createStartAiStatusPills({
  planExtractEnabled,
  state,
  aiProviderStatus,
}: {
  planExtractEnabled: boolean;
  state: PlanImportState;
  aiProviderStatus: PlanImportProviderUiStatus;
}): StartAiStatusPill[] {
  if (!planExtractEnabled) {
    return [
      { label: "Upload aguardando configuração", tone: "warning" },
      { label: "Continuar manualmente disponível", tone: "info" },
    ];
  }

  if (state === "error") {
    return [
      { label: "Análise não concluída", tone: "warning" },
      { label: "Continuar manualmente disponível", tone: "info" },
      { label: "Tente outro arquivo quando possível", tone: "pending" },
    ];
  }

  if (state === "temporarily-unavailable") {
    return [
      { label: "Upload assistido temporariamente indisponível", tone: "warning" },
      { label: "Continuar manualmente disponível", tone: "info" },
    ];
  }

  if (state === "limit-exceeded") {
    return [
      { label: "Limite diário atingido", tone: "warning" },
      { label: "Continuar manualmente disponível", tone: "info" },
      { label: "Tente novamente amanhã", tone: "pending" },
    ];
  }

  if (state === "cache-hit") {
    return [
      { label: "Resultado recuperado do cache", tone: "success" },
      { label: "Revisão humana obrigatória", tone: "pending" },
      { label: "Continuar manualmente disponível", tone: "info" },
    ];
  }

  if (state === "review-ready") {
    return [
      { label: "Análise pronta para revisão", tone: "success" },
      { label: "Revisão humana obrigatória", tone: "pending" },
      { label: "Continuar manualmente disponível", tone: "info" },
    ];
  }

  if (state === "applied") {
    return [
      { label: "Campos aplicados", tone: "success" },
      { label: "Revisar medidas antes de seguir", tone: "pending" },
      { label: "Continuar manualmente disponível", tone: "info" },
    ];
  }

  if (state === "uploading" || state === "analyzing") {
    return [
      { label: state === "uploading" ? "Upload em andamento" : "Análise em andamento", tone: "pending" },
      { label: "Nada aplicado sem revisão", tone: "info" },
    ];
  }

  return [
    { label: "Upload habilitado", tone: "success" },
    { label: "Cache por hash ativo quando houver resultado", tone: "pending" },
    ...(aiProviderStatus.mode === "free-cloud" ? [{ label: "Análise gratuita depende de limites externos", tone: "warning" as const }] : []),
    { label: "Continuar manualmente disponível", tone: "info" },
  ];
}
