import type { AiPlanExtractMimeType } from "@/lib/ai/providers";

export const supportedPlanExtractMimeTypes: AiPlanExtractMimeType[] = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export type PlanExtractFileValidationInput = {
  name: string;
  type: string;
  size: number;
};

export type PlanExtractFileValidationResult =
  | { valid: true; mimeType: AiPlanExtractMimeType; maxBytes: number }
  | { valid: false; status: number; message: string; maxBytes: number };

export function getAiPlanExtractMaxFileBytes(env: Record<string, string | undefined> = process.env) {
  const maxFileMb = Number(env.AI_PLAN_EXTRACT_MAX_FILE_MB ?? 8);
  const safeMaxFileMb = Number.isFinite(maxFileMb) && maxFileMb > 0 ? maxFileMb : 8;
  return safeMaxFileMb * 1024 * 1024;
}

export function isAiPlanExtractEnabled(env: Record<string, string | undefined> = process.env) {
  return env.AI_PLAN_EXTRACT_ENABLED === "true";
}

export function sanitizePlanExtractFileName(name: string) {
  const normalized = name.trim().replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  return normalized || "planta";
}

export function validatePlanExtractFile(file: PlanExtractFileValidationInput, env: Record<string, string | undefined> = process.env): PlanExtractFileValidationResult {
  const maxBytes = getAiPlanExtractMaxFileBytes(env);
  if (!supportedPlanExtractMimeTypes.includes(file.type as AiPlanExtractMimeType)) {
    return {
      valid: false,
      status: 415,
      message: "Envie uma imagem PNG, JPG, WebP ou PDF.",
      maxBytes,
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      status: 400,
      message: "O arquivo enviado esta vazio.",
      maxBytes,
    };
  }

  if (file.size > maxBytes) {
    return {
      valid: false,
      status: 413,
      message: `Arquivo acima do limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`,
      maxBytes,
    };
  }

  return {
    valid: true,
    mimeType: file.type as AiPlanExtractMimeType,
    maxBytes,
  };
}
