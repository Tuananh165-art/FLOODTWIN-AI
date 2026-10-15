import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { countNearbyReviewedReports } from "@/lib/routing/evidence";
import { getRouteProvider } from "@/lib/routing/profile";
import { decodePolyline6 } from "@/lib/routing/polyline";
import { vietnamPointSchema } from "@/lib/geo/vietnam";

export const runtime = "nodejs";

const requestSchema = z.object({
  origin: vietnamPointSchema,
  destination: vietnamPointSchema,
  mode: z.enum(["motorbike", "car", "walking"]),
});

const orsResponseSchema = z.object({
  features: z.array(z.object({
    geometry: z.object({ type: z.literal("LineString"), coordinates: z.array(z.tuple([z.number(), z.number()])).min(2) }),
    properties: z.object({ summary: z.object({ distance: z.number(), duration: z.number() }) }),
  })).min(1),
});

const tripSchema = z.object({
  legs: z.array(z.object({ shape: z.string() })).min(1),
  summary: z.object({ length: z.number(), time: z.number() }),
});
const valhallaResponseSchema = z.object({ trip: tripSchema, alternates: z.array(z.object({ trip: tripSchema })).optional() });

type Candidate = { id: string; label: string; geometry: { type: "LineString"; coordinates: [number, number][] }; distanceMeters: number; durationSeconds: number };

