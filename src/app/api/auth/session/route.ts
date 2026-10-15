import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ configured: false, user: null });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ configured: true, user: null });
  const { data: role } = await client.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ configured: true, user: { email: user.email, username: user.user_metadata?.username ?? null, role: role?.role ?? "member" } });
}

const loginSchema = z.object({
  action: z.literal("login").optional(),
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
});
const registrationSchema = z.object({
  action: z.literal("register"),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.json({ error: "Thiếu nguồn gửi yêu cầu đăng nhập." }, { status: 403 });
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "Nguồn gửi yêu cầu đăng nhập không hợp lệ." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Nguồn gửi yêu cầu đăng nhập không hợp lệ." }, { status: 403 });
  }
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Chưa cấu hình Supabase Auth." }, { status: 503 });
  const body: unknown = await request.json().catch(() => null);

  if (body && typeof body === "object" && "action" in body && body.action === "register") {
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Tên đăng nhập cần 3–24 ký tự chữ thường, số hoặc dấu gạch dưới; email phải hợp lệ và mật khẩu ít nhất 10 ký tự." }, { status: 400 });
    const admin = getSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Thiếu khóa service role phía máy chủ để hỗ trợ đăng nhập bằng tên." }, { status: 503 });
    const { data: existing, error: lookupError } = await admin.from("user_profiles").select("user_id").eq("username", parsed.data.username).maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Chưa áp dụng migration tên đăng nhập hoặc khóa service role chưa đủ quyền. Chạy migration 202610150002_usernames.sql trong Supabase SQL Editor." }, { status: 503 });
    if (existing) return NextResponse.json({ error: "Tên đăng nhập này đã được sử dụng." }, { status: 409 });
    const { data, error } = await client.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { username: parsed.data.username } },
    });
    if (error) {
      if (/user_profiles_username_ci_idx|duplicate key/i.test(error.message)) return NextResponse.json({ error: "Tên đăng nhập này đã được sử dụng." }, { status: 409 });
      if (/create_user_profile|user_profiles|schema cache/i.test(error.message)) return NextResponse.json({ error: "Cơ sở dữ liệu chưa có migration tên đăng nhập. Hãy chạy migration 202610150002_usernames.sql trong Supabase SQL Editor." }, { status: 503 });
      return NextResponse.json({ error: "Không tạo được tài khoản. Hãy kiểm tra email, mật khẩu và cấu hình Supabase Auth." }, { status: 400 });
    }
    if (!data.user) return NextResponse.json({ error: "Supabase chưa tạo được tài khoản." }, { status: 502 });
    return NextResponse.json({
      created: true,
      confirmationRequired: !data.session,
      message: data.session ? "Đăng ký thành công. Tài khoản mới có quyền thành viên." : "Đã tạo tài khoản. Hãy xác nhận email rồi đăng nhập bằng tên đăng nhập và mật khẩu.",
    }, { status: 201 });
  }

  const parsed = loginSchema.safeParse(body);
  const legacy = body && typeof body === "object" && "email" in body && "password" in body
    ? z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256) }).safeParse(body)
    : null;
  const legacyData = legacy?.success ? legacy.data : null;
  if (!parsed.success && !legacyData) return NextResponse.json({ error: "Vui lòng nhập tên đăng nhập hoặc email cùng mật khẩu." }, { status: 400 });

  const identifier = parsed.success ? parsed.data.identifier : legacyData!.email;
  const password = parsed.success ? parsed.data.password : legacyData!.password;
  let email = identifier;
  if (!identifier.includes("@")) {
    const admin = getSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Thiếu khóa service role phía máy chủ để tra tên đăng nhập." }, { status: 503 });
    const { data: profile, error: lookupError } = await admin.from("user_profiles").select("user_id").eq("username", identifier.toLowerCase()).maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Chưa áp dụng migration tên đăng nhập trong Supabase. Hãy chạy 202610150002_usernames.sql trong SQL Editor." }, { status: 503 });
    if (profile) {
      const { data: account } = await admin.auth.admin.getUserById(profile.user_id);
      email = account.user?.email ?? "invalid@floodtwin.invalid";
    } else {
      email = "invalid@floodtwin.invalid";
    }
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) return NextResponse.json({ error: "Không đăng nhập được. Kiểm tra tên đăng nhập/email và mật khẩu." }, { status: 401 });
  return NextResponse.json({ user: { email: data.user.email, username: data.user.user_metadata?.username ?? null } });
}

export async function DELETE() {
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Chưa cấu hình Supabase Auth." }, { status: 503 });
  await client.auth.signOut();
  return NextResponse.json({ ok: true });
}
