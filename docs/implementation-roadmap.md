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
| M1 — Nền tảng và demo | PASS ở source/build/E2E | Next.js, dashboard tiếng Việt, bản đồ OSM có attribution, chọn tọa độ/geolocation, Open-Meteo 48 giờ và tổng mưa 1/3/6/24 giờ, FloodPulse tham khảo, FloodLab 8 kịch bản cô lập; phạm vi tra cứu theo khung tọa độ Việt Nam; bảo vệ secret; ma trận 276 ý tưởng | lint/typecheck/27 unit/8 E2E pass + 1 environment skip/build; smoke Open-Meteo thật đạt |
| M2 — Dữ liệu thật và quyền | Source partial; cloud NOT VERIFIED | Supabase Auth, schema/RLS, tài khoản admin cấp, gửi/lịch sử báo cáo, rút báo cáo, moderation RPC optimistic version, sanitized public view, audit trigger. Upload ảnh an toàn chưa bật | migration contract tĩnh đạt; cần project Supabase thật và hai tài khoản để xác minh quyền |
| M3 — DeepSeek và đánh giá AI | Source partial; provider endpoint PASS; local UI E2E PASS (mock); hosted route E2E NOT VERIFIED | DeepSeek text adapter JSON+Zod, consent, Upstash per-user/global limit, prompt injection boundary. Vision chưa bật | schema/API guard tests, live provider evaluation trên bộ synthetic ứng viên và Playwright UI mock đã chạy; còn live quota/rate-limit và app E2E với Supabase/Upstash thật. Hai ca mơ hồ được gắn cờ, không tính điểm |
| M4 — Predict, Observe, Replan | Partial; provider NOT VERIFIED | ORS/Valhalla candidates theo mode, geometry map, TTL cache, đếm reports đã xem xét trong bán kính 50m. Chưa tính độ phủ dữ liệu/lệnh đóng đường; chưa có thời điểm xuất phát dự kiến | profile/polyline/evidence tests + E2E mock; ORS thiếu API key, Valhalla đang fail-closed do thiếu Upstash |
| M5 — Hoàn thiện và triển khai | Partial | CI, tài liệu tiếng Việt, PWA app-shell, lịch sử thành viên/hàng chờ moderator, export công khai CSV/GeoJSON; export riêng tư theo tài khoản/thông báo/deploy Supabase/Vercel chưa có | local CI-equivalent đạt; deployment URL, live DB và providers cần cấu hình thật |

## TODO phụ thuộc

1. [x] Khởi tạo Next.js App Router, TypeScript, Tailwind, Vitest, Playwright, CI và giữ `.env` local khỏi Git.
2. [x] Unit test quy tắc mưa, schema AI, profile, polyline và khoảng cách evidence.
3. [x] Dashboard, bản đồ, forecast, FloodLab 8 kịch bản local có replay/reset/export config, PWA app shell; local lint/typecheck/test/build/E2E đã chạy.
4. [x] Viết schema/RLS/moderation RPC; [ ] chạy Supabase thật, thử A/B và concurrent updates.
5. [x] Auth/report API/UI; [ ] xác minh workflow live trên Supabase.
6. [ ] Tích hợp upload ảnh riêng tư, validate magic bytes, resize/re-encode và chính sách xóa.
7. [x] DeepSeek text adapter opt-in và Zod; [x] live smoke 8 câu và benchmark 60 mẫu synthetic ứng viên theo lựa chọn hiện tại (58 ca được chấm, 2 ca mơ hồ không tính điểm); [ ] kiểm tra quota/rate-limit qua app thật; vision chưa bật. Bộ synthetic này chỉ đo mức khớp candidate, không thay thế nhãn chuyên gia nếu cần đánh giá độ chính xác thực tế.
8. [x] Upstash rate limits, fail-closed AI/routing, geometry cache.
9. [x] ORS/Valhalla profile, route alternatives và count evidence proximity; [ ] provider smoke tại Đồng Nai.
10. [x] FloodLab 8 kịch bản mô phỏng local, replay, reset và export config.
11. [x] Export CSV/GeoJSON từ view công khai đã lọc; [ ] export riêng tư theo tài khoản, thông báo, retention tự động và deploy Vercel thật.
12. [x] Tách màn hình theo module, thêm hướng dẫn ngay trong UI, sửa cách hiển thị đơn vị mưa, phân biệt chế độ mô phỏng/AI và mở khung tọa độ tra cứu.