export async function POST(request: Request) {
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Điểm đầu/cuối phải nằm trong khung tọa độ tra cứu Việt Nam; hãy kiểm tra lại vị trí." }, { status: 400 });
  const selected = getRouteProvider(input.data.mode);
  const coordinates = [[input.data.origin.lon, input.data.origin.lat], [input.data.destination.lon, input.data.destination.lat]];
  const controller = AbortSignal.timeout(12_000);

  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!redisUrl || !redisToken) return NextResponse.json({ error: "Tạm khóa định tuyến vì chưa cấu hình Upstash để giới hạn và cache yêu cầu." }, { status: 503 });
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");
    const redis = new Redis({ url: redisUrl, token: redisToken });
    const cacheKey = `floodtwin:route:v2:${input.data.mode}:${input.data.origin.lat.toFixed(5)},${input.data.origin.lon.toFixed(5)}:${input.data.destination.lat.toFixed(5)},${input.data.destination.lon.toFixed(5)}`;
    let candidates = await redis.get<Candidate[]>(cacheKey);
    let cacheStatus: "hit" | "miss" = "hit";

    if (!Array.isArray(candidates) || candidates.some((route) => !route.geometry?.coordinates?.length)) {
      cacheStatus = "miss";
      let response: Response;
      if (selected.provider === "openrouteservice") {
        const apiKey = process.env.ORS_API_KEY;
        if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình ORS_API_KEY; tuyến ô tô/đi bộ chưa khả dụng." }, { status: 503 });
        const perClient = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: "floodtwin:ors:minute" });
        const global = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200, "1 d"), prefix: "floodtwin:ors:daily" });
        const clientIp = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "shared";
        if (!(await perClient.limit(clientIp)).success || !(await global.limit("all")).success) return NextResponse.json({ error: "Đã đạt giới hạn gọi dịch vụ định tuyến. Vui lòng thử lại sau." }, { status: 429 });
        const base = (process.env.ORS_BASE_URL ?? "https://api.openrouteservice.org").replace(/\/$/, "");
        response = await fetch(`${base}/v2/directions/${selected.profile}/geojson`, {
          method: "POST",
          headers: { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/geo+json" },
          body: JSON.stringify({ coordinates, instructions: false, geometry: true, alternative_routes: { target_count: 3, share_factor: 0.6, weight_factor: 1.4 } }),
          signal: controller,
        });
      } else {
        const base = (process.env.VALHALLA_BASE_URL ?? "https://valhalla1.openstreetmap.de").replace(/\/$/, "");
        const rate = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1, "1 s"), prefix: "floodtwin:valhalla:global" });
        if (!(await rate.limit("all")).success) return NextResponse.json({ error: "Máy chủ định tuyến xe máy đang được giới hạn. Chờ một chút rồi thử lại." }, { status: 429 });
        const params = new URLSearchParams({ json: JSON.stringify({ locations: [input.data.origin, input.data.destination], costing: selected.profile, units: "kilometers", alternates: 2 }) });
        response = await fetch(`${base}/route?${params.toString()}`, { headers: { Accept: "application/json" }, signal: controller });
      }

      if (!response.ok) return NextResponse.json({ error: `Nhà cung cấp ${selected.provider} không trả được tuyến (${response.status}).` }, { status: 502 });
      const raw: unknown = await response.json();
      if (selected.provider === "openrouteservice") {
        const parsed = orsResponseSchema.safeParse(raw);
        if (!parsed.success) return NextResponse.json({ error: "OpenRouteService không trả về tuyến đúng định dạng." }, { status: 502 });
        candidates = parsed.data.features.map((feature, index) => ({
          id: `route-${index + 1}`, label: index === 0 ? "Tuyến cơ sở" : `Phương án ${index + 1}`,
          geometry: feature.geometry, distanceMeters: feature.properties.summary.distance, durationSeconds: feature.properties.summary.duration,
        }));
      } else {
        const parsed = valhallaResponseSchema.safeParse(raw);
        if (!parsed.success) return NextResponse.json({ error: "Valhalla không trả về tuyến đúng định dạng." }, { status: 502 });
        const trips = [parsed.data.trip, ...(parsed.data.alternates ?? []).map((alternative) => alternative.trip)];
        candidates = trips.map((trip, index) => ({
          id: `route-${index + 1}`, label: index === 0 ? "Tuyến cơ sở" : `Phương án ${index + 1}`,
          geometry: { type: "LineString", coordinates: decodePolyline6(trip.legs[0].shape) },
          distanceMeters: trip.summary.length * 1000, durationSeconds: trip.summary.time,
        }));
      }
      await redis.set(cacheKey, candidates, { ex: 1800 });
    }

    // Re-read current reviewed evidence on every compare; only base route geometries are cached.
    const supabase = await getSupabaseServerClient();
    let evidenceAvailable = false;
    let reviewedReports: { id: string; latitude: number; longitude: number }[] = [];
    if (supabase) {
      const { data, error } = await supabase.from("public_reports")
        .select("id,latitude,longitude").eq("status", "reviewed").gt("expires_at", new Date().toISOString()).limit(300);
      if (!error && data) {
        evidenceAvailable = true;
        reviewedReports = data;
      }
    }

    const compared = candidates.map((route) => ({
      ...route,
      nearbyReviewedReportCount: countNearbyReviewedReports(route.geometry.coordinates, reviewedReports, 50),
      evidenceRadiusMeters: 50,
    }));
    return NextResponse.json({
      provider: selected.provider,
      profile: selected.profile,
      routes: compared,
      cacheStatus,
      evidenceCoverage: evidenceAvailable ? "published_reports_only" : "unavailable",
      recommendation: "not_ranked",
      limitations: [
        "Đếm báo cáo nhóm dự án đã xem xét cách tuyến tối đa 50m; lớp báo cáo không đầy đủ không đại diện cho mọi tình trạng đường.",
        "Không có báo cáo gần tuyến không đồng nghĩa tuyến an toàn. Chưa có lớp độ phủ GIS hoặc hạn chế đường chính thức.",
        "ETA là ước tính nhà cung cấp; không có dữ liệu giao thông trực tiếp hoặc hiệu chuẩn dự báo ngập.",
      ],
    }, { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } });
  } catch {
    return NextResponse.json({ error: `Không kết nối được dịch vụ lưu cache hoặc nhà cung cấp tuyến ${selected.provider}.` }, { status: 503 });
  }
}
