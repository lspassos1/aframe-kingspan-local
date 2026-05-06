import { describe, expect, it } from "vitest";
import {
  calculateManualTakeoffMetrics,
  createDefaultManualTakeoffState,
  createManualTakeoffOpening,
  createManualTakeoffRoom,
  getManualTakeoffStepIndex,
  getManualTakeoffStepLabel,
  manualTakeoffSteps,
} from "@/lib/takeoff/manual-stepper";

describe("manual takeoff stepper", () => {
  it("keeps method selection after location, plot, rooms, openings, walls and technical assumptions", () => {
    expect(manualTakeoffSteps.map((step) => step.label)).toEqual([
      "Local",
      "Lote",
      "Ambientes",
      "Portas e janelas",
      "Paredes",
      "Fundação e cobertura",
      "Elétrica e hidráulica",
      "Método",
      "Revisão",
    ]);
    expect(getManualTakeoffStepIndex("method")).toBe(7);
    expect(getManualTakeoffStepLabel("review")).toBe("Revisão");
  });

  it("calculates editable takeoff metrics from rooms, openings and walls", () => {
    const state = createDefaultManualTakeoffState({
      rooms: [
        createManualTakeoffRoom("living", { name: "Sala", type: "social", areaM2: 30, widthM: 5, depthM: 6, electricalPoints: 10 }),
        createManualTakeoffRoom("bath", { name: "Banheiro", type: "bathroom", areaM2: 4, widthM: 2, depthM: 2, plumbingPoints: 6 }),
      ],
      openings: [
        createManualTakeoffOpening("door", "door", "living", { quantity: 2, widthM: 0.8, heightM: 2.1 }),
        createManualTakeoffOpening("window", "window", "living", { quantity: 1, widthM: 1.2, heightM: 1 }),
      ],
      externalWallLengthM: 40,
      internalWallLengthM: 10,
      floorHeightM: 2.8,
      discountOpenings: true,
      electricalEstimated: true,
      plumbingEstimated: true,
    });

    const metrics = calculateManualTakeoffMetrics(state);

    expect(metrics.builtAreaM2).toBe(34);
    expect(metrics.openingsAreaM2).toBe(4.56);
    expect(metrics.grossWallAreaM2).toBe(140);
    expect(metrics.netWallAreaM2).toBe(135.44);
    expect(metrics.electricalPoints).toBe(14);
    expect(metrics.plumbingPoints).toBe(6);
    expect(metrics.pendingCount).toBeGreaterThanOrEqual(4);
  });
});
