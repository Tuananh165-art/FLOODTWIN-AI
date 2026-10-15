# Kịch bản demo và kiểm tra FloodTwin AI

> Chạy trên môi trường local/test. Phần AI gửi mô tả tới DeepSeek; chỉ dùng câu thử không có dữ liệu cá nhân. Dự báo, tuyến và báo cáo là dữ liệu tham khảo, không phải cảnh báo hoặc chỉ dẫn an toàn.

## 1. Chuẩn bị một lần

1. Cài Node.js theo `package.json`, chạy `npm install`.
2. Điền `.env` bằng Supabase URL + anon key, server-only service role key, DeepSeek key/model, Upstash, ORS và Valhalla nếu muốn thử routing thật. Không chụp/chia sẻ giá trị bí mật.
3. Trong Supabase SQL Editor:
   - Project mới: chạy `supabase/migrations/202610150001_core.sql`, sau đó `202610150002_usernames.sql`.
   - Project đã có core schema: chỉ chạy `202610150002_usernames.sql`.
   - Không chạy lại migration core. Kiểm tra xác nhận email/SMTP theo môi trường.
4. Khởi chạy `npm run dev`. Mở URL in ra terminal (có thể là port 3001 nếu 3000 đang bận). Nếu browser còn service worker/cache từ bản cũ, hard reload; nếu mismatch lặp lại, xóa Site data riêng cho origin local đang dùng.
5. Kiểm tra `npm run verify:db`, `npm run lint`, `npm run typecheck`, `npm run test`.

## 2. Đăng ký, đăng nhập, đăng xuất

1. Mở nút tài khoản → **Đăng ký**; nhập username 3–24 ký tự chữ/số/`_`, email có thể nhận thư và mật khẩu ít nhất 10 ký tự.
2. Nếu Supabase yêu cầu xác nhận email, xác nhận thư rồi đăng nhập. Nếu môi trường demo tắt xác nhận, phiên sẽ được tạo ngay.
3. Đăng xuất rồi đăng nhập bằng username + mật khẩu; thử thêm đăng nhập bằng email.
4. `GET /api/auth/session`: phiên mới phải có role `member`. Không cần admin tạo user/gán role. Member dùng AI và tính năng thành viên; `GET /api/moderation/queue` vẫn phải nhận 403.
5. Thử username trùng/mật khẩu ngắn; form/API phải từ chối. `user_profiles` không được đọc trực tiếp bằng anon/authenticated.

## 3. Tổng quan và nguồn dữ liệu

1. **Tổng Quan**: chờ Open-Meteo tải; xem nguồn, thời điểm, đơn vị mm và ghi chú dự báo. Đây là ước tính mô hình, không phải trạm đo tại đường.
2. Chọn **TP. Hồ Chí Minh** rồi **Toàn Việt Nam** trong vùng làm việc; xác nhận tâm bản đồ/toạ độ tra cứu đổi theo vùng. Workspace không đồng nghĩa dữ liệu địa phương đã được xác minh.
3. Mở **Nguồn dữ liệu**; kiểm tra provider, phạm vi, cách diễn giải và giới hạn. Thử provider lỗi nếu cần xác nhận UI không coi dữ liệu cũ là mới.

## 4. FloodPulse và FloodPath

1. **FloodPulse**: đổi vị trí trên bản đồ và quan sát API thời tiết theo tọa độ. Xem tổng mưa tích lũy 1/3/6/24 giờ và mức tham khảo; đây không phải cảnh báo chính thức.
2. **FloodPath**: nhập hai tọa độ A/B trong phạm vi Việt Nam, chọn xe máy/ô tô/đi bộ, bấm tìm tuyến. Kiểm tra provider, profile, km/phút và số báo cáo đã duyệt gần tuyến. Kết quả chỉ là tuyến provider; không chứng minh tuyến tránh ngập/an toàn.
3. Khi provider/rate limit lỗi, ghi nhận status; không đổi âm thầm sang profile/phương tiện khác.

## 5. Báo cáo hiện trường và FloodCommand

