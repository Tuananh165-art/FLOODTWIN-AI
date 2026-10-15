import { describe, expect, it } from "vitest";
import { countNearbyReviewedReports } from "@/lib/routing/evidence";

describe("route evidence proximity", () => {
  const route: [number, number][] = [[106.8, 10.9], [106.81, 10.9]];

  it("counts unique reviewed reports within the route corridor", () => {
    expect(countNearbyReviewedReports(route, [
      { id: "near", latitude: 10.9001, longitude: 106.805 },
      { id: "far", latitude: 10.91, longitude: 106.805 },
      { id: "near", latitude: 10.9, longitude: 106.805 },
    ])).toBe(1);
  });

  it("does not interpret a route with no report evidence as safe", () => {
    expect(countNearbyReviewedReports(route, [])).toBe(0);
  });
});
