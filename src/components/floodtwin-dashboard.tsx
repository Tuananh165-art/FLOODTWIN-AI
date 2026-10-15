"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  Bell,
  BookOpenText,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudDrizzle,
  Compass,
  Crosshair,
  Database,
  Download,
  Droplets,
  Eye,
  FileImage,
  FilePlus2,
  GitCompareArrows,
  Layers3,
  LocateFixed,
  Menu,
  MessageCircleMore,
  Minus,
  Navigation,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Waves,
  Wind,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { MapPoint, PublicReport } from "@/components/flood-map";
import { floodLabScenarios, getFloodLabScenario } from "@/lib/flood/lab";
import { calculateRainAccumulations } from "@/lib/weather/accumulations";

const FloodMap = dynamic(() => import("@/components/flood-map").then((module) => module.FloodMap), {
  ssr: false,
  loading: () => <div className="map-loading"><div className="map-loader" /><span>Đang mở bản đồ OpenStreetMap…</span></div>,
});

type WeatherResponse = {
  source: string;
  mode: "forecast";
  retrievedAt: string;
  resolution: string;
  location: MapPoint;
  current: { time: string | null; precipitationMm: number | null; temperatureC: number | null; windSpeedKmh: number | null; label: string };
  hours: { time: string; precipitationMm: number }[];
  accumulations?: { hour1: number | null; hour3: number | null; hour6: number | null; hour24: number | null };
  assessment: { level: string; reasons: string[] };
};

type Section = "overview" | "pulse" | "path" | "reports" | "lab" | "sources";
type Session = { email: string; role: "member" | "moderator" | "admin" } | null;
type FeedStatus = "loading" | "available" | "unavailable" | "not_configured";
const defaultPoint: MapPoint = { lat: 10.956, lon: 106.838 };
const defaultDestination: MapPoint = { lat: 10.905, lon: 106.95 };
const sections: { id: Section; label: string; icon: typeof Activity; tag?: string }[] = [
  { id: "overview", label: "Tổng quan", icon: Layers3 },
  { id: "pulse", label: "FloodPulse", icon: Waves },
  { id: "path", label: "FloodPath", icon: Route },
  { id: "reports", label: "Báo cáo hiện trường", icon: MessageCircleMore },
  { id: "lab", label: "FloodLab", icon: Sparkles, tag: "DEMO" },
  { id: "sources", label: "Nguồn dữ liệu", icon: Database },
];

const sectionHeadings: Record<Section, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "THEO DÕI NGẬP CỤC BỘ · ĐỒNG NAI", title: "Một góc nhìn rõ ràng hơn về tình hình mưa.", description: "Theo dõi tín hiệu, xem nguồn và hiểu những điều dữ liệu hiện tại chưa thể trả lời." },
  pulse: { eyebrow: "FLOODPULSE · TÍN HIỆU THỜI TIẾT", title: "Mưa là một tín hiệu. Không phải bằng chứng ngập đường.", description: "Dự báo mưa có nguồn và thời điểm riêng, tách khỏi quan sát hiện trường." },
  path: { eyebrow: "FLOODPATH · SO SÁNH LỘ TRÌNH", title: "Cân nhắc phương án theo bằng chứng sẵn có.", description: "Tuyến ít tín hiệu bất lợi hơn vẫn có thể còn khoảng trống dữ liệu." },
  reports: { eyebrow: "FLOODREPORT · PHẢN ÁNH HIỆN TRƯỜNG", title: "Một thông tin có ích cần biết ở đâu, khi nào.", description: "Báo cáo chỉ thành bằng chứng công khai sau khi người kiểm duyệt xem xét." },
  lab: { eyebrow: "FLOODLAB · PHÒNG THÍ NGHIỆM KỊCH BẢN", title: "Thử hệ thống trong một thế giới giả lập.", description: "Các dấu mốc trong màn hình này không đại diện cho tình hình thực tế." },
  sources: { eyebrow: "FLOODTRUST · NGUỒN VÀ GIỚI HẠN", title: "Biết rõ mỗi lớp dữ liệu đến từ đâu.", description: "Dữ liệu thật, dự báo, thông tin cộng đồng và mô phỏng có nhãn riêng." },
};

