import { Buffer } from "node:buffer";
import sharp from "sharp";
import { isPlanExtractImageMimeType } from "@/lib/ai/plan-image-mime";
import { getPlanExtractFileSizeBucket, type PlanExtractImageProcessingDiagnostic } from "@/lib/ai/plan-extract-diagnostics";
import type { AiPlanExtractMimeType } from "@/lib/ai/providers";

const maxPlanImageDimension = 2048;
const heavyPngThresholdBytes = 2 * 1024 * 1024;

type PlanImageFormat = "png" | "jpeg" | "webp" | "unknown";

export type PlanImagePreprocessResult = {
  bytes: Buffer;
  mimeType: AiPlanExtractMimeType;
  diagnostic: PlanExtractImageProcessingDiagnostic;
};

function toFormat(mimeType: AiPlanExtractMimeType): PlanImageFormat {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpeg";
  if (mimeType === "image/webp") return "webp";
  return "unknown";
}

function toMimeType(format: PlanImageFormat, fallback: AiPlanExtractMimeType): AiPlanExtractMimeType {
  if (format === "png") return "image/png";
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return fallback;
}

function createDiagnostic({
  status,
  reason,
  originalBytes,
  processedBytes,
  originalWidth,
  originalHeight,
  processedWidth,
  processedHeight,
  originalFormat,
  processedFormat,
}: {
  status: PlanExtractImageProcessingDiagnostic["status"];
  reason: PlanExtractImageProcessingDiagnostic["reason"];
  originalBytes: number;
  processedBytes: number;
  originalWidth?: number;
  originalHeight?: number;
  processedWidth?: number;
  processedHeight?: number;
  originalFormat?: PlanImageFormat;
  processedFormat?: PlanImageFormat;
}): PlanExtractImageProcessingDiagnostic {
  return {
    status,
    reason,
    originalSizeBucket: getPlanExtractFileSizeBucket(originalBytes),
    processedSizeBucket: getPlanExtractFileSizeBucket(processedBytes),
    originalDimensions: originalWidth && originalHeight ? { width: originalWidth, height: originalHeight } : undefined,
    processedDimensions: processedWidth && processedHeight ? { width: processedWidth, height: processedHeight } : undefined,
    originalFormat: originalFormat ?? "unknown",
    processedFormat: processedFormat ?? originalFormat ?? "unknown",
  };
}

function getPreprocessReason({ shouldResize, shouldConvertHeavyPng }: { shouldResize: boolean; shouldConvertHeavyPng: boolean }) {
  if (shouldResize && shouldConvertHeavyPng) return "large-image-heavy-png";
  if (shouldResize) return "large-image";
  if (shouldConvertHeavyPng) return "heavy-png";
  return "within-limits";
}

async function readDimensions(bytes: Buffer) {
  const metadata = await sharp(bytes, { failOn: "none" }).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: (metadata.format === "jpg" ? "jpeg" : metadata.format) as PlanImageFormat | undefined,
  };
}

export async function preprocessPlanExtractImage({
  bytes,
  mimeType,
}: {
  bytes: Buffer;
  mimeType: AiPlanExtractMimeType;
}): Promise<PlanImagePreprocessResult> {
  if (!isPlanExtractImageMimeType(mimeType)) {
    return {
      bytes,
      mimeType,
      diagnostic: createDiagnostic({
        status: "skipped",
        reason: "non-image",
        originalBytes: bytes.byteLength,
        processedBytes: bytes.byteLength,
        originalFormat: toFormat(mimeType),
      }),
    };
  }

  try {
    const original = await readDimensions(bytes);
    const originalFormat = original.format ?? toFormat(mimeType);
    if (!original.width || !original.height) {
      return {
        bytes,
        mimeType,
        diagnostic: createDiagnostic({
          status: "unchanged",
          reason: "metadata-unavailable",
          originalBytes: bytes.byteLength,
          processedBytes: bytes.byteLength,
          originalFormat,
        }),
      };
    }

    const shouldResize = Math.max(original.width, original.height) > maxPlanImageDimension;
    const shouldConvertHeavyPng = mimeType === "image/png" && bytes.byteLength >= heavyPngThresholdBytes;
    const reason = getPreprocessReason({ shouldResize, shouldConvertHeavyPng });
    if (reason === "within-limits") {
      return {
        bytes,
        mimeType,
        diagnostic: createDiagnostic({
          status: "unchanged",
          reason,
          originalBytes: bytes.byteLength,
          processedBytes: bytes.byteLength,
          originalWidth: original.width,
          originalHeight: original.height,
          processedWidth: original.width,
          processedHeight: original.height,
          originalFormat,
        }),
      };
    }

    let targetFormat: PlanImageFormat = originalFormat;
    if (shouldConvertHeavyPng) targetFormat = "jpeg";

    let pipeline = sharp(bytes, { failOn: "none" }).rotate();
    if (shouldResize) {
      pipeline = pipeline.resize({
        width: maxPlanImageDimension,
        height: maxPlanImageDimension,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    if (targetFormat === "jpeg") {
      pipeline = pipeline.jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true });
    } else if (targetFormat === "webp") {
      pipeline = pipeline.webp({ quality: 88 });
    } else {
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    }

    const processed = await pipeline.toBuffer();
    const processedDimensions = await readDimensions(processed);
    const processedMimeType = toMimeType(targetFormat, mimeType);
    const shouldKeepOriginal = !shouldResize && processed.byteLength >= bytes.byteLength;
    const finalBytes = shouldKeepOriginal ? bytes : processed;
    const finalMimeType = shouldKeepOriginal ? mimeType : processedMimeType;
    const finalDimensions = shouldKeepOriginal ? original : processedDimensions;
    const finalFormat = shouldKeepOriginal ? originalFormat : targetFormat;

    return {
      bytes: finalBytes,
      mimeType: finalMimeType,
      diagnostic: createDiagnostic({
        status: shouldKeepOriginal ? "unchanged" : "processed",
        reason: shouldKeepOriginal ? "processed-not-smaller" : reason,
        originalBytes: bytes.byteLength,
        processedBytes: finalBytes.byteLength,
        originalWidth: original.width,
        originalHeight: original.height,
        processedWidth: finalDimensions.width,
        processedHeight: finalDimensions.height,
        originalFormat,
        processedFormat: finalFormat,
      }),
    };
  } catch {
    return {
      bytes,
      mimeType,
      diagnostic: createDiagnostic({
        status: "failed",
        reason: "preprocess-error",
        originalBytes: bytes.byteLength,
        processedBytes: bytes.byteLength,
        originalFormat: toFormat(mimeType),
      }),
    };
  }
}

export function getPlanImagePreprocessLimits() {
  return {
    maxPlanImageDimension,
    heavyPngThresholdBytes,
  };
}
