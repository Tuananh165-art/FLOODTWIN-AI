"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type MapMouseEvent, type Map as MapLibreMap, type Marker } from "maplibre-gl";
import { LocateFixed } from "lucide-react";

export type MapPoint = { lat: number; lon: number };
export type PublicReport = { id: string; public_summary: string; verification_level: string; latitude: number; longitude: number; observed_at: string; expires_at: string };

type FloodMapProps = {
  selectedPoint: MapPoint;
  simulated: boolean;
  scenarioId?: string;
  onPointSelected: (point: MapPoint) => void;
  routeLine: { type: "LineString"; coordinates: [number, number][] } | null;
  reports: PublicReport[];
  className?: string;
};

const markerPin = (className: string) => {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.setAttribute("aria-label", className.includes("demo") ? "Điểm ngập mô phỏng" : "Vị trí đang chọn");
  return element;
};

export function FloodMap({ selectedPoint, simulated, scenarioId = "rain_rises", onPointSelected, routeLine, reports, className }: FloodMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapLoadError, setMapLoadError] = useState(false);
  const userMarkerRef = useRef<Marker | null>(null);
  const demoMarkersRef = useRef<Marker[]>([]);
  const reportMarkersRef = useRef<Marker[]>([]);
  const callbackRef = useRef(onPointSelected);

  useEffect(() => {
    callbackRef.current = onPointSelected;
  }, [onPointSelected]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [selectedPoint.lon, selectedPoint.lat],
      zoom: 8.7,
      minZoom: 6,
      maxZoom: 18,
      attributionControl: false,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.1 } }],
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-right");
    map.on("error", () => setMapLoadError(true));
    map.on("click", (event: MapMouseEvent) => {
      callbackRef.current({ lat: event.lngLat.lat, lon: event.lngLat.lng });
    });
    mapRef.current = map;

    return () => {
      demoMarkersRef.current.forEach((marker) => marker.remove());
      reportMarkersRef.current.forEach((marker) => marker.remove());
      userMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      demoMarkersRef.current = [];
    };
    // The map is created once; selected coordinates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userMarkerRef.current) {
      userMarkerRef.current = new maplibregl.Marker({ element: markerPin("selected-map-pin") });
    }
    userMarkerRef.current.setLngLat([selectedPoint.lon, selectedPoint.lat]).addTo(map);
  }, [selectedPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    demoMarkersRef.current.forEach((marker) => marker.remove());
    demoMarkersRef.current = [];
    if (simulated) {
      const offsets: Record<string, [number, number][]> = {
        rain_rises: [[0, 0], [0.03, 0.025], [-0.02, 0.035]],
        new_report: [[0.01, 0.01]],
        old_photo: [[-0.02, 0.03]],
        duplicate_burst: [[0, 0], [0.002, 0.001], [-0.001, 0.002], [0.001, -0.002]],
        source_outage: [[0, 0]],
        conflicting_reports: [[-0.006, -0.006], [0.006, 0.006]],
        road_closure: [[0, 0], [0.035, 0.015]],
        retract_decision: [],
      };
      const locations = offsets[scenarioId] ?? offsets.rain_rises;
      demoMarkersRef.current = locations.map(([latOffset, lonOffset]) =>
        new maplibregl.Marker({ element: markerPin("demo-map-pin") })
          .setLngLat([selectedPoint.lon + lonOffset, selectedPoint.lat + latOffset])
          .setPopup(new maplibregl.Popup({ offset: 18 }).setText(`FloodLab · ${scenarioId} · tình huống giả lập, không phải báo cáo thực`))
          .addTo(map),
      );
    }
  }, [simulated, scenarioId, selectedPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    reportMarkersRef.current.forEach((marker) => marker.remove());
    reportMarkersRef.current = reports.map((report) => {
      const element = markerPin("reviewed-map-pin");
      element.setAttribute("aria-label", `Phản ánh đã được nhóm dự án xem xét: ${report.public_summary}`);
      return new maplibregl.Marker({ element })
        .setLngLat([report.longitude, report.latitude])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(`${report.public_summary} · Nhóm dự án đã xem xét · ${new Date(report.observed_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`))
        .addTo(map);
    });
  }, [reports]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const data = {
      type: "FeatureCollection" as const,
      features: routeLine ? [{ type: "Feature" as const, properties: {}, geometry: routeLine }] : [],
    };
    const applyRoute = () => {
      const existing = map.getSource("floodtwin-route") as GeoJSONSource | undefined;
      if (existing) existing.setData(data);
      else {
        map.addSource("floodtwin-route", { type: "geojson", data });
        map.addLayer({ id: "floodtwin-route-casing", type: "line", source: "floodtwin-route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.92 } });
        map.addLayer({ id: "floodtwin-route-line", type: "line", source: "floodtwin-route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#4276c7", "line-width": 4, "line-opacity": 0.95 } });
      }
    };
    if (map.isStyleLoaded()) applyRoute();
    else map.once("load", applyRoute);
    return () => { map.off("load", applyRoute); };
  }, [routeLine]);

  const locateUser = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lon: coords.longitude };
        callbackRef.current(point);
        mapRef.current?.flyTo({ center: [point.lon, point.lat], zoom: 13, essential: true });
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 7_000, maximumAge: 60_000 },
    );
  }, []);

  return (
    <div className={`map-frame ${className ?? ""}`}>
      <div ref={containerRef} className="map-surface" aria-label="Bản đồ khu vực đang chọn" />
      {mapLoadError ? (
        <div className="map-load-error" role="status">
          Không tải được nền bản đồ. Kiểm tra kết nối hoặc cấu hình nhà cung cấp bản đồ.
        </div>
      ) : null}
      <button className="map-locate" onClick={locateUser} aria-label="Xem vị trí của tôi">
        <LocateFixed size={17} strokeWidth={1.8} />
      </button>
      {simulated ? <div className="map-simulation-watermark">MÔ PHỎNG · KHÔNG DÙNG ĐỂ DI CHUYỂN</div> : null}
    </div>
  );
}
