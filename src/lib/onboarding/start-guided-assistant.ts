export type StartAssistantMode = "choose" | "ai" | "manual" | "example";

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
