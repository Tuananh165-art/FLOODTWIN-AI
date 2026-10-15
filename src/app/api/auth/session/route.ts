import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ configured: false, user: null });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ configured: true, user: null });
  const { data: role } = await client.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ configured: true, user: { email: user.email, role: role?.role ?? "member" } });
}

export async function POST(request: Request) {
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Chưa cấu hình Supabase Auth." }, { status: 503 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("email" in body) || !("password" in body)) {
    return NextResponse.json({ error: "Vui lòng nhập email và mật khẩu." }, { status: 400 });
  }
  const { email, password } = body as { email: unknown; password: unknown };
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 256) {
    return NextResponse.json({ error: "Thông tin đăng nhập không hợp lệ." }, { status: 400 });
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) return NextResponse.json({ error: "Không đăng nhập được. Kiểm tra tài khoản do quản trị viên cấp." }, { status: 401 });
  return NextResponse.json({ user: { email: data.user.email } });
}

export async function DELETE() {
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Chưa cấu hình Supabase Auth." }, { status: 503 });
  await client.auth.signOut();
  return NextResponse.json({ ok: true });
}
