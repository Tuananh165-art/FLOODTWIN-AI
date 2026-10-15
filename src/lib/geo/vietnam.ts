import { z } from "zod";

// A deliberately broad bounding box for Vietnam; it is not a legal provincial boundary.
export const VIETNAM_BOUNDS = { south: 8.18, north: 23.39, west: 102.14, east: 109.47 } as const;

export function isWithinVietnam(point: { lat: number; lon: number }) {
  return point.lat >= VIETNAM_BOUNDS.south && point.lat <= VIETNAM_BOUNDS.north &&
    point.lon >= VIETNAM_BOUNDS.west && point.lon <= VIETNAM_BOUNDS.east;
}

export const vietnamPointSchema = z.object({ lat: z.number(), lon: z.number() }).refine(isWithinVietnam);
export const vietnamCoordinateQuerySchema = z.object({
  lat: z.coerce.number().min(VIETNAM_BOUNDS.south).max(VIETNAM_BOUNDS.north),
  lon: z.coerce.number().min(VIETNAM_BOUNDS.west).max(VIETNAM_BOUNDS.east),
}).refine(isWithinVietnam);
