import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { VIETNAM_BOUNDS } from "@/lib/geo/vietnam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reportInput = z.object({
  description: z.string().trim().min(8).max(1600),
  latitude: z.number().min(VIETNAM_BOUNDS.south).max(VIETNAM_BOUNDS.north),
  longitude: z.number().min(VIETNAM_BOUNDS.west).max(VIETNAM_BOUNDS.east),
  observedAt: z.string().datetime({ offset: true }).refine((value) => Date.parse(value) <= Date.now() + 5 * 60_000, "Thời điểm quan sát không thể ở tương lai."),
  dataMode: z.literal("real"),
  publicConsent: z.literal(true),
});

export async function POST(request: Request) {
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Chưa cấu hình Supabase." }, { status: 503 });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập để gửi phản ánh." }, { status: 401 });
  const input = reportInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Kiểm tra mô tả, thời gian và vị trí trong phạm vi Việt Nam." }, { status: 400 });

  const { data, error } = await client.from("reports").insert({
    author_id: user.id,
    description: input.data.description,
    point: `SRID=4326;POINT(${input.data.longitude} ${input.data.latitude})`,
    observed_at: input.data.observedAt,
    expires_at: new Date(new Date(input.data.observedAt).getTime() + 2 * 60 * 60 * 1000).toISOString(),
    data_mode: "real",
    public_consent: true,
  }).select("id,status,created_at,version").single();
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: "Không lưu được phản ánh. Kiểm tra cấu hình/migration Supabase rồi thử lại." }, { status });
  }
  return NextResponse.json({ report: data }, { status: 201 });
}

export async function GET() {
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Chưa cấu hình Supabase." }, { status: 503 });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const { data, error } = await client.from("reports")
    .select("id,description,observed_at,status,status_reason,verification_level,expires_at,version,created_at,updated_at")
    .order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Không tải được lịch sử phản ánh." }, { status: 503 });
  return NextResponse.json({ reports: data });
}