1. **Gửi phản ánh**: nhập quan sát, thời điểm, vị trí; bật đồng ý công khai nếu muốn gửi thật. Bản gửi thật cần login và lưu trạng thái chờ xem xét.
2. Ảnh ở phiên bản này chỉ preview trên thiết bị; không upload hoặc gửi cho AI.
3. Vào **Báo cáo hiện trường**: member xem phản ánh của mình, làm mới và rút phản ánh còn chờ; dữ liệu công khai chỉ hiện sau moderator duyệt và soạn tóm tắt.
4. Với moderator được cấp riêng, mở hàng chờ, yêu cầu bổ sung/duyệt nội bộ. Member mới không có quyền moderator. CSV/GeoJSON chỉ chứa trường công khai đã lọc.
5. Chuông thông báo hiện chỉ mở panel giải thích rằng thông báo tự động chưa kết nối; không gửi push/email/SMS.

## 6. FloodLab

1. Chọn **FloodLab**, mở từng tình huống trong 8 kịch bản, phát/tạm dừng và đặt lại.
2. FloodLab không mở form gửi phản ánh. Thử từng kịch bản rồi xác nhận chỉ trạng thái mô phỏng trong trình duyệt đổi; không có request `/api/reports`, `/api/ai/analyze-report`, insert database hay thông báo thật.
3. Xuất JSON nếu cần lưu kịch bản. Không dùng mô phỏng làm quan trắc hoặc căn cứ đi lại.

## 7. Phân tích AI bằng DeepSeek

1. Đăng nhập member. Mở **Gửi phản ánh**, nhập câu thử: `Tôi nghe người dân nói đoạn đường gần chợ có nước đọng từ tối qua; hiện chưa tự xác nhận.`
2. Bật checkbox đồng ý gửi mô tả, bấm **Phân tích mô tả bằng AI**. Chờ tối đa khoảng 15 giây. Thành công khi nhận HTTP 200, có tóm tắt trung lập, nhãn nguồn/độ chắc chắn và câu hỏi bổ sung nếu thiếu dữ kiện.
3. Kiểm tra `user_text`, hearsay/uncertainty, chi tiết thiếu và câu hỏi trung lập. Sửa gợi ý trước khi gửi; AI không xác minh sự thật, không suy ra độ sâu/toạ độ/xác suất/an toàn đường.
4. Trong Network xem `requestedModel`/`returnedModel` và status; không sao chép Authorization header. Cấu hình giữ alias tương thích `deepseek-v4-flash`; DeepSeek hiện ghi alias này đã retired và request được định tuyến tới V4.1 Flash theo giá Flash. App chỉ gọi DeepSeek Chat Completions JSON mode; không có nhà cung cấp dự phòng.
5. Nếu có lỗi 502/503/504, ghi lại `code`/`requestId` để đối chiếu log server; log không chứa mô tả người dùng hoặc API key. `output_truncated` nghĩa là provider hết ngân sách trước khi tạo JSON; endpoint hiện tắt chế độ suy luận cho tác vụ trích xuất để dành ngân sách cho kết quả cấu trúc.
6. Thử phủ định (`không ngập`), thông tin cũ (`ảnh hôm qua`), địa danh mơ hồ và prompt injection. Kết quả chưa đủ trường được điền bằng giá trị an toàn như `unknown`/`unclear`; người dùng vẫn phải rà soát. Nếu AI/Redis hỏng, bỏ consent và gửi thủ công.
7. Tài khoản mới dùng AI khi có session, Redis quota hoạt động, DeepSeek key/model hợp lệ và người dùng đồng ý. Hạn mức hiện tại: 20 lượt/user/ngày, 200 lượt toàn app/ngày.

## 8. Lưu bằng chứng

- Lưu ảnh UI/response status đã lọc dữ liệu cá nhân. Không lưu API key, cookie, report thật hoặc Authorization header.
- Phân loại **PASS** (đã chạy thật, ghi rõ môi trường), **SOURCE/CHECK** (static/unit/mock), **SKIP** (provider không cấu hình), **BLOCKED** (Supabase/SMTP/provider/quota ngoài local).
- Unit test và `verify:db` không chứng minh provider live. Một response AI thành công cũng không chứng minh độ chính xác; cần tập mẫu được người gán nhãn để đánh giá.
- Không chạy lặp AI live vô ý: request thật có thể tiêu quota/chi phí. Không dùng app làm công cụ cảnh báo thiên tai hay tư vấn tuyến an toàn.
