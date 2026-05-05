export type PlanImportState = "idle" | "uploading" | "analyzing" | "cache-hit" | "review-ready" | "error" | "limit-exceeded" | "applied";

export type PlanImportStateCopy = {
  badge: string;
  title: string;
  description: string;
  progress?: number;
};

export const planImportStateCopy: Record<PlanImportState, PlanImportStateCopy> = {
  idle: {
    badge: "OpenAI sob demanda",
    title: "Arraste a planta aqui",
    description: "PNG, JPG, WebP ou PDF. Nada sera aplicado sem revisao.",
  },
  uploading: {
    badge: "Enviando",
    title: "Enviando arquivo",
    description: "A chave OpenAI permanece somente no servidor.",
    progress: 32,
  },
  analyzing: {
    badge: "Analisando",
    title: "Analisando com OpenAI",
    description: "Extraindo campos preliminares, evidencias e incertezas.",
    progress: 68,
  },
  "cache-hit": {
    badge: "Cache hit",
    title: "Revisao pronta pelo cache",
    description: "Resultado reaproveitado pelo hash do arquivo. O limite diario nao foi consumido.",
  },
  "review-ready": {
    badge: "Revisao pronta",
    title: "Revise antes de aplicar",
    description: "Selecione, edite ou descarte os campos extraidos.",
  },
  error: {
    badge: "Requer atencao",
    title: "Nao foi possivel analisar",
    description: "Confira o arquivo ou continue pelo preenchimento manual.",
  },
  "limit-exceeded": {
    badge: "Limite diario",
    title: "Limite de IA atingido",
    description: "O preenchimento manual continua disponivel.",
  },
  applied: {
    badge: "Aplicado",
    title: "Campos aplicados",
    description: "Revise as medidas antes de seguir para metodo e orcamento.",
  },
};

export function getPlanImportStateFromResponse({
  ok,
  status,
  cached,
  cacheHeader,
}: {
  ok: boolean;
  status: number;
  cached?: boolean;
  cacheHeader?: string | null;
}): PlanImportState {
  if (!ok) return status === 429 ? "limit-exceeded" : "error";
  return cached || cacheHeader?.toUpperCase() === "HIT" ? "cache-hit" : "review-ready";
}

export function getPlanImportPayloadMessage(payload: unknown, state: PlanImportState) {
  if (typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  if (state === "limit-exceeded") return "Limite diario de IA atingido. Voce ainda pode preencher manualmente.";
  if (state === "cache-hit") return planImportStateCopy["cache-hit"].description;
  if (state === "review-ready") return "Extracao concluida. Revise os campos antes de aplicar.";
  return "Nao foi possivel analisar a planta agora.";
}
