export type TravelMode = "motorbike" | "car" | "walking";

export function getRouteProvider(mode: TravelMode) {
  switch (mode) {
    case "motorbike":
      return { provider: "valhalla" as const, profile: "motor_scooter" as const };
    case "car":
      return { provider: "openrouteservice" as const, profile: "driving-car" as const };
    case "walking":
      return { provider: "openrouteservice" as const, profile: "foot-walking" as const };
  }
}
