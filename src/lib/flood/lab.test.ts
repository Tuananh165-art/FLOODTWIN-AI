import { describe, expect, it } from "vitest";
import { floodLabScenarios, getFloodLabScenario } from "@/lib/flood/lab";

describe("FloodLab isolated scenario catalogue", () => {
  it("contains the eight planned demo scenarios with unique identifiers", () => {
    expect(floodLabScenarios).toHaveLength(8);
    expect(new Set(floodLabScenarios.map((scenario) => scenario.id)).size).toBe(8);
    expect(floodLabScenarios.map((scenario) => scenario.id)).toEqual([
      "rain_rises", "new_report", "old_photo", "duplicate_burst", "source_outage",
      "conflicting_reports", "road_closure", "retract_decision",
    ]);
  });

  it("falls back to the first deterministic scenario for an unknown id", () => {
    expect(getFloodLabScenario("unknown")).toBe(floodLabScenarios[0]);
  });
});
