# Open data, AI và định tuyến

## Open-Meteo

Ứng dụng gọi API qua `/api/weather`, giới hạn tọa độ theo khung tra cứu xấp xỉ quanh Đồng Nai, đặt cache 15 phút và chỉ trả dữ liệu đã kiểm tra schema. Lượng mưa theo giờ là dự báo mô hình; trường `current` cũng là ước tính mô hình, không phải thiết bị quan trắc tại đường. Không hiển thị thành bản đồ độ sâu hoặc xác suất ngập. Miễn phí chỉ cho mục đích phi thương mại và không SLA; kiểm tra điều khoản hiện hành trước khi vận hành rộng.

## DeepSeek

Điền `DEEPSEEK_API_KEY` và giữ `DEEPSEEK_MODEL=deepseek-v4-flash` trong `.env` server. Theo bảng model hiện hành, đây là alias legacy vẫn được nhận nhưng đã retired; DeepSeek định tuyến request sang V4.1 Flash theo giá Flash. API dùng Chat Completions JSON mode, đầu ra Zod và token cap. AI chỉ phân tích phần mô tả văn bản khi người dùng đăng nhập, bật checkbox đồng ý và bấm **Phân tích mô tả bằng AI**. Nội dung là dữ liệu không tin cậy; không gọi tool, không có quyền kiểm duyệt, và người gửi phải xem/sửa kết quả. Nếu DeepSeek/Redis lỗi, người dùng có thể gửi thủ công.

Đặt Upstash trước khi bật gọi AI: thiếu Redis hoặc không xác thực được limit sẽ khóa endpoint để tránh gọi provider không giới hạn. Hạn mức hiện tại: 20/người/ngày và 200/toàn app/ngày. Vision chưa bật; tên model và API key không chứng minh khả năng ảnh, cần smoke test riêng trước khi triển khai.

## OpenRouteService (xe hơi/đi bộ)

Điền `ORS_API_KEY`. Server map `car → driving-car`, `walking → foot-walking`; key không gửi về browser. Endpoint yêu cầu tối đa ba tuyến ứng viên, cache geometry 30 phút rồi đọc lại reports đã công bố mỗi lần đối chiếu. ORS public service áp dụng quota và giới hạn các capability; nếu không có phương án thay thế thì chỉ hiển thị những gì provider trả. Đây không phải lộ trình an toàn hay lựa chọn tránh ngập.

## Valhalla (xe máy)

`motorbike → motor_scooter`; đặt `VALHALLA_BASE_URL` nếu tự vận hành endpoint. Yêu cầu tối đa hai tuyến thay thế; provider có thể trả ít hơn hoặc không có thay thế. Mặc định là máy chủ cộng đồng để demo; cài Upstash để toàn ứng dụng giới hạn tối đa một yêu cầu/giây và cache geometry 30 phút. Khi Redis hoặc provider lỗi, API trả lỗi thay vì chuyển lặng lẽ sang xe hơi. Endpoint cộng đồng có thể thay đổi, hạn mức fair-use và không có SLA. Smoke test thực tại Đồng Nai là điều kiện trước khi tuyên bố tính năng xe máy đã hoạt động. Tài liệu: https://valhalla.github.io/valhalla/api/route/api-reference/.

## Upstash

1. Tạo Redis database ở region gần Vercel.
2. Sao chép REST URL/token vào `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN`.
3. Không dùng token trong code phía client; chỉ API server đọc biến.
4. Thiếu cấu hình Redis thì AI và Valhalla trả 503. Kiểm tra quota trên dashboard nhà cung cấp.

## OpenStreetMap

Tile OSM standard chỉ được lấy khi người xem mở vùng bản đồ, attribution luôn hiện. Không scrape/bulk download, không tạo offline tile cache. Offline PWA chưa được bật.

## Biến môi trường

| Biến | Nơi dùng | Bắt buộc để |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/server | Auth, lưu báo cáo |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Tra username khi đăng nhập; không đưa vào browser |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` | Server | AI văn bản |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Server | AI/Valhalla rate limit |
| `ORS_API_KEY`, `ORS_BASE_URL` | Server | tuyến xe hơi/đi bộ |
| `VALHALLA_BASE_URL` | Server | tuyến xe máy |

`.env.example` là mẫu không chứa credential. `.env` và `.env.*` được ignore bởi Git.
