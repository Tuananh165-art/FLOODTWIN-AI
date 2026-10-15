import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Chưa cấu hình Supabase." }, { status: 503 });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  const { data: role } = await client.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !["moderator", "admin"].includes(role.role)) return NextResponse.json({ error: "Tài khoản không có quyền kiểm duyệt." }, { status: 403 });
  const { data, error } = await client.from("reports")
    .select("id,author_id,description,point,observed_at,status,status_reason,verification_level,expires_at,version,created_at,report_media(id,storage_path,mime_type)")
    .in("status", ["pending_review", "needs_more_info"]).eq("data_mode", "real")
    .order("created_at", { ascending: true }).limit(100);
  if (error) return NextResponse.json({ error: "Không tải được hàng chờ kiểm duyệt." }, { status: 503 });
  return NextResponse.json({ reports: data });
}
