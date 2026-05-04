import { describe, expect, it } from "vitest";
import { methodProjectSchema, startProjectSchema } from "@/lib/validation/onboarding";

const validAFrameStart = {
  projectName: "Casa de teste",
  address: "",
  city: "Cruz das Almas",
  state: "Bahia",
  country: "Brasil",
  terrainWidth: 17,
  terrainDepth: 26,
  panelProductId: "custom",
  panelLength: 6,
  baseAngleDeg: 60,
  houseDepth: 10,
};

describe("onboarding location validation", () => {
  it("accepts a valid Brazilian state and city pair", () => {
    expect(startProjectSchema.safeParse(validAFrameStart).success).toBe(true);
  });

  it("rejects cities that do not belong to the selected state", () => {
    const result = startProjectSchema.safeParse({
      ...validAFrameStart,
      city: "Salvador",
      state: "São Paulo",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "city")).toBe(true);
    }
  });

  it("requires common inputs for non-A-frame construction methods", () => {
    const result = methodProjectSchema.safeParse({
      constructionMethod: "conventional-masonry",
      projectName: "",
      city: "",
      state: "",
      widthM: "",
      depthM: "",
      floorHeightM: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issuePaths = result.error.issues.map((issue) => issue.path.join("."));
      expect(issuePaths).toContain("projectName");
      expect(issuePaths).toContain("city");
      expect(issuePaths).toContain("state");
      expect(issuePaths).toContain("widthM");
      expect(issuePaths).toContain("depthM");
      expect(issuePaths).toContain("floorHeightM");
    }
  });

  it("accepts a valid conventional masonry MVP form", () => {
    const result = methodProjectSchema.safeParse({
      constructionMethod: "conventional-masonry",
      projectName: "Alvenaria preliminar",
      city: "Salvador",
      state: "Bahia",
      widthM: 8,
      depthM: 12,
      floorHeightM: 2.8,
      floors: 1,
      wallThicknessM: 0.14,
      doorWidthM: 0.8,
      doorHeightM: 2.1,
      windowWidthM: 1.2,
      windowHeightM: 1,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid count and percentage values for method forms", () => {
    const result = methodProjectSchema.safeParse({
      constructionMethod: "conventional-masonry",
      projectName: "Alvenaria preliminar",
      city: "Salvador",
      state: "Bahia",
      widthM: 8,
      depthM: 12,
      floorHeightM: 2.8,
      floors: 1.5,
      doorCount: -2,
      windowCount: 3.2,
      wastePercent: 120,
      wallThicknessM: 0.14,
      doorWidthM: 0.8,
      doorHeightM: 2.1,
      windowWidthM: 1.2,
      windowHeightM: 1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issuePaths = result.error.issues.map((issue) => issue.path.join("."));
      expect(issuePaths).toContain("floors");
      expect(issuePaths).toContain("doorCount");
      expect(issuePaths).toContain("windowCount");
      expect(issuePaths).toContain("wastePercent");
    }
  });
});
