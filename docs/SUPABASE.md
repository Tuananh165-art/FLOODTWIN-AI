# Cấu hình Supabase từng bước

## 1. Tạo project và lấy URL/khóa công khai

1. Tạo project Supabase, chọn region gần Việt Nam nếu có và đặt mật khẩu database mạnh.
2. Trong **Project Settings → API**, sao chép Project URL và `anon`/publishable key vào `.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Không đưa `service_role` vào client. Thêm `SUPABASE_SERVICE_ROLE_KEY` vào `.env` server để API tra username khi đăng nhập; key này tuyệt đối không có tiền tố `NEXT_PUBLIC_`.

## 2. Tạo schema và chính sách

1. Mở **SQL Editor → New query**.
2. Với project mới, chạy lần lượt `202610150001_core.sql` rồi `202610150002_usernames.sql` trong `supabase/migrations/`.
3. Nếu core migration đã chạy trước đó, chỉ chạy migration mới `202610150002_usernames.sql`; không chạy lại migration core.
4. Xác nhận có bảng `user_profiles` (không cho anon/authenticated đọc), cùng `user_roles`, `reports`, `report_events`, `report_media`, view `public_reports`, extension PostGIS và bucket `report-private` private.
5. Chạy `npm.cmd run verify:db` để kiểm tra hợp đồng tĩnh trong repo. Đây không phải phép thử database thật.
6. Trước khi dùng dữ liệu thật, tạo tài khoản thử nghiệm và làm theo quyền riêng tư trong mục 4.

## 3. Đăng ký và phân quyền

1. Đăng ký từ hộp thoại FloodTwin bằng username, email và mật khẩu ít nhất 10 ký tự. Username dài 3–24 ký tự, chỉ gồm chữ thường, số và `_`; không phân biệt hoa thường.
2. Bật Email provider và cho phép user sign-up trong Authentication. Nếu yêu cầu xác nhận email, cấu hình SMTP và thêm origin local/deploy vào Site URL/Redirect URLs; xác nhận thư rồi đăng nhập bằng username hoặc email cùng mật khẩu.
3. Trigger tự tạo quyền `member`; user mới dùng được AI và luồng thành viên mà không cần admin tạo user/gán role. Member không có quyền moderator/admin. Tên đăng nhập tra qua API server; bảng username bị chặn với anon/authenticated.
4. Chỉ khi cần tài khoản vận hành, đăng nhập SQL Editor bằng quyền quản trị và cấp moderator/admin có chủ ý (thay email):

```sql
update public.user_roles
set role = 'admin', granted_by = null
where user_id = (select id from auth.users where email = 'admin@example.org');
```

5. Sau đó admin có thể cấp moderator cho tài khoản khác:

```sql
update public.user_roles
set role = 'moderator', granted_by = (select id from auth.users where email = 'admin@example.org')
where user_id = (select id from auth.users where email = 'moderator@example.org');
```

Thay email bằng tài khoản vận hành đã tạo. Không gửi mật khẩu trong repo hoặc tài liệu. Để demo tự đăng ký và nhận session ngay, có thể tắt **Confirm email** trong Auth settings của project thử nghiệm; môi trường dùng thật nên cấu hình SMTP và giữ xác nhận email.

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
