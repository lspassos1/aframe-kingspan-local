import type { Project, Scenario } from "@/types/project";

export type OperationalChecklistTone = "ok" | "warning" | "muted";

export interface OperationalEnvironmentStatus {
  aiPlanExtractEnabled: boolean;
  openAiApiKeyConfigured: boolean;
  openAiModelConfigured: boolean;
  providerLabel: "OpenAI";
  dailyLimitLabel: string;
}

export interface OperationalChecklistItem {
  id: string;
  label: string;
  status: string;
  detail: string;
  tone: OperationalChecklistTone;
}

function resolveSelectedScenario(project: Project): Scenario {
  return project.scenarios.find((scenario) => scenario.id === project.selectedScenarioId) ?? project.scenarios[0];
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
  scenario: Scenario = resolveSelectedScenario(project)
): OperationalChecklistItem[] {
  const sinapiSources = project.budgetAssistant.priceSources.filter((source) => source.type === "sinapi");
  const hasSinapiCompositions = project.budgetAssistant.serviceCompositions.some((composition) =>
    sinapiSources.some((source) => source.id === composition.sourceId)
  );
  const hasSinapiBase = sinapiSources.length > 0 || hasSinapiCompositions;
  const aiOperational = environment.aiPlanExtractEnabled && environment.openAiApiKeyConfigured && environment.openAiModelConfigured;
  const scenarioState = scenario.location.state.trim();
  const hasSinapiReference = sinapiSources.some((source) => source.referenceDate.trim());
  const hasRegime = hasSinapiRegimeMetadata(project);

  return [
    {
      id: "ai",
      label: "IA",
      status: aiOperational ? "ativa" : "desligada",
      detail: aiOperational
        ? "Upload assistido pode ser exibido no início."
        : "Verifique flag, OPENAI_API_KEY no servidor e modelo OpenAI.",
      tone: aiOperational ? "ok" : "warning",
    },
    {
      id: "provider",
      label: "Provider",
      status: environment.providerLabel,
      detail: "Provider oficial desta entrega. Outros providers não são necessários.",
      tone: "ok",
    },
    {
      id: "model",
      label: "Modelo",
      status: environment.openAiModelConfigured ? "configurado" : "ausente",
      detail: environment.openAiModelConfigured ? "AI_OPENAI_MODEL está definido." : "Defina AI_OPENAI_MODEL no ambiente do servidor.",
      tone: environment.openAiModelConfigured ? "ok" : "warning",
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
