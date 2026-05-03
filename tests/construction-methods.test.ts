import { describe, expect, it } from "vitest";
import {
  constructionMethodDefinitions,
  constructionMethodIds,
  constructionMethodRegistry,
  getAFrameInputsFromScenario,
  getConstructionMethodDefinition,
  getScenarioMethodInputs,
  type ConstructionMethodId,
} from "@/lib/construction-methods";
import { defaultProject } from "@/data/defaultProject";

const expectedIds: ConstructionMethodId[] = ["aframe", "conventional-masonry", "eco-block", "monolithic-eps"];

describe("construction method registry", () => {
  it("registers all initial construction methods", () => {
    expect(constructionMethodIds).toEqual(expectedIds);
    expect(constructionMethodDefinitions).toHaveLength(4);
    for (const methodId of expectedIds) {
      expect(constructionMethodRegistry[methodId]?.id).toBe(methodId);
      expect(getConstructionMethodDefinition(methodId).id).toBe(methodId);
    }
  });

  it("keeps method ids unique", () => {
    const uniqueIds = new Set(constructionMethodIds);

    expect(uniqueIds.size).toBe(constructionMethodIds.length);
  });

  it("provides product metadata and warnings for every method", () => {
    for (const definition of constructionMethodDefinitions) {
      expect(definition.name.length).toBeGreaterThan(3);
      expect(definition.shortDescription.length).toBeGreaterThan(20);
      expect(definition.bestFor.length).toBeGreaterThan(20);
      expect(definition.benefits.length).toBeGreaterThan(0);
      expect(definition.limitations.length).toBeGreaterThan(0);
      expect(definition.defaultWarnings.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(definition.complexity);
      expect(["slow", "medium", "fast"]).toContain(definition.speed);
      expect(["low", "medium", "high"]).toContain(definition.industrializationLevel);
    }
  });

  it("returns default input objects that validate successfully", () => {
    for (const definition of constructionMethodDefinitions) {
      const inputs = definition.getDefaultInputs();
      const validation = definition.validateInputs(inputs);

      expect(inputs).toBeTruthy();
      expect(typeof inputs).toBe("object");
      expect(Array.isArray(inputs)).toBe(false);
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    }
  });

  it("rejects non-object inputs consistently", () => {
    for (const definition of constructionMethodDefinitions) {
      const validation = definition.validateInputs(null);

      expect(validation.valid).toBe(false);
      expect(validation.issues[0]?.path).toBe("");
    }
  });

  it("resolves scenario method inputs while preserving A-frame transition fields", () => {
    const scenario = defaultProject.scenarios[0];

    expect(getScenarioMethodInputs(scenario)).toMatchObject(scenario.aFrame);
    expect(getAFrameInputsFromScenario(scenario)).toMatchObject(scenario.aFrame);
  });
});
