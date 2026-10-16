# Tính năng AI: đã làm, có thể mở rộng và chưa bật

Ứng dụng gọi duy nhất DeepSeek ở server qua `DEEPSEEK_MODEL` trong `.env`; cấu hình hiện tại là `deepseek-v4-flash`. Key được giữ phía server và không ghi vào tài liệu/log; GET `/models` đã trả HTTP 200 khi dùng key cấu hình. Theo [tài liệu model DeepSeek](https://api-docs.deepseek.com/news/news260910/), alias này vẫn được nhận tạm thời và được định tuyến tới V4.1 Flash theo giá Flash; model ID hiện hành được khuyến nghị là `deepseek-flash`. Giữ alias `deepseek-v4-flash` theo cấu hình project, nhưng cần đổi có chủ ý trước khi DeepSeek ngừng hỗ trợ alias tương thích.

Ngày 2026-10-16, live benchmark 60 mẫu synthetic phiên bản 9 khớp **58/58 ca được chấm** với DeepSeek; condition, sourceType, certainty, thời gian và vị trí đều khớp 58/58. Hai ca chạy nhưng không đưa vào điểm vì nhãn nguồn cần người duyệt (ảnh không rõ nguồn; một phản ánh gộp nguồn firsthand và hearsay mâu thuẫn). Response model là `deepseek-flash`. Đây chỉ là tỷ lệ khớp với nhãn ứng viên do dự án tạo, chưa được chuyên gia độc lập duyệt, nên không phải độ chính xác thực tế. Kết quả không chứng minh chất lượng trên báo cáo thực, nhiều địa phương/cách diễn đạt, hay app route/auth/consent/Upstash E2E. GET `/models` trước đó trả HTTP 200; smoke 8 câu với prompt cuối cũng khớp 8/8 theo rubric, gồm phủ định và prompt injection. Tệp [`ai-evaluation-candidates.json`](ai-evaluation-candidates.json) ghi trạng thái nhãn, gồm hai ca bị loại khỏi điểm. Tái chạy: `npm run evaluate:ai -- --live` (60 request có thể tính phí/quota) hoặc `npm run smoke:ai -- --live` (8 request). Cả hai script gọi provider trực tiếp, không đi qua auth, consent hay Upstash của app. Kịch bản E2E tổng thể nằm ở [`DEMO-SCRIPT-ALL-FEATURES.md`](DEMO-SCRIPT-ALL-FEATURES.md).

| Năng lực | Trạng thái | Dữ liệu vào/ra | Hàng rào |
|---|---|---|---|
| Hiểu phản ánh tiếng Việt | Đã triển khai ở source | Mô tả do thành viên nhập → loại tình trạng, firsthand/hearsay, mức chắc chắn, thời điểm/địa danh được nhắc, chi tiết thiếu, câu hỏi bổ sung, tóm tắt trung lập | Chỉ gọi sau đăng nhập, đồng ý và bấm nút; Zod kiểm tra JSON; giao diện hiển thị mọi trường gợi ý kèm nhãn chưa xác minh; người gửi vẫn tự rà soát báo cáo; không suy ra tọa độ/độ sâu/xác suất/an toàn tuyến |
| Hiểu phủ định, lời kể gián tiếp và thời gian | Prompt đã làm rõ; đánh giá candidate khớp 58/58 ca được chấm, 2 ca cần duyệt nhãn | Văn bản như “không ngập”, “nghe nói”, “ảnh hôm qua”, “vừa/đang” | Tỷ lệ khớp synthetic không phải độ chính xác; cần chuyên gia duyệt nhãn và test lại |
| Phân tích ảnh | Chưa bật | Cần ảnh có quyền sử dụng, upload riêng tư, kiểm tra magic bytes, giải mã/re-encode bỏ metadata và xác minh model hỗ trợ vision | Form chỉ preview cục bộ; ảnh không gửi lên server/LLM; không tuyên bố phân loại ảnh |
| Gom báo cáo trùng | Chưa bật | Có thể dùng hash ảnh, khoảng cách/timestamp và so sánh văn bản để tạo ứng viên | LLM không quyết định gộp; moderator phải xác nhận; cần kiểm thử dữ liệu trùng và sai trùng |
| Phát hiện mâu thuẫn/tóm tắt sự kiện | Chưa bật | Có thể tổng hợp các báo cáo đã được quyền đọc, kèm ID và timestamp | Tách quan sát khác thời điểm khỏi mâu thuẫn; mọi kết luận cần liên kết chứng cứ; không tạo “sự thật hiện tại” từ lời kể |
| Hỏi đáp có nguồn, soạn bản tin | Chưa bật | Có thể truy xuất từ public view/bản tin chính thức cho người dùng; moderator có thể nhận bản nháp | Không crawler; không đọc dữ liệu riêng trái quyền; chỉ người có quyền công bố; nguồn chính thức phải được nhập và dẫn link |
| Quyết định duyệt, cấp quyền, đóng đường, cảnh báo | Không giao cho AI | Hành động nghiệp vụ được server/RLS/RPC và người có quyền xử lý | Model không có tools/quyền database/credential; không tự phát lệnh hoặc cảnh báo |

Trong prompt, `certainty` là mức chắc chắn của thông tin theo báo cáo: chỉ gắn `certain` khi người gửi trực tiếp quan sát và mô tả rõ; lời kể gián tiếp hoặc câu có từ ngữ dè dặt nhận `uncertain`; thiếu căn cứ nhận `unknown`. Nhãn này không phải xác suất đúng của sự việc.

## Đề xuất phạm vi

Chưa nên thêm LangChain/RAG vào luồng hiện tại: trích xuất tình trạng từ một mô tả người dùng không cần kho tri thức, còn repo chưa có tập nguồn chính thức đã tuyển chọn và cập nhật. RAG với báo cáo cộng đồng chưa kiểm duyệt có thể khiến chatbot nói lại tin đồn như dữ kiện. Nếu sau này có kho bản tin chính thức, có thể làm hỏi đáp đơn giản chỉ truy xuất tài liệu đã duyệt, trả link/thời điểm nguồn và từ chối trả lời khi không có đoạn chứng cứ; vẫn gọi cùng DeepSeek và không cấp quyền hành động.

## Cách kiểm tra luồng AI hiện có

1. Cấu hình Supabase và tạo tài khoản member theo [`SUPABASE.md`](SUPABASE.md).
2. Cấu hình Upstash và `DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL` theo [`PROVIDERS.md`](PROVIDERS.md). Không chia sẻ key trong issue, ảnh chụp hoặc log.
3. Khởi chạy app, đăng nhập, mở **Gửi phản ánh**, nhập văn bản thử nghiệm không chứa thông tin cá nhân thật.
4. Bật riêng checkbox đồng ý gửi mô tả cho AI, bấm **Phân tích mô tả bằng AI**, kiểm tra JSON hợp lệ và trường `requestedModel`/`returnedModel` trong phản hồi.
5. Thử câu phủ định/lời nghe kể/ảnh cũ, sửa gợi ý và gửi thủ công; khi AI/Redis lỗi, xác nhận biểu mẫu vẫn cho gửi không cần AI.
6. Kiểm tra giới hạn 20 lượt/tài khoản/ngày và 200 lượt/toàn ứng dụng/ngày. Không chạy lặp test live vì có thể tiêu quota/tính phí.

Unit test kiểm tra schema và phản hồi giả lập; live provider smoke/benchmark đã chạy nhưng bộ 60 nhãn hiện tại là synthetic candidate, chưa được chuyên gia duyệt. Trước khi dùng AI trong quyết định nghiệp vụ, cần rà soát nhãn độc lập, bổ sung lỗi biên thực tế và tính precision/recall theo nhãn trên bộ đã duyệt. Cần kiểm tra riêng model/phiên bản đang trả về; live provider script chưa xác minh auth, consent, Upstash quota hoặc route app end-to-end.
