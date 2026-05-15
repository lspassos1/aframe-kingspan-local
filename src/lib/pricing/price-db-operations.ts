export type ExternalPriceDbStatus = "missing-config" | "missing-sync" | "read-failed" | "sync-running" | "sync-failed" | "stale-data" | "ready";
export type ExternalPriceDbOperationalTone = "ok" | "warning" | "muted";

export interface ExternalPriceDbSourceSnapshot {
  status?: "active" | "staging" | "archived" | "failed" | string;
  state?: string;
  referenceMonth?: string;
  regime?: string;
  updatedAt?: string;
}

export interface ExternalPriceDbSyncRunSnapshot {
  status?: "started" | "running" | "completed" | "failed" | string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface ExternalPriceDbReadProbeSnapshot {
  status?: "not-run" | "ok" | "failed" | string;
  checkedAt?: string;
  errorMessage?: string;
}

export interface ExternalPriceDbOperationalInput {
  configured: boolean;
  latestSource?: ExternalPriceDbSourceSnapshot;
  latestSyncRun?: ExternalPriceDbSyncRunSnapshot;
  readProbe?: ExternalPriceDbReadProbeSnapshot;
  now?: Date | string;
  staleAfterDays?: number;
}

export interface ExternalPriceDbOperationalStatus {
  configured: boolean;
  status: ExternalPriceDbStatus;
  centralLabel: string;
  syncLabel: string;
  detail: string;
  syncDetail: string;
  technicalDetail: string;
  tone: ExternalPriceDbOperationalTone;
  stale: boolean;
  lastReferenceMonth: string;
  safeError?: string;
}

// Jan/Jul SINAPI cadence plus operational grace before warning as stale.
const defaultStaleAfterDays = 210;
const serviceRoleKeyPattern = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
const serviceRolePattern = ["service", "role"].join("_");
const secretAssignmentPattern = new RegExp(`\\b(${serviceRoleKeyPattern}|${serviceRolePattern})\\s*[:=]\\s*\\S+`, "gi");

export function createExternalPriceDbOperationalStatus(input: ExternalPriceDbOperationalInput): ExternalPriceDbOperationalStatus {
  if (!input.configured) {
    return {
      configured: false,
      status: "missing-config",
      centralLabel: "não configurada",
      syncLabel: "sem configuração",
      detail: "Base central não é dependência: use importação local ou fonte manual revisável.",
      syncDetail: "Configure leitura pública antes de tratar a atualização semestral como disponível.",
      technicalDetail: "Runtime sem configuração pública de leitura. Chave de serviço não pertence ao app.",
      tone: "muted",
      stale: false,
      lastReferenceMonth: "",
    };
  }

  if (isFailedRun(input.latestSyncRun)) {
    const safeError = sanitizeOperationalError(input.latestSyncRun?.errorMessage);
    return {
      configured: true,
      status: "sync-failed",
      centralLabel: "configurada",
      syncLabel: "falha no sync",
      detail: "Base central configurada, mas último sync falhou; manter importação local ou preço manual até revisão.",
      syncDetail: safeError ? `Falha registrada sem segredo: ${safeError}` : "Falha registrada sem detalhe público seguro.",
      technicalDetail: "Revise o workflow/admin sync. Não exponha service role no app ou Vercel.",
      tone: "warning",
      stale: true,
      lastReferenceMonth: normalizeReferenceMonth(input.latestSource?.referenceMonth),
      safeError,
    };
  }

  if (isRunningRun(input.latestSyncRun)) {
    return {
      configured: true,
      status: "sync-running",
      centralLabel: "configurada",
      syncLabel: "sync em andamento",
      detail: "Base central configurada; enquanto o sync roda, candidatos existentes continuam pendentes de revisão.",
      syncDetail: "Aguarde conclusão do workflow antes de considerar a referência atualizada.",
      technicalDetail: "Status operacional derivado de snapshot seguro; não há consulta admin no app.",
      tone: "muted",
      stale: false,
      lastReferenceMonth: normalizeReferenceMonth(input.latestSource?.referenceMonth),
    };
  }

  if (isFailedReadProbe(input.readProbe)) {
    const safeError = sanitizeOperationalError(input.readProbe?.errorMessage);
    const readFailedReferenceMonth = normalizeReferenceMonth(input.latestSource?.referenceMonth);
    return {
      configured: true,
      status: "read-failed",
      centralLabel: "configurada",
      syncLabel: "busca indisponível",
      detail: "Busca central indisponível; use importação local ou fonte manual revisável até a leitura pública responder.",
      syncDetail: safeError ? `Falha de leitura segura: ${safeError}` : "Falha de leitura sem detalhe público seguro.",
      technicalDetail: "RPC de preços/leitura pública falhou sem expor URL, token ou payload bruto.",
      tone: "warning",
      stale: readFailedReferenceMonth ? isReferenceMonthStale(readFailedReferenceMonth, input.now, input.staleAfterDays ?? defaultStaleAfterDays) : false,
      lastReferenceMonth: readFailedReferenceMonth,
      safeError,
    };
  }

  const referenceMonth = normalizeReferenceMonth(input.latestSource?.referenceMonth);
  if (!isActiveSource(input.latestSource) || !referenceMonth) {
    return {
      configured: true,
      status: "missing-sync",
      centralLabel: "configurada",
      syncLabel: "sem registro",
      detail: "Base central configurada, mas sem fonte ativa informada; use candidatos apenas após validação operacional.",
      syncDetail:
        input.readProbe?.status === "ok"
          ? "RPC de preços respondendo; sem fonte ativa pública informada. Fluxo local/manual continua disponível."
          : "Sem registro público seguro de sync. Fluxo local/manual continua disponível.",
      technicalDetail: "O app não lê price_sync_runs com credencial pública; exponha apenas snapshots operacionais seguros.",
      tone: "warning",
      stale: false,
      lastReferenceMonth: "",
    };
  }

  const stale = isReferenceMonthStale(referenceMonth, input.now, input.staleAfterDays ?? defaultStaleAfterDays);
  if (stale) {
    return {
      configured: true,
      status: "stale-data",
      centralLabel: "configurada",
      syncLabel: "dados antigos",
      detail: "Base central configurada, mas a referência está antiga; manter revisão obrigatória e fallback local.",
      syncDetail: `Última referência segura: ${referenceMonth}. Rode dry-run/write manual antes de promover nova base.`,
      technicalDetail: "Dados antigos não bloqueiam o app; candidatos seguem pendentes e não são autoaprovados.",
      tone: "warning",
      stale: true,
      lastReferenceMonth: referenceMonth,
    };
  }

  return {
    configured: true,
    status: "ready",
    centralLabel: "configurada",
    syncLabel: referenceMonth ? `atualizada ${referenceMonth}` : "configurada",
    detail: "Busca central pode ser apresentada como candidata; preços ainda exigem aprovação.",
    syncDetail: referenceMonth ? `Última fonte ativa: ${referenceMonth}.` : "Configuração pronta; referência ainda não informada.",
    technicalDetail:
      input.readProbe?.status === "ok"
        ? "RPC de preços respondendo; leitura pública configurada; chave de serviço não é usada no app."
        : "Leitura pública configurada; chave de serviço não é usada no app.",
    tone: "ok",
    stale: false,
    lastReferenceMonth: referenceMonth,
  };
}

export function sanitizeOperationalError(message: string | undefined): string {
  const sanitized = removeStackTraceLines(message)
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(secretAssignmentPattern, "$1=[redacted]")
    .replace(/\bAuthorization\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi, "Authorization [redacted]")
    .replace(/\bAuthorization\s+Bearer\s+[^\s,;]+/gi, "Authorization [redacted]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/\b(x-api-key|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1 [redacted]")
    .replace(new RegExp(`\\b(${serviceRoleKeyPattern}|${serviceRolePattern})\\b`, "gi"), "[redacted]")
    .replace(/[A-Za-z0-9_-]{28,}/g, "[redacted]")
    .trim();
  return sanitized.slice(0, 180);
}

function removeStackTraceLines(message: string | undefined) {
  return String(message ?? "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*at\s+/.test(line))
    .join(" ");
}

function isFailedRun(run: ExternalPriceDbSyncRunSnapshot | undefined) {
  return run?.status === "failed";
}

function isRunningRun(run: ExternalPriceDbSyncRunSnapshot | undefined) {
  return run?.status === "started" || run?.status === "running";
}

function isFailedReadProbe(probe: ExternalPriceDbReadProbeSnapshot | undefined) {
  return probe?.status === "failed";
}

function isActiveSource(source: ExternalPriceDbSourceSnapshot | undefined) {
  return source?.status === "active";
}

function normalizeReferenceMonth(value: string | undefined) {
  const normalized = String(value ?? "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] ? Number(match[3]) : 1;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) return "";
  if (day > getDaysInMonth(year, month)) return "";
  return `${match[1]}-${match[2]}`;
}

function getDaysInMonth(year: number, month: number) {
  const daysByMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysByMonth[month - 1] ?? 0;
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isReferenceMonthStale(referenceMonth: string, now: Date | string | undefined, staleAfterDays: number) {
  if (!referenceMonth) return false;
  const referenceDate = new Date(`${referenceMonth}-01T00:00:00Z`);
  const nowDate = now ? new Date(now) : new Date();
  if (Number.isNaN(referenceDate.getTime()) || Number.isNaN(nowDate.getTime())) return false;
  const elapsedMs = nowDate.getTime() - referenceDate.getTime();
  return elapsedMs > staleAfterDays * 24 * 60 * 60 * 1000;
}