function formatClock(value: string | null | undefined) {
  if (!value) return "Chưa rõ thời điểm";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function rainLabel(weather: WeatherResponse | null) {
  if (!weather) return "Chưa có dữ liệu";
  const value = weather.current.precipitationMm;
  if (value === null) return "Chưa có dữ liệu";
  if (value === 0) return "Không mưa tại thời điểm cập nhật";
  return `Mô hình ước tính ${value.toFixed(1)} mm`;
}

export function FloodTwinDashboard() {
  const [section, setSection] = useState<Section>("overview");
  const [point, setPoint] = useState<MapPoint>(defaultPoint);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [simulated, setSimulated] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [session, setSession] = useState<Session>(null);
  const [notice, setNotice] = useState("");
  const [rainScenario, setRainScenario] = useState(24);
  const [labScenarioIndex, setLabScenarioIndex] = useState(0);
  const labCursorRef = useRef(0);
  const [labPlaying, setLabPlaying] = useState(false);
  const [mapPoint, setMapPoint] = useState(point);
  const [routeOrigin, setRouteOrigin] = useState(defaultPoint);
  const [routeDestination, setRouteDestination] = useState(defaultDestination);
  const [routeTarget, setRouteTarget] = useState<"origin" | "destination" | null>(null);
  const [routeLine, setRouteLine] = useState<{ type: "LineString"; coordinates: [number, number][] } | null>(null);
  const [publicReports, setPublicReports] = useState<PublicReport[]>([]);
  const [reportFeedStatus, setReportFeedStatus] = useState<FeedStatus>("loading");

  const loadWeather = useCallback(async (coords: MapPoint) => {
    setWeatherLoading(true);
    setWeatherError("");
    try {
      const params = new URLSearchParams({ lat: String(coords.lat), lon: String(coords.lon) });
      const response = await fetch(`/api/weather?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Không tải được dữ liệu thời tiết.");
      setWeather(body as WeatherResponse);
      setWeatherError("");
    } catch (error) {
      setWeatherError(error instanceof Error ? error.message : "Nguồn thời tiết đang gián đoạn.");
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const loadPublicReports = useCallback(async () => {
    try {
      const response = await fetch("/api/reports/public");
      const body = await response.json();
      if (response.ok) {
        setPublicReports(Array.isArray(body.reports) ? body.reports as PublicReport[] : []);
        setReportFeedStatus(body.sourceStatus === "not_configured" ? "not_configured" : body.sourceStatus === "available" ? "available" : "unavailable");
      }
      else setReportFeedStatus("unavailable");
    } catch { setReportFeedStatus("unavailable"); }
  }, []);

  useEffect(() => {
    // This effect synchronizes the selected map location with an external weather API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWeather(point);
  }, [point, loadWeather]);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session").then((response) => response.json()).then((body) => {
      if (active && body.user) setSession(body.user as Session);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!labPlaying) return;
    const timer = window.setInterval(() => {
      labCursorRef.current = (labCursorRef.current + 1) % floodLabScenarios.length;
      const next = floodLabScenarios[labCursorRef.current];
      setLabScenarioIndex(labCursorRef.current);
      setRainScenario(next.rainMm);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [labPlaying]);

  useEffect(() => {
    // This effect synchronizes the public map layer with the latest database view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPublicReports();
    const listener = () => void loadPublicReports();
    window.addEventListener("reports:updated", listener);
    return () => window.removeEventListener("reports:updated", listener);
  }, [loadPublicReports]);

  const heading = sectionHeadings[section];
  const hourlyBars = useMemo(() => {
    const max = Math.max(...(weather?.hours.slice(0, 48).map((hour) => hour.precipitationMm) ?? [0]), 0.1);
    return weather?.hours.slice(0, 48).map((hour) => ({
      time: hour.time,
      value: hour.precipitationMm,
      height: Math.max(4, (hour.precipitationMm / max) * 48),
    })) ?? [];
  }, [weather]);
  const rainTotals = useMemo(() => weather?.accumulations ?? calculateRainAccumulations(weather?.hours ?? []), [weather]);

  function announce(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function activateLab() {
    setSection("lab");
    setSimulated(true);
    setLabPlaying(false);
    announce("Đã mở FloodLab. Mọi điểm được đánh dấu đều là tình huống giả lập.");
  }

  function resetLab() {
    setSimulated(false);
    setRainScenario(24);
    labCursorRef.current = 0;
    setLabScenarioIndex(0);
    setLabPlaying(false);
    setSection("lab");
    announce("Đã khôi phục kịch bản FloodLab ban đầu.");
  }

  function selectLabScenario(id: string) {
    const scenario = getFloodLabScenario(id);
    const index = floodLabScenarios.findIndex((item) => item.id === scenario.id);
    labCursorRef.current = index;
    setLabScenarioIndex(index);
    setRainScenario(scenario.rainMm);
    setSimulated(true);
  }

  function exportLabScenario() {
    const scenario = floodLabScenarios[labScenarioIndex];
    const file = new Blob([JSON.stringify({ version: 1, mode: "simulation", scenarioId: scenario.id, rainMm: rainScenario }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `floodlab-${scenario.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const selectMapPoint = useCallback((selected: MapPoint) => {
    setMapPoint(selected);
    if (routeTarget === "origin") { setRouteOrigin(selected); setRouteTarget(null); }
    if (routeTarget === "destination") { setRouteDestination(selected); setRouteTarget(null); }
  }, [routeTarget]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="FloodTwin AI, về tổng quan" onClick={() => setSection("overview")}>
          <span className="brand-mark"><Waves size={21} strokeWidth={2.5} /></span>
          <span className="brand-name">FloodTwin<span>AI</span><small>FIELD INTELLIGENCE</small></span>
        </a>
        <div className="workspace-label"><span>WORKSPACE</span><button aria-label="Chọn workspace"><span className="workspace-dot" /> Đồng Nai <ChevronDown size={13} /></button></div>
        <nav className="primary-nav" aria-label="Điều hướng chính">
          {sections.slice(0, 4).map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${section === id ? "active" : ""}`} onClick={() => setSection(id)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{id === "reports" ? <small>3</small> : null}
            </button>
          ))}
        </nav>
        <div className="nav-divider" />
        <span className="nav-section-label">KHÔNG GIAN NGHIÊN CỨU</span>
        {sections.slice(4).map(({ id, label, icon: Icon, tag }) => (
          <button key={id} className={`nav-item ${section === id ? "active" : ""}`} onClick={() => id === "lab" ? activateLab() : setSection(id)}>
            <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{tag ? <span className="nav-tag">{tag}</span> : null}
          </button>
        ))}
        <div className="sidebar-spacer" />
        <div className="source-health">
          <div className="health-top"><span className="health-pulse" style={{ background: weatherLoading ? "#e7a849" : weatherError ? "#d76c70" : "#20aa91" }} /> <b>Nguồn dữ liệu</b><span className="health-state" style={{ color: weatherLoading ? "#a26d1a" : weatherError ? "#b84a52" : "#158a78" }}>{weatherLoading ? "Đang tải" : weatherError ? "Thời tiết lỗi" : "Thời tiết có dữ liệu"}</span></div>
          <p>Open-Meteo · dự báo theo yêu cầu<br />Báo cáo · {reportFeedStatus === "loading" ? "đang tải" : reportFeedStatus === "not_configured" ? "chưa cấu hình Supabase" : reportFeedStatus === "unavailable" ? "nguồn lỗi" : `${publicReports.length} mục đã công bố`}</p>
          <div className="health-line"><span style={{ width: weatherLoading ? "35%" : weatherError ? "15%" : "100%", background: weatherError ? "#d76c70" : undefined }} /></div>
          <small>Trạng thái lấy từ các lần tải hiện tại; không phải giám sát SLA.</small>
        </div>
        <button className="help-link" onClick={() => setSection("sources")}><CircleHelp size={16} /> Phương pháp &amp; trợ giúp <ArrowRight size={14} /></button>
        <div className="sidebar-profile"><span className="profile-avatar">FT</span><span><b>{session?.email ?? "Không đăng nhập"}</b><small>{session ? `Tài khoản ${session.role}` : "Chế độ xem công khai"}</small></span><button aria-label={session ? "Đăng xuất" : "Đăng nhập"} onClick={async () => { if (!session) setShowAuth(true); else { await fetch("/api/auth/session", { method: "DELETE" }); setSession(null); announce("Đã đăng xuất."); } }}><Menu size={17} /></button></div>
      </aside>

      <main className="main-panel" id="top">
        <header className="topbar">
          <div className="breadcrumb"><span>Đồng Nai</span><ChevronRight size={14} /><b>{sections.find((item) => item.id === section)?.label}</b></div>
          <div className="topbar-actions"><span className="demo-pill"><span /> BẢN THỬ NGHIỆM</span><button className="icon-action" aria-label="Thông báo" onClick={() => announce("Bạn chưa có thông báo mới.")}><Bell size={18} /><i /></button><button className="top-avatar" aria-label={session ? "Tài khoản đang đăng nhập" : "Đăng nhập"} onClick={() => setShowAuth(true)}>{session?.email?.slice(0, 1).toUpperCase() ?? "FT"}</button></div>
        </header>

        <section className="dashboard-content">
          <div className="intro-row"><div><p className="eyebrow"><span className="eyebrow-line" />{heading.eyebrow}</p><h1>{heading.title}</h1><p className="intro-copy">{heading.description}</p></div><button className="primary-button" onClick={() => setShowReport(true)}><FilePlus2 size={17} /> Gửi phản ánh</button></div>

          <div className="safety-note"><ShieldCheck size={17} /><span><b>Thông tin hỗ trợ tham khảo.</b> FloodTwin không thay thế cảnh báo chính thức và không xác nhận lộ trình an toàn.</span><button aria-label="Đọc nguyên tắc an toàn" onClick={() => setSection("sources")}><ArrowRight size={15} /></button></div>

          {simulated ? <div className="lab-banner"><span><Sparkles size={17} /><b>FloodLab đang chạy</b><small> · Các điểm trên bản đồ được dựng để thử nghiệm, không phải phản ánh hiện trường.</small></span><button onClick={resetLab}><RefreshCw size={14} /> Đặt lại</button></div> : null}

          <div className="metric-grid">
            <article className="metric-card"><div className="metric-label">Mưa · điểm đang xem <CloudDrizzle size={16} /></div><div className="metric-main"><b>{weatherLoading ? "···" : rainLabel(weather)}</b><span className="metric-icon mint"><CloudDrizzle size={18} /></span></div><div className="metric-foot"><span className="subtle-dot teal" />{weather?.mode === "forecast" ? "Dự báo Open-Meteo" : weatherError ? "Nguồn đang gián đoạn" : "Đang tải dự báo"}<span className="metric-time">{weather ? formatClock(weather.retrievedAt) : ""}</span></div></article>
            <article className="metric-card"><div className="metric-label">Tín hiệu mưa 1 giờ <Activity size={16} /></div><div className="metric-main"><b>{weatherLoading ? "···" : weather?.hours[0] ? `${weather.hours[0].precipitationMm.toFixed(1)} <small>mm</small>` : "—"}</b><span className="metric-icon sky"><Waves size={18} /></span></div><div className="metric-foot"><span className="subtle-dot blue" />{weather?.assessment.reasons[0] ?? "Chưa đủ dữ liệu để đánh giá"}</div></article>
            <article className="metric-card"><div className="metric-label">Bằng chứng hiện trường <Eye size={16} /></div><div className="metric-main"><b>{reportFeedStatus === "not_configured" ? "Chưa cấu hình Supabase" : reportFeedStatus === "unavailable" ? "Nguồn báo cáo chưa tải được" : publicReports.length ? `${publicReports.length} báo cáo đã xem xét` : reportFeedStatus === "loading" ? "Đang tải nguồn báo cáo" : "Chưa có báo cáo được công bố"}</b><span className="metric-icon amber"><ShieldCheck size={18} /></span></div><div className="metric-foot"><span className="subtle-dot amber-dot" />Không đồng nghĩa không có nguy cơ</div></article>
            <article className="metric-card"><div className="metric-label">Mức độ phủ dữ liệu <Crosshair size={16} /></div><div className="metric-main"><b>Đang xây dựng</b><span className="metric-icon lilac"><Database size={18} /></span></div><div className="metric-foot"><span className="subtle-dot gray" />Chưa có quan trắc ngập tại địa phương</div></article>
          </div>

          <section className="map-section">
            <div className="section-head"><div><div className="section-title"><span className="live-dot" />Bản đồ tình hình</div><p><span className="map-updated">{weather ? `Cập nhật ${formatClock(weather.retrievedAt)}` : "Đang tải nguồn"}</span> <span className="tiny-divider">·</span> Đồng Nai sau hợp nhất</p></div><div className="map-actions"><button className="secondary-button" onClick={() => setShowLayers((value) => !value)}><Layers3 size={15} /> Lớp dữ liệu <ChevronDown size={13} /></button><button className="square-button" aria-label="Tải lại thời tiết" title="Tải lại thời tiết" onClick={() => void loadWeather(point)}><RefreshCw size={15} className={weatherLoading ? "spin-icon" : ""} /></button></div></div>
            <div className="map-legend"><span><i className="legend-current" />Điểm đang xem</span><span><i className="legend-verified" />Đã xem xét</span><span><i className="legend-forecast" />Tín hiệu dự báo</span><span><i className="legend-unknown" />Chưa có dữ liệu</span></div>
            <div className="map-wrap"><FloodMap selectedPoint={mapPoint} simulated={simulated} onPointSelected={selectMapPoint} routeLine={routeLine} reports={publicReports} />{showLayers ? <div className="layer-menu"><div className="layer-menu-title">LỚP HIỂN THỊ <button aria-label="Đóng lớp dữ liệu" onClick={() => setShowLayers(false)}><X size={15} /></button></div><p><span className="layer-symbol forecast" />Dự báo mưa <span className="layer-state enabled">ĐANG BẬT</span></p><p><span className="layer-symbol reports" />Báo cáo đã xem xét <span className="layer-state">{reportFeedStatus === "available" ? `${publicReports.length} CÒN HIỆU LỰC` : reportFeedStatus === "not_configured" ? "CHƯA CẤU HÌNH" : "NGUỒN CHƯA SẴN SÀNG"}</span></p><p><span className="layer-symbol unknown" />Khoảng trống dữ liệu <span className="layer-state enabled">ĐANG BẬT</span></p><small>Lớp dự báo không biểu diễn tình trạng ngập tại mặt đường.</small></div> : null}<button className="map-location-chip" onClick={() => { setPoint(mapPoint); void loadWeather(mapPoint); announce("Đang cập nhật dự báo cho điểm bản đồ vừa chọn."); }}><span className="location-chip-icon"><LocateFixed size={14} /></span><span><b>Điểm đang xem</b><small>{mapPoint.lat.toFixed(3)}°B, {mapPoint.lon.toFixed(3)}°Đ</small></span><ArrowRight size={15} /></button></div>
          </section>

          <div className="lower-grid">
            <section className="panel forecast-panel"><div className="panel-header"><div><p className="panel-overline">FLOODPULSE · 48 GIỜ TỚI</p><h2>Diễn biến mưa theo giờ</h2></div><span className="forecast-source"><span />DỰ BÁO</span></div><p className="panel-caption">Lượng mưa theo mô hình tại tọa độ đã chọn · mm</p><div className="rain-accumulations" aria-label="Tổng lượng mưa dự báo theo cửa sổ thời gian">{([["1 giờ", rainTotals.hour1], ["3 giờ", rainTotals.hour3], ["6 giờ", rainTotals.hour6], ["24 giờ", rainTotals.hour24]] as const).map(([label, value]) => <span key={label}><small>{label}</small><b>{value === null ? "—" : `${value.toFixed(1)} mm`}</b></span>)}</div><div className="rain-chart" role="img" aria-label="Biểu đồ lượng mưa dự báo tối đa 48 giờ tới; nhãn giờ hiển thị mỗi bốn mốc">{hourlyBars.length ? hourlyBars.map((item, index) => <div key={`${item.time}-${index}`} className="rain-column" title={`${formatClock(item.time)} · ${item.value.toFixed(1)} mm`}><span className={item.value > 0 ? "rain-bar has-rain" : "rain-bar"} style={{ height: `${item.height}px` }} /><small>{index % 4 === 0 ? formatClock(item.time) : ""}</small></div>) : <div className="chart-empty">{weatherError || "Đang chờ dữ liệu thời tiết từ Open-Meteo."}</div>}</div><div className="chart-footer"><span><i /> Dự báo mưa (mm)</span><span>Nguồn: Open-Meteo <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">xem chi tiết <ArrowRight size={11} /></a></span></div></section>
            <section className="panel route-panel"><div className="panel-header"><div><p className="panel-overline">FLOODPATH · MẠNG ĐƯỜNG OSM</p><h2>So sánh lộ trình</h2></div><button className="route-more" aria-label="Mở FloodPath" onClick={() => setSection("path")}><ArrowRight size={17} /></button></div><div className="route-preview"><span className="route-node origin" /><span className="route-connector" /><span className="route-node destination" /><div className="route-endpoints"><span>Biên Hòa, Đồng Nai</span><span>Chưa chọn điểm đến</span></div></div><div className="route-empty"><div className="empty-route-icon"><GitCompareArrows size={18} /></div><div><b>Chọn hai điểm để so sánh</b><p>Phương tiện và nguồn tuyến sẽ được ghi trên mỗi phương án.</p></div></div><button className="route-cta" onClick={() => setSection("path")}>Mở FloodPath <ArrowRight size={14} /></button></section>
          </div>

          <div className="bottom-row"><button className="story-card" onClick={() => setSection("reports")}><span className="story-icon blue"><MessageCircleMore size={17} /></span><span><b>Chưa có phản ánh đã kiểm duyệt</b><small>Thông tin cộng đồng sẽ hiển thị sau khi người kiểm duyệt xem xét.</small></span><ChevronRight size={17} /></button><button className="story-card" onClick={activateLab}><span className="story-icon purple"><Sparkles size={17} /></span><span><b>Thử một kịch bản giả lập</b><small>Xem cách FloodTwin phản ứng khi mưa thay đổi.</small></span><ChevronRight size={17} /></button></div>

          {section === "reports" ? <ReportsWorkspace role={session?.role ?? null} userEmail={session?.email ?? null} /> : null}

          {section === "path" ? <RouteWorkspace origin={routeOrigin} destination={routeDestination} onOriginChange={setRouteOrigin} onDestinationChange={setRouteDestination} onSelectPoint={(target) => { setRouteTarget(target); announce(`Chọn ${target === "origin" ? "điểm A" : "điểm B"} bằng cách chạm bản đồ.`); }} onRoute={(line) => setRouteLine(line)} /> : null}

          {section === "lab" ? <section className="panel lab-controls"><div><p className="panel-overline">DỮ LIỆU MÔ PHỎNG · TÁCH BIỆT VỚI DỮ LIỆU THỰC</p><h2>Phát lại tình huống FloodLab</h2><p>8 kịch bản chỉ chạy trong trình duyệt. Không ghi database, không gọi AI/provider và không phát thông báo thật.</p></div><div className="lab-scenario-grid">{floodLabScenarios.map((scenario, index) => <button key={scenario.id} className={`lab-scenario ${index === labScenarioIndex ? "active" : ""}`} aria-pressed={index === labScenarioIndex} onClick={() => selectLabScenario(scenario.id)}><b>{index + 1}. {scenario.label}</b><small>{scenario.description}</small></button>)}</div><div className="lab-active-scenario"><Sparkles size={15} /><span><b>{floodLabScenarios[labScenarioIndex].label}</b><small>{floodLabScenarios[labScenarioIndex].signal}</small></span></div><div className="lab-slider-row"><input aria-label="Lượng mưa mô phỏng" type="range" min="0" max="120" step="5" value={rainScenario} onChange={(event) => { setSimulated(true); setRainScenario(Number(event.target.value)); }} /><span>{rainScenario} <small>mm / 3 giờ · mô phỏng</small></span><button className="secondary-button" onClick={() => { setSimulated(true); setLabPlaying((value) => !value); }}>{labPlaying ? "Tạm dừng" : "Phát lại"}</button><button className="secondary-button" onClick={resetLab}><RefreshCw size={14} /> Đặt lại</button><button className="secondary-button" onClick={exportLabScenario}>Xuất JSON</button></div><div className="lab-comparison"><span>TRƯỚC <b>24 mm · kịch bản ban đầu</b></span><ArrowLeftRight size={17} /><span>SAU <b>{rainScenario} mm · tình huống giả lập</b></span></div><p className="lab-isolation-note">Kết quả mô phỏng không thay đổi các báo cáo thật trên bản đồ hoặc trong Supabase. “Đóng đường” là minh họa; không gửi lệnh tới dịch vụ định tuyến.</p></section> : null}

          {section === "sources" ? <section className="panel sources-panel"><div className="panel-header"><div><p className="panel-overline">MINH BẠCH DỮ LIỆU</p><h2>Nguồn và cách đọc kết quả</h2></div><BookOpenText size={20} /></div><div className="source-row"><span className="source-brand open-meteo"><Sun size={18} /></span><span><b>Open-Meteo Forecast API</b><small>Dự báo theo mô hình tại tọa độ được chọn; không phải trạm đo ngập.</small></span><span className="source-kind forecast-label">DỰ BÁO</span></div><div className="source-row"><span className="source-brand osm"><Compass size={18} /></span><span><b>OpenStreetMap</b><small>Nền đường và địa danh; có thể thiếu hoặc chậm cập nhật.</small></span><span className="source-kind open-label">DỮ LIỆU MỞ</span></div><div className="source-row"><span className="source-brand twin"><Waves size={18} /></span><span><b>FloodLab</b><small>Chỉ là tình huống giả lập, tách khỏi phản ánh và dữ liệu thời tiết.</small></span><span className="source-kind simulated-label">MÔ PHỎNG</span></div><div className="method-note"><ShieldAlert size={16} /><span>FloodTwin không xác nhận tuyến an toàn hoặc cảnh báo thiên tai chính thức. Khi có nguy hiểm, hãy theo dõi thông tin từ cơ quan có thẩm quyền.</span></div></section> : null}
        </section>
        <footer className="app-footer"><span>FLOODTWIN AI <span>v0.1 · bản thử nghiệm nghiên cứu</span></span><span>Không có dữ liệu ≠ nguy cơ thấp <i>·</i> <button onClick={() => setSection("sources")}>Phương pháp &amp; nguồn</button></span></footer>
      </main>

      {notice ? <div className="toast-message" role="status"><ShieldCheck size={16} />{notice}</div> : null}
      {showReport ? <ReportDialog location={mapPoint} userEmail={session?.email ?? null} onLogin={() => setShowAuth(true)} onClose={() => setShowReport(false)} onSuccess={() => { setShowReport(false); announce("Đã gửi phản ánh. Phản ánh ở trạng thái chờ xem xét."); }} onSimulated={() => { setShowReport(false); announce("Đã tạo phản ánh mô phỏng trong phiên FloodLab; không gửi lên máy chủ."); }} /> : null}
      {showAuth ? <LoginDialog onClose={() => setShowAuth(false)} onSuccess={(nextSession) => { setSession(nextSession); setShowAuth(false); announce("Đăng nhập thành công."); }} /> : null}
    </div>
  );
}

function ReportDialog({ location, userEmail, onLogin, onClose, onSuccess, onSimulated }: { location: MapPoint; userEmail: string | null; onLogin: () => void; onClose: () => void; onSuccess: () => void; onSimulated: () => void }) {
  const [description, setDescription] = useState("");
  const [observedAt, setObservedAt] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
  const [aiConsent, setAiConsent] = useState(false);
  const [publicConsent, setPublicConsent] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState("");

  async function analyzeDescription() {
    setBusy(true); setError(""); setAnalysis("");
    try {
      const response = await fetch("/api/ai/analyze-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description, consent: aiConsent }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Chưa phân tích được nội dung.");
      const result = body.analysis;
      setAnalysis(`${result.neutralSummary} · ${result.sourceType === "firsthand" ? "người gửi tự quan sát" : result.sourceType === "hearsay" ? "lời kể gián tiếp" : "chưa rõ nguồn"}${result.missingDetails.length ? ` · Cần bổ sung: ${result.missingDetails.join(", ")}` : ""}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không kết nối được AI."); }
    finally { setBusy(false); }
  }

  async function submitReport() {
    if (simulated) { setSubmitted(true); window.setTimeout(onSimulated, 500); return; }
    if (!userEmail) { onLogin(); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description, latitude: location.lat, longitude: location.lon, observedAt: new Date(observedAt).toISOString(), dataMode: "real", publicConsent: true }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Không gửi được phản ánh.");
      onSuccess();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không gửi được phản ánh."); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <header><span className="report-heading-icon"><FilePlus2 size={19} /></span><div><p className="panel-overline">FLOODREPORT</p><h2 id="report-title">Gửi phản ánh hiện trường</h2></div><button aria-label="Đóng" onClick={onClose}><X size={18} /></button></header>
        <div className="report-body"><label htmlFor="report-description">Bạn quan sát điều gì? <span>*</span></label><textarea id="report-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ví dụ: Khoảng 16 giờ, mặt đường có nước đọng gần cổng phụ…" maxLength={1600} rows={4} /><small className="report-hint">Ghi thời điểm và vị trí. Không đi vào vùng ngập để chụp ảnh.</small>
          <label htmlFor="observed-at">Thời điểm quan sát</label><input id="observed-at" type="datetime-local" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} />
          <label htmlFor="report-location">Vị trí chọn từ bản đồ</label><div className="report-location"><LocateFixed size={16} /><span>Điểm bản đồ · {location.lat.toFixed(5)}, {location.lon.toFixed(5)}</span></div>
          <label className="upload-label" htmlFor="report-image"><FileImage size={16} /> Ảnh tùy chọn <span>JPEG, PNG hoặc WebP · tối đa 2 MB</span></label><input id="report-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setImage(URL.createObjectURL(file)); }} />{image ? <div className="image-preview"><Image src={image} alt="Ảnh xem trước phản ánh" width={57} height={45} unoptimized /><span>Ảnh chỉ được xem trước trên thiết bị trong bản hiện tại.</span></div> : null}
          <label className="consent-row"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /><span>Tôi đồng ý gửi phần mô tả (không gửi ảnh) tới DeepSeek để AI hỗ trợ phân tích. Có thể gửi phản ánh mà không bật lựa chọn này.</span></label>
          {!simulated ? <label className="consent-row public-consent"><input type="checkbox" checked={publicConsent} onChange={(event) => setPublicConsent(event.target.checked)} /><span>Tôi đồng ý cho công khai tóm tắt do moderator biên tập cùng vị trí đã làm tròn xấp xỉ 100m sau khi duyệt. Email và nguyên văn báo cáo không hiển thị công khai.</span></label> : null}
          {aiConsent ? <button className="secondary-button" disabled={busy || description.trim().length < 8} onClick={() => void analyzeDescription()}><Sparkles size={14} />{busy ? "Đang phân tích…" : "Phân tích mô tả bằng AI"}</button> : null}
          {analysis ? <div className="inline-notice"><Sparkles size={15} />{analysis}</div> : null}
          {error ? <div className="inline-notice error-notice" role="alert">{error}</div> : null}
          <label className="consent-row simulated-consent"><input type="checkbox" checked={simulated} onChange={(event) => setSimulated(event.target.checked)} /><span>Đây là dữ liệu tình huống mô phỏng cho FloodLab, không phải báo cáo thực.</span></label>
          {submitted ? <div className="inline-notice"><ShieldCheck size={15} />Bản gửi được gắn nhãn {simulated ? "MÔ PHỎNG" : "CHỜ ĐĂNG NHẬP"}; chưa đăng lên bản đồ công khai.</div> : null}
        </div>
        <footer><span><ShieldCheck size={14} /> Chờ kiểm duyệt · chưa phải cảnh báo</span><button className="primary-button" disabled={description.trim().length < 8 || busy || (!simulated && !publicConsent)} onClick={() => void submitReport()}>{simulated ? <Sparkles size={15} /> : <ArrowRight size={15} />}{simulated ? "Tạo mô phỏng" : userEmail ? (busy ? "Đang gửi…" : "Gửi phản ánh") : "Đăng nhập để gửi"}</button></footer>
      </section>
    </div>
  );
}

type RouteCandidate = { id: string; label: string; geometry: { type: "LineString"; coordinates: [number, number][] }; distanceMeters: number; durationSeconds: number; nearbyReviewedReportCount: number; evidenceRadiusMeters: number };

function RouteWorkspace({ origin, destination, onOriginChange, onDestinationChange, onSelectPoint, onRoute }: { origin: MapPoint; destination: MapPoint; onOriginChange: (value: MapPoint) => void; onDestinationChange: (value: MapPoint) => void; onSelectPoint: (target: "origin" | "destination") => void; onRoute: (line: { type: "LineString"; coordinates: [number, number][] } | null) => void }) {
  const [mode, setMode] = useState<"motorbike" | "car" | "walking">("motorbike");
  const [result, setResult] = useState<{ provider: string; profile: string; routes: RouteCandidate[]; evidenceCoverage: string; limitations: string[] } | null>(null);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function compareRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null); onRoute(null);
    try {
      const response = await fetch("/api/routes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin, destination, mode }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Không lấy được tuyến.");
      if (!Array.isArray(body.routes) || body.routes.length === 0 || !body.routes[0].geometry) throw new Error("Provider không trả được tuyến hợp lệ.");
      setResult(body);
      setSelectedRoute(body.routes[0].id);
      onRoute(body.routes[0].geometry);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không lấy được tuyến."); }
    finally { setBusy(false); }
  }

  function coordinateField(label: string, name: "origin" | "destination", value: MapPoint, update: (point: MapPoint) => void) {
    return <fieldset className="route-point"><legend>{label}</legend><label>Vĩ độ<input type="number" step="0.00001" min="10.25" max="12.75" value={value.lat} onChange={(event) => update({ ...value, lat: Number(event.target.value) })} /></label><label>Kinh độ<input type="number" step="0.00001" min="106.25" max="108.1" value={value.lon} onChange={(event) => update({ ...value, lon: Number(event.target.value) })} /></label><button type="button" className="secondary-button" onClick={() => onSelectPoint(name)}><LocateFixed size={13} /> Chọn trên bản đồ</button></fieldset>;
  }

  return <section className="panel path-workspace"><div className="panel-header"><div><p className="panel-overline">FLOODPATH · TUYẾN ỨNG VIÊN</p><h2>Chọn điểm A/B và phương tiện</h2></div><Route size={19} /></div><p className="panel-caption">Các phương án là tuyến ứng viên của provider. Màu/độ dài không biểu diễn tuyến an toàn.</p><form onSubmit={(event) => void compareRoute(event)}><div className="route-point-grid">{coordinateField("Điểm A · xuất phát", "origin", origin, onOriginChange)}{coordinateField("Điểm B · đến", "destination", destination, onDestinationChange)}</div><label className="route-mode-label">Phương tiện<select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="motorbike">Xe máy · Valhalla motor_scooter</option><option value="car">Ô tô · ORS driving-car</option><option value="walking">Đi bộ · ORS foot-walking</option></select></label><button className="primary-button route-submit" disabled={busy}>{busy ? "Đang tìm tuyến…" : "Tìm và đối chiếu tuyến"}<ArrowRight size={14} /></button></form>{error ? <div className="inline-notice error-notice" role="alert">{error}</div> : null}{result ? <div className="route-result"><small>{result.provider} · {result.profile} · evidence: {result.evidenceCoverage === "published_reports_only" ? "bản tin đã xem xét được công bố" : "chưa kết nối"}</small><div className="route-candidate-list">{result.routes.map((candidate) => <button className={`route-candidate ${selectedRoute === candidate.id ? "selected" : ""}`} key={candidate.id} onClick={() => { setSelectedRoute(candidate.id); onRoute(candidate.geometry); }}><b>{candidate.label}</b><span>{(candidate.distanceMeters / 1000).toFixed(1)} km · {Math.max(1, Math.round(candidate.durationSeconds / 60))} phút provider</span><small>{candidate.nearbyReviewedReportCount} phản ánh đã xem xét trong bán kính {candidate.evidenceRadiusMeters}m</small></button>)}</div>{result.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}</div> : null}</section>;
}

function ReportsWorkspace({ role, userEmail }: { role: NonNullable<Session>["role"] | null; userEmail: string | null }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const endpoint = role === "admin" || role === "moderator" ? "/api/moderation/queue" : "/api/reports";
    void fetch(endpoint).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Không tải được phản ánh.");
      if (active) setItems(body.reports ?? []);
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Không tải được phản ánh."); });
    return () => { active = false; };
  }, [role, refresh]);

  async function decide(item: Record<string, unknown>, status: "needs_more_info" | "reviewed") {
    const id = String(item.id ?? "");
    const summary = status === "reviewed" ? (summaries[id] ?? "").trim() : "";
    if (status === "reviewed" && summary.length < 8) { setError("Nhập bản tóm tắt công khai đã loại thông tin cá nhân trước khi duyệt."); return; }
    setBusyId(id); setError("");
    try {
      const response = await fetch(`/api/moderation/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: item.version, status, reason: "Moderator đã xem xét nội dung và vị trí.", publicSummary: summary, verificationLevel: "team_reviewed" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Không cập nhật được trạng thái.");
      setRefresh((value) => value + 1);
      window.dispatchEvent(new Event("reports:updated"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không cập nhật được trạng thái."); }
    finally { setBusyId(""); }
  }

  async function withdraw(item: Record<string, unknown>) {
    if (!window.confirm("Rút phản ánh này khỏi hàng chờ? Thao tác sẽ được ghi vào lịch sử.")) return;
    const id = String(item.id ?? "");
    setBusyId(id); setError("");
    try {
      const response = await fetch(`/api/reports/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: item.version }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Không rút được phản ánh.");
      setRefresh((value) => value + 1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không rút được phản ánh."); }
    finally { setBusyId(""); }
  }

  const isModerator = role === "admin" || role === "moderator";
  return <section className="panel reports-workspace"><div className="panel-header"><div><p className="panel-overline">FLOODREPORT · FLOODCOMMAND</p><h2>{isModerator ? "Hàng chờ kiểm duyệt" : userEmail ? "Phản ánh của tôi" : "Đăng nhập để xem phản ánh"}</h2></div><div className="report-toolbar"><Link prefetch={false} className="secondary-button" href="/api/reports/public/export?format=csv" download="floodtwin-public-reports.csv"><Download size={13} /> CSV công khai</Link><Link prefetch={false} className="secondary-button" href="/api/reports/public/export?format=geojson" download="floodtwin-public-reports.geojson"><Download size={13} /> GeoJSON</Link><button className="secondary-button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={13} /> Làm mới</button></div></div><p className="panel-caption">Bản ghi cộng đồng không tự trở thành tình trạng đường hoặc cảnh báo chính thức. Tệp xuất chỉ có báo cáo đã xem xét còn hiệu lực và trường công khai đã làm tròn tọa độ.</p>{error ? <div className="inline-notice error-notice" role="alert">{error}</div> : null}{items.length === 0 && !error ? <p className="report-hint">Chưa có phản ánh phù hợp.</p> : null}{items.map((item) => { const id = String(item.id); const withdrawable = ["pending_review", "needs_more_info"].includes(String(item.status)); return <article className="report-row" key={id}><div className="report-row-main"><b>{String(item.status ?? "pending_review").replaceAll("_", " ")}</b><p>{String(item.description ?? "")}</p><small>{item.observed_at ? new Date(String(item.observed_at)).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : ""} · phiên bản {String(item.version ?? "?")}</small>{isModerator ? <label className="summary-label">Tóm tắt công khai đã rà soát<input value={summaries[id] ?? ""} maxLength={280} onChange={(event) => setSummaries((current) => ({ ...current, [id]: event.target.value }))} placeholder="Không đưa tên, email, số điện thoại hoặc địa chỉ nhà riêng." /></label> : null}</div>{isModerator ? <div className="report-row-actions"><button className="secondary-button" disabled={busyId === id} onClick={() => void decide(item, "needs_more_info")}>Cần bổ sung</button><button className="primary-button" disabled={busyId === id} onClick={() => void decide(item, "reviewed")}>Duyệt nội bộ</button></div> : userEmail && withdrawable ? <button className="secondary-button" disabled={busyId === id} onClick={() => void withdraw(item)}>Rút phản ánh</button> : null}</article>; })}</section>;
}

function LoginDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (session: NonNullable<Session>) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="modal-backdrop auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="report-dialog auth-dialog" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(""); try { const response = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); const sessionResponse = await fetch("/api/auth/session"); const sessionBody = await sessionResponse.json(); onSuccess(sessionBody.user); } catch (caught) { setError(caught instanceof Error ? caught.message : "Đăng nhập thất bại."); } finally { setBusy(false); } }}><header><span className="report-heading-icon"><ShieldCheck size={19} /></span><div><p className="panel-overline">TÀI KHOẢN FLOODTWIN</p><h2>Đăng nhập</h2></div><button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button></header><div className="report-body"><p className="report-hint">Tài khoản do quản trị viên cấp. FloodTwin không tự mở đăng ký công khai.</p><label htmlFor="login-email">Email</label><input id="login-email" type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /><label htmlFor="login-password">Mật khẩu</label><input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />{error ? <div className="inline-notice error-notice" role="alert">{error}</div> : null}</div><footer><span>Phiên xác thực Supabase</span><button className="primary-button" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button></footer></form></div>;
}
