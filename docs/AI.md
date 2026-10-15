# Tính năng AI: đã làm, có thể mở rộng và chưa bật

Ứng dụng gọi DeepSeek ở server qua `DEEPSEEK_MODEL` trong `.env`. API key hiện chỉ được kiểm tra là có cấu hình, không được in ra tài liệu/log. Mẫu môi trường dùng `deepseek-v4-flash`. Phản hồi provider chưa được gọi trong lượt xác minh này vì yêu cầu phải có phiên Supabase đã đăng nhập, consent theo từng mô tả và Upstash để giới hạn chi phí.

| Năng lực | Trạng thái | Dữ liệu vào/ra | Hàng rào |
|---|---|---|---|
| Hiểu phản ánh tiếng Việt | Đã triển khai ở source | Mô tả do thành viên nhập → loại tình trạng, firsthand/hearsay, mức chắc chắn, thời điểm/địa danh được nhắc, chi tiết thiếu, câu hỏi bổ sung, tóm tắt trung lập | Chỉ gọi sau đăng nhập, đồng ý và bấm nút; Zod kiểm tra JSON; người gửi sửa trước khi gửi; không suy ra tọa độ/độ sâu/xác suất/an toàn tuyến |
| Hiểu phủ định và lời kể gián tiếp | Trong prompt/schema, chưa có đánh giá gán nhãn | Văn bản như “không ngập”, “nghe nói”, “ảnh hôm qua” | Khả năng được mô tả trong chỉ dẫn model không phải bằng chứng độ chính xác; cần bộ test ≥60 mẫu do người gán nhãn |
| Phân tích ảnh | Chưa bật | Cần ảnh có quyền sử dụng, upload riêng tư, kiểm tra magic bytes, giải mã/re-encode bỏ metadata và xác minh model hỗ trợ vision | Form chỉ preview cục bộ; ảnh không gửi lên server/LLM; không tuyên bố phân loại ảnh |
| Gom báo cáo trùng | Chưa bật | Có thể dùng hash ảnh, khoảng cách/timestamp và so sánh văn bản để tạo ứng viên | LLM không quyết định gộp; moderator phải xác nhận; cần kiểm thử dữ liệu trùng và sai trùng |
| Phát hiện mâu thuẫn/tóm tắt sự kiện | Chưa bật | Có thể tổng hợp các báo cáo đã được quyền đọc, kèm ID và timestamp | Tách quan sát khác thời điểm khỏi mâu thuẫn; mọi kết luận cần liên kết chứng cứ; không tạo “sự thật hiện tại” từ lời kể |
| Hỏi đáp có nguồn, soạn bản tin | Chưa bật | Có thể truy xuất từ public view/bản tin chính thức cho người dùng; moderator có thể nhận bản nháp | Không crawler; không đọc dữ liệu riêng trái quyền; chỉ người có quyền công bố; nguồn chính thức phải được nhập và dẫn link |
| Quyết định duyệt, cấp quyền, đóng đường, cảnh báo | Không giao cho AI | Hành động nghiệp vụ được server/RLS/RPC và người có quyền xử lý | Model không có tools/quyền database/credential; không tự phát lệnh hoặc cảnh báo |

## Cách kiểm tra luồng AI hiện có

1. Cấu hình Supabase và tạo tài khoản member theo [`SUPABASE.md`](SUPABASE.md).
2. Cấu hình Upstash và `DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL` theo [`PROVIDERS.md`](PROVIDERS.md). Không chia sẻ key trong issue, ảnh chụp hoặc log.
3. Khởi chạy app, đăng nhập, mở **Gửi phản ánh**, nhập văn bản thử nghiệm không chứa thông tin cá nhân thật.
4. Bật riêng checkbox đồng ý gửi mô tả cho AI, bấm **Phân tích mô tả bằng AI**, kiểm tra JSON hợp lệ và trường `requestedModel`/`returnedModel` trong phản hồi.
5. Thử câu phủ định/lời nghe kể/ảnh cũ, sửa gợi ý và gửi thủ công; khi AI/Redis lỗi, xác nhận biểu mẫu vẫn cho gửi không cần AI.
6. Kiểm tra giới hạn 20 lượt/tài khoản/ngày và 200 lượt/toàn ứng dụng/ngày. Không chạy lặp test live vì có thể tiêu quota/tính phí.

Hiện unit test kiểm tra schema và mẫu giả, chưa phải benchmark model thật. Trước khi dùng kết quả để ra quyết định, cần tạo bộ tối thiểu 60 câu có nhãn người kiểm tra, công bố precision/recall theo từng nhãn, lỗi phủ định/thời gian, và đánh giá riêng model/phiên bản đang trả về.
