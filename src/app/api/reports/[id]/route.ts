import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Chưa cấu hình Supabase." }, { status: 503 });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  const { id } = await context.params;
  const parsedId = z.string().uuid().safeParse(id);
  const body = z.object({ expectedVersion: z.number().int().positive() }).safeParse(await request.json().catch(() => null));
  if (!parsedId.success || !body.success) return NextResponse.json({ error: "Yêu cầu rút phản ánh không hợp lệ." }, { status: 400 });
  const { data, error } = await client.rpc("withdraw_report", {
    p_report_id: parsedId.data,
    p_expected_version: body.data.expectedVersion,
    p_reason: "Người gửi yêu cầu rút phản ánh.",
  });
  if (error) return NextResponse.json({ error: "Không rút được phản ánh. Có thể trạng thái vừa đổi; hãy tải lại." }, { status: error.code === "40001" ? 409 : 403 });
  return NextResponse.json({ report: data?.[0] ?? null });
}