## Nhật ký bằng chứng

| Ngày | Loại | Kết quả | Bằng chứng / giới hạn |
|---|---|---|---|
| 2026-10-15 | Unit | PASS — 16 tests trong 5 suites | Quy tắc mưa tham khảo, AI schema, profile, polyline và khoảng cách evidence; không chứng minh provider/cloud thật |
| 2026-10-15 | Unit/E2E/build | PASS — 22 unit tests, 7 E2E tests, production build | Gồm CSV injection guard, GeoJSON coordinates, cửa sổ tích lũy mưa, responsive mobile, clean-browser hydration, luồng nguồn chưa cấu hình, quy trình báo cáo mô phỏng và export config FloodLab; E2E dùng provider giả lập |
| 2026-10-15 | UI/API/unit/E2E/build | PASS — 27 unit tests, 9 E2E pass, 1 environment skip, production build | Sửa hydration do cache service worker cũ: dev tự gỡ worker/cache; production chuyển cache v2 và tải bundle network-first. Cùng đợt sửa UI mưa, parser DeepSeek + Zod, khung tọa độ Việt Nam, màn hình riêng, hướng dẫn, AI bị tắt trong mô phỏng. E2E dùng API mock; skip Supabase chưa cấu hình do local có Supabase. Provider AI/tuyến và cloud chưa xác minh |
| 2026-10-15 | Provider smoke | Open-Meteo PASS; ORS/Valhalla NOT VERIFIED | Open-Meteo forecast trả HTTP 200; thiếu `ORS_API_KEY`; Valhalla bị fail-closed vì chưa cấu hình Upstash. DeepSeek không được gọi trong smoke |
| 2026-10-16 | AI UI/provider verification | PASS — 10/10 focused tests, lint, typecheck, production build; live smoke 8/8; Playwright 13 pass/1 skip | Giao diện hiển thị tình trạng, nguồn, độ chắc chắn, thời gian/địa điểm được nhắc, chi tiết thiếu, câu hỏi và cảnh báo chưa xác minh; không tự sửa báo cáo. `.env` có `DEEPSEEK_MODEL=deepseek-v4-flash`, biến cấu hình hiện diện và `.env` được Git ignore. GET `/models` trả HTTP 200; smoke dùng prompt production và response model `deepseek-flash`, gồm ca phủ định/prompt injection. Playwright kiểm tra consent, request và hiển thị kết quả AI qua API mock; API test mô phỏng auth/Upstash. Local unauthenticated route smoke trả 401 trước inference. Chưa xác minh app E2E đăng nhập với Supabase/Upstash thật |
| 2026-10-16 | AI live candidate evaluation | PASS cho vòng đánh giá synthetic — v9: 58/58 scored candidates matched; 2 ambiguous cases excluded | Chạy đủ 60 request trực tiếp tới DeepSeek (trả model `deepseek-flash`): condition/sourceType/certainty/timePresent/placePresent đều khớp 58/58 mẫu được chấm; 2 ca đa nguồn/ảnh mơ hồ được gắn cờ và không tính điểm theo lựa chọn dùng bộ synthetic ứng viên. Đây là agreement với nhãn synthetic do dự án tạo, không phải độ chính xác thực tế, và không đi qua route/auth/consent/Upstash. App E2E và quota/rate-limit thật còn mở |

