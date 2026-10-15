import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ reports: [], sourceStatus: "not_configured" }, {
    headers: { "Cache-Control": "no-store" },
  });
  const { data, error } = await client.from("public_reports")
    .select("id,public_summary,verification_level,latitude,longitude,observed_at,expires_at,status,updated_at")
    .eq("status", "reviewed").gt("expires_at", new Date().toISOString()).order("observed_at", { ascending: false }).limit(300);
  if (error) return NextResponse.json({ reports: [], sourceStatus: "unavailable" }, { status: 503 });
  return NextResponse.json({ reports: data, sourceStatus: "available", retrievedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
