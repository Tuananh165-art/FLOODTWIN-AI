# Cấu hình Supabase từng bước

## 1. Tạo project và lấy URL/khóa công khai

1. Tạo project Supabase, chọn region gần Việt Nam nếu có và đặt mật khẩu database mạnh.
2. Trong **Project Settings → API**, sao chép Project URL và `anon`/publishable key vào `.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Không đưa `service_role` vào client. Ứng dụng hiện không cần biến service-role.

## 2. Tạo schema và chính sách

1. Mở **SQL Editor → New query**.
2. Mở tệp `supabase/migrations/202610150001_core.sql`, dán toàn bộ SQL, chạy một lần.
3. Xác nhận có các bảng `user_roles`, `reports`, `report_events`, `report_media`, view `public_reports`, extension PostGIS và bucket `report-private` ở chế độ private.
4. Chạy `npm.cmd run verify:db` để kiểm tra hợp đồng tĩnh trong repo. Đây không phải phép thử database thật.
5. Trước khi dùng dữ liệu thật, tạo hai user thử nghiệm và làm theo quyền riêng tư trong mục 4.

## 3. Cấp tài khoản

1. Vào **Authentication → Users → Add user**; tạo user member và moderator. Không bật public sign-up nếu bạn chỉ muốn admin cấp tài khoản.
2. Trigger migration tự tạo role `member` khi user được tạo.
3. Đăng nhập SQL Editor bằng quyền quản trị và đặt một tài khoản ban đầu thành admin (thay email):

```sql
update public.user_roles
set role = 'admin', granted_by = null
where user_id = (select id from auth.users where email = 'admin@example.org');
```

4. Sau đó admin có thể cấp moderator cho tài khoản khác:

```sql
update public.user_roles
set role = 'moderator', granted_by = (select id from auth.users where email = 'admin@example.org')
where user_id = (select id from auth.users where email = 'moderator@example.org');
```

Thay email bằng tài khoản thử nghiệm của bạn. Không gửi mật khẩu trong repo hoặc tài liệu. Có thể tắt **Confirm email** trong Authentication settings cho môi trường demo cấp tài khoản thủ công; production nên cấu hình SMTP riêng trước khi bật luồng email.

## 4. Thử phân quyền bắt buộc

1. Đăng nhập User A, POST `/api/reports` qua giao diện hoặc DevTools. Kỳ vọng HTTP 201 và trạng thái `pending_review`.
2. Đăng nhập User B rồi gọi GET `/api/reports`. B chỉ thấy báo cáo của chính mình theo RLS.
3. Đăng nhập member rồi gọi GET `/api/moderation/queue`. Kỳ vọng HTTP 403.
4. Đăng nhập moderator rồi gọi GET `/api/moderation/queue`. Kỳ vọng chỉ hàng chờ được phép xem.
5. Gửi quyết định với `expectedVersion` cũ qua `PATCH /api/moderation/reports/{id}`. Kỳ vọng HTTP 409 sau khi version đã thay đổi.
6. Thành viên phải đồng ý công khai trước khi gửi. Báo cáo được xem xét chỉ xuất hiện trong `public_reports` sau khi moderator cung cấp summary và đặt trạng thái `reviewed`. View không chứa author/email/nguyên văn mô tả; tọa độ công khai được làm tròn bốn chữ số thập phân (~10m).

Lưu response status và ảnh chụp không chứa email/token làm bằng chứng. Nếu dùng Supabase mới, kiểm tra kỹ SQL Editor trả về không lỗi trước khi tiếp tục.

## 5. Biến local và deploy

Đặt URL và anon key vào `.env` local và Vercel Project → Settings → Environment Variables cho Development/Preview/Production phù hợp. Sau khi đổi env, khởi động lại dev server hoặc redeploy. Đừng đưa giá trị key vào ticket/log.

Người gửi có thể rút báo cáo khi còn chờ xem xét; thao tác cần version hiện hành và được ghi trong audit. Upload ảnh chưa được nối từ giao diện; bucket/policy chỉ là schema nền, không tuyên bố upload đã kiểm thử. Public report chỉ đọc qua view đã lọc.
