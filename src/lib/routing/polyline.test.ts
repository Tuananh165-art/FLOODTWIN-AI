import { describe, expect, it } from "vitest";
import { decodePolyline6 } from "@/lib/routing/polyline";

describe("Valhalla precision-6 polyline decoding", () => {
  it("returns GeoJSON order (longitude, latitude)", () => {
    expect(decodePolyline6("_ouce@_gjaR?I")).toEqual([[10, 20], [10.000005, 20]]);
  });

  it("rejects truncated and single-point geometries", () => {
    expect(() => decodePolyline6("_")).toThrow("Invalid encoded route geometry");
    expect(() => decodePolyline6("??")).toThrow("at least two points");
  });
});
