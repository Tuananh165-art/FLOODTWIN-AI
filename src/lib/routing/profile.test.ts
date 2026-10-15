import { describe, expect, it } from "vitest";
import { getRouteProvider } from "@/lib/routing/profile";

describe("getRouteProvider", () => {
  it.each([
    ["motorbike", "valhalla", "motor_scooter"],
    ["car", "openrouteservice", "driving-car"],
    ["walking", "openrouteservice", "foot-walking"],
  ] as const)("maps %s to its matching provider profile", (mode, provider, profile) => {
    expect(getRouteProvider(mode)).toEqual({ provider, profile });
  });
});
