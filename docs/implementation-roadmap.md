# FloodTwin AI — roadmap triển khai

Roadmap này chuyển tài liệu ý tưởng sang phạm vi có thể kiểm chứng. Ma trận đầy đủ từng mục nằm tại [`roadmap-276.csv`](roadmap-276.csv) và được tạo bằng `npm run roadmap:generate` từ tệp nguồn ở gốc repo.

## Quy tắc trạng thái

- **V1**: nằm trong phạm vi demo/nghiên cứu; chỉ chuyển PASS khi có kiểm thử và bằng chứng tương ứng.
- **Mở rộng**: để sau V1, cần dữ liệu, hiệu chuẩn hoặc năng lực chưa có.
- **Cần dữ liệu hoặc đối tác**: phụ thuộc quyền sử dụng, nguồn chính thức, chuyên gia hoặc tích hợp được cấp phép.
- Mỗi tính năng có dữ liệu giả phải mang nhãn mô phỏng; dữ liệu mô phỏng không đi vào API/bảng dữ liệu thật.

## Mốc và tiêu chí nghiệm thu

| Mốc | Trạng thái | Nội dung | Bằng chứng nghiệm thu |
|---|---|---|---|
| M1 — Nền tảng và demo | PASS ở source/build/E2E | Next.js, dashboard tiếng Việt, bản đồ OSM có attribution, chọn tọa độ/geolocation, Open-Meteo 48 giờ và tổng mưa 1/3/6/24 giờ, FloodPulse tham khảo, FloodLab 8 kịch bản cô lập; bảo vệ secret; ma trận 276 ý tưởng | lint/typecheck/22 unit/7 E2E/build; smoke Open-Meteo thật đạt |
| M2 — Dữ liệu thật và quyền | Source partial; cloud NOT VERIFIED | Supabase Auth, schema/RLS, tài khoản admin cấp, gửi/lịch sử báo cáo, rút báo cáo, moderation RPC optimistic version, sanitized public view, audit trigger. Upload ảnh an toàn chưa bật | migration contract tĩnh đạt; cần project Supabase thật và hai tài khoản để xác minh quyền |
| M3 — DeepSeek và đánh giá AI | Source partial; provider NOT VERIFIED | DeepSeek text adapter JSON+Zod, consent, Upstash per-user/global limit, prompt injection boundary. Chưa có bộ 60 mẫu; vision chưa bật | schema unit tests; cần smoke model thật, đánh giá gán nhãn và kiểm tra quota |
| M4 — Predict, Observe, Replan | Partial; provider NOT VERIFIED | ORS/Valhalla candidates theo mode, geometry map, TTL cache, đếm reports đã xem xét trong bán kính 50m. Chưa tính độ phủ dữ liệu/lệnh đóng đường; chưa có thời điểm xuất phát dự kiến | profile/polyline/evidence tests + E2E mock; ORS thiếu API key, Valhalla đang fail-closed do thiếu Upstash |
| M5 — Hoàn thiện và triển khai | Partial | CI, tài liệu tiếng Việt, PWA app-shell, lịch sử thành viên/hàng chờ moderator, export công khai CSV/GeoJSON; export riêng tư theo tài khoản/thông báo/deploy Supabase/Vercel chưa có | local CI-equivalent đạt; deployment URL, live DB và providers cần cấu hình thật |

## TODO phụ thuộc

1. [x] Khởi tạo Next.js App Router, TypeScript, Tailwind, Vitest, Playwright, CI và giữ `.env` local khỏi Git.
2. [x] Unit test quy tắc mưa, schema AI, profile, polyline và khoảng cách evidence.
3. [x] Dashboard, bản đồ, forecast, FloodLab 8 kịch bản local có replay/reset/export config, PWA app shell; local lint/typecheck/test/build/E2E đã chạy.
4. [x] Viết schema/RLS/moderation RPC; [ ] chạy Supabase thật, thử A/B và concurrent updates.
5. [x] Auth/report API/UI; [ ] xác minh workflow live trên Supabase.
6. [ ] Tích hợp upload ảnh riêng tư, validate magic bytes, resize/re-encode và chính sách xóa.
7. [x] DeepSeek text adapter opt-in và Zod; [ ] smoke model thật/bộ đánh giá ≥60 mẫu/vision probe.
8. [x] Upstash rate limits, fail-closed AI/routing, geometry cache.
9. [x] ORS/Valhalla profile, route alternatives và count evidence proximity; [ ] provider smoke tại Đồng Nai.
10. [x] FloodLab 8 kịch bản mô phỏng local, replay, reset và export config.
11. [x] Export CSV/GeoJSON từ view công khai đã lọc; [ ] export riêng tư theo tài khoản, thông báo, retention tự động và deploy Vercel thật.

## Nhật ký bằng chứng

| Ngày | Loại | Kết quả | Bằng chứng / giới hạn |
|---|---|---|---|
| 2026-10-15 | Unit | PASS — 16 tests trong 5 suites | Quy tắc mưa tham khảo, AI schema, profile, polyline và khoảng cách evidence; không chứng minh provider/cloud thật |
| 2026-10-15 | Unit/E2E/build | PASS — 22 unit tests, 7 E2E tests, production build | Gồm CSV injection guard, GeoJSON coordinates, cửa sổ tích lũy mưa, responsive mobile, clean-browser hydration, luồng nguồn chưa cấu hình, quy trình báo cáo mô phỏng và export config FloodLab; E2E dùng provider giả lập |
| 2026-10-15 | Provider smoke | Open-Meteo PASS; ORS/Valhalla NOT VERIFIED | Open-Meteo forecast trả HTTP 200; thiếu `ORS_API_KEY`; Valhalla bị fail-closed vì chưa cấu hình Upstash. DeepSeek không được gọi trong smoke |

