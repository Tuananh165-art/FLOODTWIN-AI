import { NextResponse } from "next/server";
import { z } from "zod";
import { assessRainSignal } from "@/lib/flood/risk";
import { calculateRainAccumulations } from "@/lib/weather/accumulations";

export const runtime = "nodejs";

const coordinates = z.object({
  lat: z.coerce.number().min(10.25).max(12.75),
  lon: z.coerce.number().min(106.25).max(108.1),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = coordinates.safeParse({ lat: params.get("lat"), lon: params.get("lon") });

  if (!parsed.success) {
    return NextResponse.json({ error: "Vị trí nằm ngoài phạm vi tra cứu Đồng Nai." }, { status: 400 });
  }

  const { lat, lon } = parsed.data;
  const upstream = new URL("https://api.open-meteo.com/v1/forecast");
  upstream.search = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: "precipitation,temperature_2m,wind_speed_10m",
    hourly: "precipitation,precipitation_probability",
    forecast_days: "2",
    timezone: "Asia/Ho_Chi_Minh",
  }).toString();

  try {
    const response = await fetch(upstream, {
      headers: { Accept: "application/json" },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Nguồn dự báo thời tiết đang gián đoạn. Hãy thử lại sau.", source: "open-meteo" },
        { status: 503 },
      );
    }

    const body: unknown = await response.json();
    const weather = z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        timezone: z.string(),
        current: z
          .object({
            time: z.string(),
            precipitation: z.number().nullable(),
            temperature_2m: z.number().nullable(),
            wind_speed_10m: z.number().nullable(),
          })
          .optional(),
        hourly: z.object({ time: z.array(z.string()), precipitation: z.array(z.number()) }),
        hourly_units: z.object({ precipitation: z.string() }).optional(),
      })
      .safeParse(body);

    if (!weather.success) {
      return NextResponse.json(
        { error: "Nguồn thời tiết trả về dữ liệu không đúng định dạng.", source: "open-meteo" },
        { status: 502 },
      );
    }

    const hours = weather.data.hourly.time
      .map((time, index) => ({ time, precipitationMm: weather.data.hourly.precipitation[index] }))
      .filter((hour): hour is { time: string; precipitationMm: number } =>
        Number.isFinite(hour.precipitationMm),
      )
      .slice(0, 48);
    const currentPrecipitation = weather.data.current?.precipitation ?? null;
    const assessment = assessRainSignal({
      forecast1hMm: hours[0]?.precipitationMm,
      forecast3hMm: hours.slice(0, 3).reduce((total, item) => total + item.precipitationMm, 0),
    });

    return NextResponse.json(
      {
        source: "open-meteo",
        sourceUrl: "https://open-meteo.com/en/docs",
        mode: "forecast",
        location: { lat: weather.data.latitude, lon: weather.data.longitude },
        timezone: weather.data.timezone,
        retrievedAt: new Date().toISOString(),
        resolution: "Dự báo điểm lưới mô hình; không phải phép đo tại mặt đường. Forecast trả tối đa 48 mốc giờ.",
        current: {
          time: weather.data.current?.time ?? null,
          precipitationMm: currentPrecipitation,
          temperatureC: weather.data.current?.temperature_2m ?? null,
          windSpeedKmh: weather.data.current?.wind_speed_10m ?? null,
          label: "Ước tính hiện tại từ mô hình thời tiết; không phải quan trắc đường phố.",
        },
        hours,
        accumulations: calculateRainAccumulations(hours),
        assessment,
      },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Không kết nối được nguồn thời tiết. Thông tin trước đó có thể đã cũ." },
      { status: 503 },
    );
  }
}
