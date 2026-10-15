export type ReviewedReportPoint = { id: string; latitude: number; longitude: number };

/** Count distinct reviewed report locations within a short distance of a route line. */
export function countNearbyReviewedReports(
  route: [number, number][],
  reports: ReviewedReportPoint[],
  radiusMeters = 50,
): number {
  if (route.length < 2 || !Number.isFinite(radiusMeters) || radiusMeters < 0) return 0;
  const found = new Set<string>();
  for (const report of reports) {
    if (!Number.isFinite(report.latitude) || !Number.isFinite(report.longitude)) continue;
    for (let index = 0; index < route.length - 1; index += 1) {
      const [lonA, latA] = route[index];
      const [lonB, latB] = route[index + 1];
      const referenceLat = ((latA + latB + report.latitude) / 3) * (Math.PI / 180);
      const metersPerLon = 111_320 * Math.cos(referenceLat);
      const ax = (lonA - report.longitude) * metersPerLon;
      const ay = (latA - report.latitude) * 110_574;
      const bx = (lonB - report.longitude) * metersPerLon;
      const by = (latB - report.latitude) * 110_574;
      const dx = bx - ax;
      const dy = by - ay;
      const lengthSquared = dx * dx + dy * dy;
      const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
      if (Math.hypot(ax + fraction * dx, ay + fraction * dy) <= radiusMeters) {
        found.add(report.id);
        break;
      }
    }
  }
  return found.size;
}
