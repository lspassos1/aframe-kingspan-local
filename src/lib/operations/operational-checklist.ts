import type { Project, Scenario } from "@/types/project";

export type OperationalChecklistTone = "ok" | "warning" | "muted";

export interface OperationalEnvironmentStatus {
  aiPlanExtractEnabled: boolean;
  aiMode: "free-cloud" | "paid";
  aiProviderConfigured: boolean;
  aiModelConfigured: boolean;
  providerLabel: string;
  dailyLimitLabel: string;
}

export interface OperationalChecklistItem {
  id: string;
  label: string;
  status: string;
  detail: string;
  technicalDetail?: string;
  tone: OperationalChecklistTone;
}

function resolveSelectedScenario(project: Project): Scenario | null {
  return project.scenarios.find((scenario) => scenario.id === project.selectedScenarioId) ?? project.scenarios[0] ?? null;
}

function hasSinapiRegimeMetadata(project: Project) {
  return project.budgetAssistant.priceSources.some((source) => {
    if (source.type !== "sinapi") return false;
    const text = `${source.title} ${source.notes}`.toLowerCase();
    return text.includes("desonerado") || text.includes("onerado") || text.includes("não desonerado") || text.includes("nao desonerado");
  });
}

export function createOperationalChecklist(
  environment: OperationalEnvironmentStatus,
  project: Project,
  scenario: Scenario | null = resolveSelectedScenario(project)
): OperationalChecklistItem[] {
  const sinapiSources = project.budgetAssistant.priceSources.filter((source) => source.type === "sinapi");
  const hasSinapiCompositions = project.budgetAssistant.serviceCompositions.some((composition) =>
    sinapiSources.some((source) => source.id === composition.sourceId)
  );
  const hasSinapiBase = sinapiSources.length > 0 || hasSinapiCompositions;
  const aiOperational = environment.aiPlanExtractEnabled && environment.aiProviderConfigured;
  const scenarioLocation = scenario?.location as Partial<Scenario["location"]> | undefined;
  const scenarioState = typeof scenarioLocation?.state === "string" ? scenarioLocation.state.trim() : "";
  const hasSinapiReference = sinapiSources.some((source) => source.referenceDate.trim());
  const hasRegime = hasSinapiRegimeMetadata(project);

  return [
    {
      id: "ai",
      label: "IA",
      status: aiOperational ? "ativa" : "desligada",
      detail: aiOperational
        ? "Upload assistido pode ser exibido no início. Confira o modo de análise abaixo."
        : "Ative a análise no ambiente do servidor ou continue pelo preenchimento manual.",
      technicalDetail:
        environment.aiMode === "paid"
          ? "Verifique AI_PLAN_EXTRACT_ENABLED, OPENAI_API_KEY e AI_OPENAI_MODEL no servidor."
          : "Verifique AI_PLAN_EXTRACT_ENABLED, AI_MODE=free-cloud, GEMINI_API_KEY e GEMINI_MODEL no servidor.",
      tone: aiOperational ? "ok" : "warning",
    },
    {
      id: "provider",
      label: "Modo",
      status: environment.providerLabel,
      detail:
        environment.aiMode === "paid"
          ? "Modo Pro usa análise paga explícita. Premium fica reservado para comparação futura."
          : "Modo gratuito usa análise rápida, revisão opcional e resumo de pendências.",
      tone: "ok",
    },
    {
      id: "model",
      label: "Configuração",
      status: environment.aiModelConfigured ? "configurado" : "ausente",
      detail: environment.aiModelConfigured ? "Configuração do modo atual está pronta." : "Complete a configuração do modo atual no servidor.",
      technicalDetail:
        environment.aiMode === "paid"
          ? environment.aiModelConfigured
            ? "AI_OPENAI_MODEL está definido."
            : "Defina AI_OPENAI_MODEL no ambiente do servidor."
          : environment.aiModelConfigured
            ? "GEMINI_MODEL está definido."
            : "Defina GEMINI_MODEL no ambiente do servidor.",
      tone: environment.aiModelConfigured ? "ok" : "warning",
    },
    {
      id: "daily-limit",
      label: "Limite diário",
      status: "disponível",
      detail: environment.dailyLimitLabel,
      tone: "ok",
    },
    {
      id: "sinapi",
      label: "SINAPI",
      status: hasSinapiBase ? "base importada" : "base ausente",
      detail: hasSinapiBase ? `${sinapiSources.length} fonte(s) SINAPI no projeto.` : "Importe uma base na tela Base de preços.",
      tone: hasSinapiBase ? "ok" : "warning",
    },
    {
      id: "state",
      label: "UF",
      status: scenarioState ? "definida" : "ausente",
      detail: scenarioState ? `UF do cenário: ${scenarioState}.` : "Informe a UF em Dados da obra.",
      tone: scenarioState ? "ok" : "warning",
    },
    {
      id: "reference",
      label: "Referência",
      status: hasSinapiReference ? "definida" : "ausente",
      detail: hasSinapiReference ? "Há data-base em fonte SINAPI." : "A base SINAPI precisa de referência/data-base.",
      tone: hasSinapiReference ? "ok" : "warning",
    },
    {
      id: "regime",
      label: "Regime",
      status: hasRegime ? "definido" : "ausente",
      detail: hasRegime ? "Regime encontrado nos metadados da fonte." : "Regime será controlado pela camada SINAPI dos próximos PRs.",
      tone: hasRegime ? "ok" : "muted",
    },
  ];
}
