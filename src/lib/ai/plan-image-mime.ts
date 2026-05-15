import type { AiProductMode } from "@/lib/ai/mode";

export type AiPlanExtractImageMimeType = "image/png" | "image/jpeg" | "image/webp";

export function isPlanExtractImageMimeType(mimeType: string | undefined): mimeType is AiPlanExtractImageMimeType {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/webp";
}

export function shouldPreprocessPlanExtractImage({ mode, mimeType }: { mode: AiProductMode; mimeType: string | undefined }) {
  return mode === "free-cloud" && isPlanExtractImageMimeType(mimeType);
}
