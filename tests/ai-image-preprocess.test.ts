import { Buffer } from "node:buffer";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { isPlanExtractImageMimeType, shouldPreprocessPlanExtractImage } from "@/lib/ai/plan-image-mime";
import { getPlanImagePreprocessLimits, preprocessPlanExtractImage } from "@/lib/ai/plan-image-preprocess";

describe("AI plan image preprocessing", () => {
  it("shares the image MIME guard and keeps preprocessing limited to Free image uploads", () => {
    expect(isPlanExtractImageMimeType("image/png")).toBe(true);
    expect(isPlanExtractImageMimeType("application/pdf")).toBe(false);
    expect(shouldPreprocessPlanExtractImage({ mode: "free-cloud", mimeType: "image/jpeg" })).toBe(true);
    expect(shouldPreprocessPlanExtractImage({ mode: "paid", mimeType: "image/jpeg" })).toBe(false);
    expect(shouldPreprocessPlanExtractImage({ mode: "free-cloud", mimeType: "application/pdf" })).toBe(false);
  });

  it("reduces oversized plan images before provider upload", async () => {
    const { maxPlanImageDimension } = getPlanImagePreprocessLimits();
    const image = await sharp({
      create: {
        width: maxPlanImageDimension + 1200,
        height: maxPlanImageDimension + 600,
        channels: 3,
        background: "#ffffff",
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="${maxPlanImageDimension + 1200}" height="${maxPlanImageDimension + 600}" xmlns="http://www.w3.org/2000/svg">
              <rect x="80" y="80" width="2500" height="1500" fill="none" stroke="#111" stroke-width="12"/>
              <line x1="80" y1="820" x2="2580" y2="820" stroke="#111" stroke-width="8"/>
            </svg>`
          ),
        },
      ])
      .png()
      .toBuffer();

    const result = await preprocessPlanExtractImage({ bytes: image, mimeType: "image/png" });

    expect(result.diagnostic).toMatchObject({
      status: "processed",
      reason: "large-image",
      originalFormat: "png",
      processedFormat: "png",
    });
    expect(result.diagnostic.processedDimensions?.width).toBeLessThanOrEqual(maxPlanImageDimension);
    expect(result.diagnostic.processedDimensions?.height).toBeLessThanOrEqual(maxPlanImageDimension);
    expect(result.bytes.byteLength).toBeLessThan(image.byteLength);
  });

  it("keeps small images unchanged", async () => {
    const image = await sharp({
      create: {
        width: 900,
        height: 600,
        channels: 3,
        background: "#ffffff",
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    const result = await preprocessPlanExtractImage({ bytes: image, mimeType: "image/jpeg" });

    expect(result.bytes).toBe(image);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.diagnostic).toMatchObject({
      status: "unchanged",
      reason: "within-limits",
      originalDimensions: { width: 900, height: 600 },
      processedDimensions: { width: 900, height: 600 },
      originalFormat: "jpeg",
      processedFormat: "jpeg",
    });
  });
});
