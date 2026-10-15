/** Decode Valhalla's encoded polyline (precision 6) into GeoJSON longitude/latitude pairs. */
export function decodePolyline6(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const factor = 1_000_000;
  const read = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length || shift > 30) throw new Error("Invalid encoded route geometry");
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error("Invalid encoded route geometry");
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    latitude += read();
    longitude += read();
    const lat = latitude / factor;
    const lon = longitude / factor;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new Error("Route geometry is outside WGS84 bounds");
    }
    points.push([lon, lat]);
  }
  if (points.length < 2) throw new Error("Route geometry must contain at least two points");
  return points;
}
