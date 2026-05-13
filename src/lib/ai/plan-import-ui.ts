export type PlanImportState = "idle" | "uploading" | "analyzing" | "cache-hit" | "review-ready" | "error" | "limit-exceeded" | "temporarily-unavailable" | "applied";

export type PlanImportStateCopy = {
  badge: string;
  title: string;
  description: string;
  progress?: number;
};

export type PlanImportAiMode = "free-cloud" | "paid";

export type PlanImportProviderUiStatus = {
  mode: PlanImportAiMode;
  modeLabel: string;
  primaryProviderLabel: string;
  reviewProviderLabel?: string;
  textProviderLabel?: string;
  textFallbackProviderLabel?: string;
  paidFallbackEnabled: boolean;
  primaryConfigured: boolean;
  reviewConfigured: boolean;
};

export const defaultPlanImportProviderUiStatus: PlanImportProviderUiStatus = {
  mode: "paid",
  modeLabel: "Modo Pro",
  primaryProviderLabel: "Revisão detalhada",
  paidFallbackEnabled: false,
  primaryConfigured: false,
  reviewConfigured: false,
};

export const planImportStateCopy: Record<PlanImportState, PlanImportStateCopy> = {
  idle: {
    badge: "Modo Pro",
    title: "Arraste a planta aqui",
    description: "PNG, JPG, WebP ou PDF. Nada será aplicado sem revisão.",
  },
  uploading: {
    badge: "Enviando",
    title: "Enviando arquivo",
    description: "Arquivo enviado com segurança para análise.",
    progress: 32,
  },
  analyzing: {
    badge: "Analisando",
    title: "Analisando em Modo Pro",
    description: "Extraindo campos preliminares, evidências e incertezas.",
    progress: 68,
  },
  "cache-hit": {
    badge: "Cache hit",
    title: "Revisão pronta pelo cache",
    description: "Resultado reaproveitado pelo hash do arquivo. O limite diário não foi consumido.",
  },
  "review-ready": {
    badge: "Revisão pronta",
    title: "Revise antes de aplicar",
    description: "Selecione, edite ou descarte os campos extraídos.",
  },
  error: {
    badge: "Requer atenção",
    title: "Não foi possível analisar",
    description: "Confira o arquivo ou continue pelo preenchimento manual.",
  },
  "limit-exceeded": {
    badge: "Limite diário",
    title: "Envio por IA indisponível hoje",
    description: "Continue manualmente ou tente novamente amanhã.",
  },
  "temporarily-unavailable": {
    badge: "Continuar manualmente",
    title: "Upload assistido temporariamente indisponível",
    description: "Continue manualmente enquanto a configuração é verificada.",
  },
  applied: {
    badge: "Aplicado",
    title: "Campos aplicados",
    description: "Revise as medidas antes de seguir para método e orçamento.",
  },
};

export function getPlanImportStateCopy(state: PlanImportState, providerStatus: PlanImportProviderUiStatus = defaultPlanImportProviderUiStatus): PlanImportStateCopy {
  if (providerStatus.mode !== "free-cloud") return planImportStateCopy[state];

  const freeCloudCopy: Partial<Record<PlanImportState, PlanImportStateCopy>> = {
    idle: {
      badge: "Modo gratuito",
      title: "Arraste a planta aqui",
      description: "PDF, PNG, JPG ou WebP. A análise sugere; você revisa antes de aplicar.",
    },
    uploading: {
      badge: "Enviando",
      title: "Enviando arquivo",
      description: "Arquivo enviado com segurança para análise.",
      progress: 32,
    },
    analyzing: {
      badge: "Analisando",
      title: providerStatus.primaryProviderLabel,
      description: providerStatus.reviewProviderLabel
        ? `${providerStatus.reviewProviderLabel} opcional; divergências ficam pendentes.`
        : "Extraindo campos preliminares, evidências e incertezas.",
      progress: 68,
    },
    error: {
      badge: "Continuar manualmente",
      title: "Análise indisponível",
      description: "Continue pelo preenchimento manual ou tente outro arquivo quando o limite externo liberar.",
    },
    "limit-exceeded": {
      badge: "Limite gratuito",
      title: "Envio por IA indisponível hoje",
      description: "Continue manualmente ou tente novamente amanhã.",
    },
    "temporarily-unavailable": {
      badge: "Continuar manualmente",
      title: "Upload assistido temporariamente indisponível",
      description: "Continue manualmente enquanto a configuração é verificada.",
    },
  };

  return freeCloudCopy[state] ?? planImportStateCopy[state];
}

export function canUsePlanImportUpload({
  planExtractEnabled,
  state,
}: {
  planExtractEnabled: boolean;
  state: PlanImportState;
}) {
  return planExtractEnabled && state !== "uploading" && state !== "analyzing" && state !== "limit-exceeded";
}

export function getPlanImportStateFromResponse({
  ok,
  status,
  cached,
  cacheHeader,
  reason,
}: {
  ok: boolean;
  status: number;
  cached?: boolean;
  cacheHeader?: string | null;
  reason?: string;
}): PlanImportState {
  if (!ok) {
    if (status === 429 && reason?.endsWith("-daily-limit-exceeded")) return "limit-exceeded";
    if (status === 503) return "temporarily-unavailable";
    return "error";
  }
  return cached || cacheHeader?.toUpperCase() === "HIT" ? "cache-hit" : "review-ready";
}

export function getPlanImportPayloadMessage(payload: unknown, state: PlanImportState) {
  if (state === "limit-exceeded") return planImportStateCopy["limit-exceeded"].description;
  if (state === "temporarily-unavailable") return planImportStateCopy["temporarily-unavailable"].description;

  if (typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  if (state === "cache-hit") return planImportStateCopy["cache-hit"].description;
  if (state === "review-ready") return "Extração concluída. Revise os campos antes de aplicar.";
  return "Não foi possível analisar a planta agora.";
}

export function formatPlanImportProviderName(provider?: string) {
  if (!provider) return undefined;
  return provider === "openai" ? "Modo Pro" : "Modo gratuito";
}
