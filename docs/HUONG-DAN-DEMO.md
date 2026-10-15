# Hướng dẫn chạy, test, demo và triển khai

## Chạy local và thao tác màn hình

1. Dùng Node 24; chạy `npm.cmd install`, rồi `npm.cmd run dev`.
2. Mở `http://localhost:3000`; bản đồ tập trung tại Biên Hòa. Click bản đồ để chọn tọa độ, bấm nút ghim để xin vị trí trình duyệt (phải cấp quyền).
3. Dùng **Lớp dữ liệu** để xem chú giải. Tile lấy từ OpenStreetMap và attribution ở góc bản đồ.
4. Weather panel hiển thị tối đa 48 giờ dự báo và các tổng 1/3/6/24 giờ của Open-Meteo. Chờ lỗi mạng để xem trạng thái nguồn; đừng diễn giải lỗi thành nguy cơ thấp.
5. Bấm **FloodLab** để xem watermark giả lập; chọn một trong tám kịch bản, phát lại vòng, chỉnh mưa, xuất cấu hình JSON và reset. Tất cả chỉ đổi trạng thái trong trình duyệt.
6. Bấm **Gửi phản ánh**. Ảnh trong bản hiện tại chỉ có preview cục bộ; không gửi/tải lên. Có thể gửi nội dung bằng tài khoản Supabase đã cấp; quyết định moderation API yêu cầu vai trò moderator/admin.
7. Chỉ bật consent AI khi muốn gửi phần mô tả tới DeepSeek. AI cần Supabase, Redis, DeepSeek key và model; nếu không, gửi thủ công vẫn hoạt động.
8. FloodPath nhận A/B bằng cách chọn trên bản đồ hoặc sửa tọa độ, rồi lấy các tuyến ứng viên theo phương tiện. Hệ thống đếm báo cáo nhóm dự án đã xem xét còn hiệu lực trong bán kính 50m; con số này không cho biết tuyến an toàn và không tự đóng đường.
9. Trong **Báo cáo hiện trường**, tải CSV hoặc GeoJSON công khai. Chỉ các tóm tắt đã duyệt/còn hiệu lực được xuất; tọa độ đã làm tròn và không có email/nguyên văn mô tả.

## Kịch bản demo 5 phút

1. Nêu địa bàn thử nghiệm và thông báo an toàn (30 giây).
2. Mở bản đồ/đọc điểm thời tiết và giờ truy vấn; chỉ rõ đây là dự báo mô hình, không phải đo mực nước (1 phút).
3. Chọn điểm khác trên bản đồ và tải lại forecast (30 giây).
4. Vào FloodLab, kéo mưa lên, chỉ watermark; reset trước khi rời (45 giây).
5. Nếu có Supabase đã seed: đăng nhập member, gửi mô tả “tôi nghe nói tối qua…”, bật AI opt-in, xem gợi ý hearsay/uncertainty rồi sửa và gửi. Nếu dịch vụ chưa cấu hình, trình bày ảnh chụp luồng demo cục bộ và nói rõ chưa ghi DB (1 phút).
6. Nếu có moderator: mở hàng chờ, nhập summary công khai trung lập, quyết định reviewed; kiểm tra bản ghi trong DB/view và marker trên bản đồ. Vị trí public đã làm tròn. Đừng trình bày tuyến trả về là an toàn (1 phút).

## Kịch bản dài 10–15 phút

Thêm phần Supabase tạo user/role, kiểm tra RLS giữa A/B, AI schema invalid, provider timeout, response tuyến cơ sở, `verify:db`, và giải thích những gì còn thiếu. Ghi lại endpoint response đã lọc secret, SQL row status và log có request ID nhưng không token.

## Chạy bộ kiểm tra

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run verify:db
npm.cmd run build
```

`npm.cmd run test:e2e` chạy Playwright nhưng cần browser đã cài (`npx.cmd playwright install chromium`). Bộ E2E hiện chưa bao phủ toàn bộ workflow cloud. `npm.cmd run smoke:providers` báo provider nào đã cấu hình/kết nối; không gọi hết API trong unit test.

## GitHub → Vercel

1. Tạo private/public repository GitHub trong tài khoản của bạn; không upload `.env`.
2. Trong PowerShell, kiểm tra `git check-ignore .env` phải in `.env` trước khi stage. `git status --short` phải không liệt kê `.env`.
3. Khởiởi tạo git nếu chưa có bằng `git init -b main`, rồi `git add .` và commit các source/docs. Review danh sách staged bằng `git status --short`.
4. Push repository lên GitHub theo remote do bạn tạo.
5. Vercel → Add New → Project → Import repo; Framework Next.js, build command mặc định `next build`.
6. Khai báo biến server/public theo `.env.example` trong Vercel Settings cho đúng environment. Không đưa secret vào `NEXT_PUBLIC_*`.
7. Deploy rồi mở URL Vercel. Kiểm tra home, `/api/weather`, đăng nhập, gửi thử báo cáo, AI opt-in (nếu có đủ provider), queue moderator và route API.
8. Ghi riêng commit SHA, deployment URL, timestamp, response status, project/environment. Build xanh không thay thế kiểm thử cloud/database.

Chưa cấu hình dự án cloud hay public deployment trong workspace. Không có cron trong V1; dọn ảnh/báo cáo theo retention hiện chưa tự động hóa.

## Lỗi thường gặp

- **Weather 503/502:** kiểm tra mạng và API Open-Meteo; UI giữ trạng thái nguồn lỗi, không lấy forecast cũ làm realtime.
- **Auth 503:** thiếu Supabase URL/anon key hoặc chưa chạy migration.
- **Auth 401:** tài khoản chưa được admin tạo, sai mật khẩu, hoặc xác nhận email chưa hoàn tất.
- **Report 403:** kiểm tra RLS; không tắt RLS như cách sửa.
- **AI 503:** thiếu Upstash, DeepSeek key/model hoặc network; gửi thủ công vẫn dùng được.
- **AI 429:** hạn mức hằng ngày; không xóa key/Redis để né quota.
- **Routing 503:** thiếu key/Redis/provider; Valhalla community không SLA.
- **Map trống:** kiểm tra kết nối tile và attribution controls; không tải hàng loạt tile.

## Trạng thái bằng chứng

Ghi rõ **PASS** khi kiểm thử thực hiện đạt; **FAIL** nếu đã chạy và không đạt; **BLOCKED** nếu phụ thuộc cổng ngoài; **NOT VERIFIED** khi chưa chạy hoặc thiếu cấu hình. Unit tests/build chỉ là bằng chứng source; FloodLab là mô phỏng; chỉ smoke test project/provider/deployment thật mới chứng minh tích hợp cloud.
