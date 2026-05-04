import { describe, expect, it } from "vitest";
import {
  brazilStates,
  getBrazilCitiesForState,
  isBrazilCityInState,
  isBrazilState,
  normalizeBrazilStateName,
} from "@/lib/locations/brazil";

describe("brazil location data", () => {
  it("includes every Brazilian state and the Federal District", () => {
    expect(brazilStates).toHaveLength(27);
    expect(brazilStates.map((state) => state.code)).toContain("DF");
    expect(brazilStates.map((state) => state.name)).toContain("São Paulo");
  });

  it("normalizes state codes to state names", () => {
    expect(normalizeBrazilStateName("BA")).toBe("Bahia");
    expect(normalizeBrazilStateName("São Paulo")).toBe("São Paulo");
    expect(isBrazilState("RJ")).toBe(true);
  });

  it("returns only cities for the selected state", () => {
    expect(getBrazilCitiesForState("Bahia")).toContain("Cruz das Almas");
    expect(getBrazilCitiesForState("São Paulo")).toContain("São Paulo");
    expect(isBrazilCityInState("São Paulo", "Salvador")).toBe(false);
  });
});
