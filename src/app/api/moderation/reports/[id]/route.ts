import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  status: z.enum(["needs_more_info", "reviewed", "insufficient_evidence", "rejected", "closed"]),
  reason: z.string().trim().min(3).max(500),
  publicSummary: z.string().trim().max(280).default(""),
  verificationLevel: z.enum(["unreviewed", "team_reviewed"]).default("team_reviewed"),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Chưa cấu hình Supabase." }, { status: 503 });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  const { id } = await context.params;
  const parsed = z.string().uuid().safeParse(id);
  const input = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !input.success) return NextResponse.json({ error: "Quyết định không hợp lệ." }, { status: 400 });
  if (input.data.status === "reviewed" && input.data.publicSummary.length < 8) return NextResponse.json({ error: "Cần bản tóm tắt công khai trung lập khi duyệt." }, { status: 400 });
  const { data, error } = await client.rpc("moderate_report", {
    p_report_id: parsed.data,
    p_expected_version: input.data.expectedVersion,
    p_status: input.data.status,
    p_reason: input.data.reason,
    p_public_summary: input.data.publicSummary,
    p_verification_level: input.data.verificationLevel,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "40001" ? 409 : 400;
    return NextResponse.json({ error: status === 409 ? "Báo cáo vừa được người khác cập nhật. Tải lại hàng chờ trước khi quyết định." : "Không áp dụng được quyết định kiểm duyệt." }, { status });
  }
  return NextResponse.json({ result: data?.[0] ?? null });
}
