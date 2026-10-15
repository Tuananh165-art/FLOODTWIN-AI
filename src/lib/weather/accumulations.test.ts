import { describe, expect, it } from "vitest";
import { calculateRainAccumulations } from "@/lib/weather/accumulations";

describe("hourly rain accumulation windows", () => {
  it("sums independent 1, 3, 6 and 24 hour forecast windows", () => {
    const hours = Array.from({ length: 48 }, (_, index) => ({ time: `2026-10-15T${index}:00`, precipitationMm: index === 0 ? 2.2 : 1 }));
    expect(calculateRainAccumulations(hours)).toEqual({ hour1: 2.2, hour3: 4.2, hour6: 7.2, hour24: 25.2 });
  });

  it("does not invent a total when the forecast window is incomplete or invalid", () => {
    const hours = Array.from({ length: 6 }, (_, index) => ({ time: String(index), precipitationMm: 1 }));
    hours[2].precipitationMm = -1;
    expect(calculateRainAccumulations(hours)).toEqual({ hour1: 1, hour3: null, hour6: null, hour24: null });
  });
});
