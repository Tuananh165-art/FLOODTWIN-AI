# FloodTwin AI

FloodTwin AI là ứng dụng web tiếng Việt thử nghiệm để xem tín hiệu mưa, gửi và kiểm duyệt phản ánh hiện trường, rồi phát triển so sánh phương án di chuyển. Phạm vi nghiên cứu bao trùm địa bàn Đồng Nai sau hợp nhất, gồm Bình Phước trước đây.

Ứng dụng là công cụ thông tin tham khảo. Mưa dự báo không chứng minh đường ngập; không có báo cáo không có nghĩa là đường an toàn. FloodTwin không thay thế bản tin/cảnh báo chính thức và không bảo đảm tuyến đường an toàn.

## Trạng thái hiện tại

- Dashboard responsive, bản đồ MapLibre với tile OpenStreetMap và attribution, chọn tọa độ và nút vị trí thiết bị.
- API Open-Meteo cho dữ liệu điểm dự báo hiện tại và tối đa 48 mốc giờ; tổng mưa 1/3/6/24 giờ; quy tắc mưa thử nghiệm có phiên bản, không phải xác suất ngập.
- FloodLab có tám kịch bản cục bộ, phát lại, reset và xuất cấu hình JSON; watermark luôn hiển thị và không ghi dữ liệu thật.
- Supabase migration với vai trò, RLS, audit trigger, public view đã lọc và bucket riêng tư.
- Đăng nhập email/mật khẩu cho tài khoản admin cấp; API tạo phản ánh có RLS.
- Endpoint DeepSeek phân tích văn bản theo lựa chọn đồng ý, kiểm tra JSON bằng Zod, giới hạn qua Upstash; lỗi không chặn gửi thủ công.
- Endpoint tuyến ứng viên gọi ORS/Valhalla, ánh xạ đúng profile, cache hình học 30 phút, và tính số báo cáo đã xem xét còn hiệu lực trong bán kính 50m. Chưa tính độ phủ dữ liệu hoặc áp dụng đóng đường chính thức.
- Xuất CSV/GeoJSON từ view công khai đã lọc, chỉ gồm báo cáo đã xem xét còn hiệu lực; CSV trung hòa công thức spreadsheet và GeoJSON dùng `[kinh độ, vĩ độ]`.
- Danh mục yêu cầu có 276 dòng tại [`docs/roadmap-276.csv`](docs/roadmap-276.csv), sinh lại bằng script.

Ảnh ở form hiện chỉ xem trước trên thiết bị; tải lên an toàn và phân tích ảnh chưa bật. So sánh tuyến hiện chỉ đối chiếu tuyến provider với báo cáo được công bố; chưa có lớp dữ liệu đủ để kết luận nguy cơ tuyến và chưa áp dụng lệnh đóng đường. Lịch sử báo cáo của thành viên và hàng chờ moderator đã có; export riêng tư theo tài khoản, thông báo, nhật ký sự kiện đầy đủ và deploy cloud thật còn trong roadmap. PWA chỉ cache app shell/tài nguyên cùng nguồn; API và tile OSM không được cache offline.

## Chạy local

Yêu cầu: Node.js 24 LTS và npm đi kèm. Trong PowerShell tại thư mục repo:

```powershell
npm.cmd install
npm.cmd run dev
```

Mở `http://localhost:3000`. Không cần cloud để mở UI; bản đồ cần truy cập tile OSM, thời tiết cần mạng tới Open-Meteo. Khi nguồn không tải được, ứng dụng hiển thị lỗi/thiếu dữ liệu.

Tạo `.env` từ `.env.example` nếu chưa có. Workspace có thể đã có `.env` local; **không ghi đè** để tránh mất DeepSeek key. Tệp `.env` đã nằm trong `.gitignore`. Đừng dán secret vào issue, commit, log, ảnh chụp hoặc tài liệu.

```powershell
Copy-Item .env.example .env
```

Lệnh trên chỉ dành cho máy chưa có `.env`; nếu tệp đã tồn tại, mở và điền các biến còn thiếu bằng editor cục bộ. `DEEPSEEK_API_KEY` và mọi khóa provider chỉ được đọc trên server.

## Cấu hình từng dịch vụ

- Supabase: làm theo [`docs/SUPABASE.md`](docs/SUPABASE.md).
- Upstash, DeepSeek, ORS và Valhalla: làm theo [`docs/PROVIDERS.md`](docs/PROVIDERS.md).
- Workflow demo, test, deploy và lỗi thường gặp: [`docs/HUONG-DAN-DEMO.md`](docs/HUONG-DAN-DEMO.md).
- Tính năng AI khả thi, trạng thái và workflow kiểm thử: [`docs/AI.md`](docs/AI.md).
- Phạm vi dữ liệu, phương pháp và giới hạn: [`docs/PHUONG-PHAP-VA-DU-LIEU.md`](docs/PHUONG-PHAP-VA-DU-LIEU.md).
- Tiến độ và tiêu chí: [`docs/implementation-roadmap.md`](docs/implementation-roadmap.md).

## Kiểm tra

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run verify:db
npm.cmd run build
```

`verify:db` hiện kiểm tra tĩnh nội dung migration. Nó không thay cho chạy migration và kiểm tra RLS trên project Supabase thật. `smoke:providers` là lệnh kiểm tra dịch vụ riêng; cần cung cấp cấu hình hợp lệ và mạng hoạt động. Xem `PASS / FAIL / BLOCKED / NOT VERIFIED` trong hướng dẫn bàn giao để phân biệt bằng chứng build, mô phỏng và cloud thật.

## Kiến trúc

Next.js App Router/TypeScript, React, Tailwind CSS, MapLibre GL JS, Supabase Auth/Postgres/PostGIS/Storage, Upstash Redis, Open-Meteo, DeepSeek, ORS và Valhalla. Endpoint AI không được quyền duyệt, cấp quyền, sửa trạng thái hoặc công bố cảnh báo. Chi tiết kỹ thuật và giới hạn tại các tài liệu trên.
