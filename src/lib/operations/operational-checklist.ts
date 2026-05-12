import type { Project, Scenario } from "@/types/project";
import { calculateScenarioBudget } from "@/lib/construction-methods/scenario-calculations";

export type OperationalChecklistTone = "ok" | "warning" | "muted";

export interface OperationalEnvironmentStatus {
  aiPlanExtractEnabled: boolean;
  aiMode: "free-cloud" | "paid";
  aiProviderConfigured: boolean;
  aiModelConfigured: boolean;
  providerLabel: string;
  dailyLimitLabel: string;
  centralPriceDbConfigured: boolean;
  centralPriceDbLabel: string;
  lastMonthlySyncLabel: string;
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

function createLocalPriceSources(project: Project) {
  const sources = [...project.budgetAssistant.priceSources, ...project.budgetAssistant.costSources];
  return Array.from(new Map(sources.map((source) => [source.id, source])).values());
}

function getLatestReferenceMonth(project: Project) {
  const references = createLocalPriceSources(project)
    .map((source) => source.referenceDate.trim())
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
  const latest = references[0];
  if (!latest) return "";
  const monthMatch = latest.match(/^(\d{4})-(\d{2})/);
  return monthMatch ? `${monthMatch[1]}-${monthMatch[2]}` : latest;
}

function getExportReadiness(project: Project, scenario: Scenario | null) {
  if (!scenario) {
    return {
      status: "sem cenário",
      detail: "Crie ou selecione um cenário antes de exportar.",
      tone: "warning" as const,
    };
  }

  const budget = calculateScenarioBudget(project, scenario);
  const pendingItems = budget.items.filter((item) => item.requiresConfirmation).length;
  const warningCount = budget.warnings.filter((warning) => warning.level !== "info").length;
  if (pendingItems > 0 || warningCount > 0) {
    return {
      status: "preliminar",
      detail: `${pendingItems} item(ns) pedem revisão e ${warningCount} aviso(s) devem acompanhar o pacote.`,
      tone: "warning" as const,
    };
  }

  return {
    status: "pronta",
    detail: "Exportação preliminar pode ser gerada sem bloqueios operacionais.",
    tone: "ok" as const,
  };
}

export function createOperationalChecklist(
  environment: OperationalEnvironmentStatus,
  project: Project,
  scenario: Scenario | null = resolveSelectedScenario(project)
): OperationalChecklistItem[] {
  const localPriceSources = createLocalPriceSources(project);
  const sinapiSources = project.budgetAssistant.priceSources.filter((source) => source.type === "sinapi");
  const hasSinapiCompositions = project.budgetAssistant.serviceCompositions.some((composition) =>
    sinapiSources.some((source) => source.id === composition.sourceId)
  );
  const hasSinapiBase = sinapiSources.length > 0 || hasSinapiCompositions;
  const aiOperational = environment.aiPlanExtractEnabled && environment.aiProviderConfigured;
  const planExtractPending = environment.aiPlanExtractEnabled && !environment.aiProviderConfigured;
  const scenarioLocation = scenario?.location as Partial<Scenario["location"]> | undefined;
  const scenarioState = typeof scenarioLocation?.state === "string" ? scenarioLocation.state.trim() : "";
  const latestReferenceMonth = getLatestReferenceMonth(project);
  const hasRegime = hasSinapiRegimeMetadata(project);
  const exportReadiness = getExportReadiness(project, scenario);

  return [
    {
      id: "ai",
      label: "IA",
      status: environment.providerLabel,
      detail:
        environment.aiMode === "paid"
          ? "Modo Pro fica explícito e sem fallback pago automático."
          : "Modo gratuito mantém análise rápida e revisão humana antes de aplicar dados.",
      tone: "ok",
    },
    {
      id: "plan-extract",
      label: "Upload assistido",
      status: aiOperational ? "ativo" : planExtractPending ? "pendente" : "desligado",
      detail: aiOperational
        ? "Análise de planta pode ser usada; dados extraídos continuam exigindo revisão."
        : "Continue pelo preenchimento manual até a análise assistida estar pronta.",
      technicalDetail:
        environment.aiMode === "paid"
          ? "Verifique AI_PLAN_EXTRACT_ENABLED, OPENAI_API_KEY e AI_OPENAI_MODEL no servidor."
          : "Verifique AI_PLAN_EXTRACT_ENABLED, AI_MODE=free-cloud, GEMINI_API_KEY e GEMINI_MODEL no servidor.",
      tone: aiOperational ? "ok" : "warning",
    },
    {
      id: "manual-fallback",
      label: "Fallback manual",
      status: "disponível",
      detail: "Dados da obra, ambientes, preços e exportação continuam operáveis sem IA ou base central.",
      tone: "ok",
    },
    {
      id: "ai-config",
      label: "Configuração IA",
      status: environment.aiModelConfigured ? "pronta" : "ausente",
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
      id: "local-price-base",
      label: "Base local",
      status: localPriceSources.length > 0 ? `${localPriceSources.length} fonte(s)` : "ausente",
      detail:
        localPriceSources.length > 0
          ? "Fontes importadas ou manuais estão disponíveis para revisão de preços."
          : "Importe uma base de preços ou cadastre uma fonte manual para revisar orçamento.",
      tone: localPriceSources.length > 0 ? "ok" : "warning",
    },
    {
      id: "central-db",
      label: "Base central",
      status: environment.centralPriceDbLabel,
      detail: environment.centralPriceDbConfigured
        ? "Busca central pode ser apresentada como candidata; preços ainda exigem aprovação."
        : "Base central não é dependência: use importação local ou fonte manual revisável.",
      technicalDetail: environment.centralPriceDbConfigured
        ? "Leitura pública configurada; chave de serviço não é usada no app."
        : "Sem runtime remoto configurado; não há busca automática em banco central.",
      tone: environment.centralPriceDbConfigured ? "ok" : "muted",
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
      status: latestReferenceMonth || "ausente",
      detail: latestReferenceMonth ? `Referência mais recente nas fontes locais: ${latestReferenceMonth}.` : "Fontes de preço precisam de referência/data-base.",
      tone: latestReferenceMonth ? "ok" : "warning",
    },
    {
      id: "monthly-sync",
      label: "Sync mensal",
      status: environment.lastMonthlySyncLabel,
      detail: environment.centralPriceDbConfigured
        ? "A última sincronização ainda não é informada pelo app."
        : "Sync mensal depende da base central futura; fluxo local continua disponível.",
      tone: "muted",
    },
    {
      id: "export",
      label: "Exportação",
      status: exportReadiness.status,
      detail: exportReadiness.detail,
      tone: exportReadiness.tone,
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
