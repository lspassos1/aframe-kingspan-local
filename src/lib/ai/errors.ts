export class AiPlanExtractError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 500
  ) {
    super(message);
    this.name = "AiPlanExtractError";
  }
}

export class AiProviderUnavailableError extends AiPlanExtractError {
  constructor(message = "Nenhum provider de IA esta configurado para extracao de planta.") {
    super(message, "ai-provider-unavailable", 503);
    this.name = "AiProviderUnavailableError";
  }
}

export class AiProviderChainError extends AiPlanExtractError {
  constructor(readonly providerErrors: Array<{ provider: string; message: string }>) {
    super("Todos os providers configurados falharam ao extrair a planta.", "ai-provider-chain-failed", 502);
    this.name = "AiProviderChainError";
  }
}

export class AiRateLimitError extends AiPlanExtractError {
  constructor(message: string, readonly headers: Record<string, string>) {
    super(message, "ai-rate-limit-exceeded", 429);
    this.name = "AiRateLimitError";
  }
}
