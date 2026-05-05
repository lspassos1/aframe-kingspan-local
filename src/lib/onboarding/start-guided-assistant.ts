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

export function createStartAssistantViewModel({
  mode,
  planExtractEnabled,
}: {
  mode: StartAssistantMode;
  planExtractEnabled: boolean;
}): StartAssistantViewModel {
  const options: StartAssistantOption[] = [
    {
      id: "ai",
      title: "Enviar planta baixa",
      description: planExtractEnabled ? "A IA lê a planta e você revisa os campos." : "Disponível quando a OpenAI API estiver configurada.",
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
        ? "Envie uma planta, preencha medidas simples ou use um exemplo. Você revisa tudo antes de gerar orçamento e 3D."
        : "A etapa de método construtivo vem depois da planta ou das medidas iniciais.",
    options,
    showPlanImport: mode === "ai",
    showManualForm: mode === "manual" || mode === "ai",
    showAiDisabledNotice: mode === "ai" && !planExtractEnabled,
    shouldRunExample: mode === "example",
  };
}
