import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { publicReportsCsv, publicReportsGeoJson } from "@/lib/export/public-reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") ?? "csv";
  if (format !== "csv" && format !== "geojson") {
    return NextResponse.json({ error: "Định dạng chỉ hỗ trợ csv hoặc geojson." }, { status: 400 });
  }

  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Chưa cấu hình Supabase." }, { status: 503 });
  const { data, error } = await client.from("public_reports")
    .select("public_summary,verification_level,latitude,longitude,observed_at,expires_at,status")
    .eq("status", "reviewed").gt("expires_at", new Date().toISOString())
    .order("observed_at", { ascending: false }).limit(300);
  if (error || !data) return NextResponse.json({ error: "Không tải được dữ liệu công khai để xuất." }, { status: 503 });

  const filename = `floodtwin-public-reports.${format === "csv" ? "csv" : "geojson"}`;
  if (format === "csv") {
    return new Response(publicReportsCsv(data), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  return new Response(JSON.stringify(publicReportsGeoJson(data)), {
    headers: {
      "Content-Type": "application/geo+json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
