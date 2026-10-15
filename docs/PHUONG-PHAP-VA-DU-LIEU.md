# Phương pháp, AI và nguồn dữ liệu

## Trạng thái dữ liệu

- **Forecast**: output mô hình Open-Meteo tại tọa độ truy vấn, có giờ nhận; không phải quan trắc đường.
- **Report**: nội dung thành viên gửi; trạng thái chờ, cần bổ sung, đã xem xét, chưa đủ chứng cứ, từ chối, rút hoặc đóng.
- **Team reviewed**: thành viên có vai trò moderator đã kiểm tra và ghi lý do. Không đồng nghĩa xác minh của cơ quan nhà nước.
- **Official source**: chỉ dùng khi có nguồn chính thức, phạm vi, thời hạn và đường dẫn lưu được; migration hiện chưa cho moderator tự gắn cấp này.
- **Simulation**: chỉ phía FloodLab trong phiên trình duyệt; không ghi vào bảng reports, không gửi thông báo.
- **Unknown/stale/error**: nguồn thiếu, cũ hoặc lỗi hiển thị riêng; không tự thay thế bằng số demo.

## FloodPulse rule v1

`src/lib/flood/risk.ts` kiểm tra lượng mưa hợp lệ rồi tạo tín hiệu chú ý mưa: mốc thử nghiệm 25mm/1h hoặc 30mm/3h. Khi input chỉ có forecast, output ghi `source=forecast`; khi không có mẫu, `insufficient_data`. Đây là ngưỡng demo chưa hiệu chuẩn với nhãn ngập địa phương, không phải xác suất/ngưỡng cảnh báo thiên tai và không có ý nghĩa “không mưa = an toàn”. Mỗi kết quả mang `ruleVersion=rain-reference-v1`.

## DeepSeek

LLM có thể phân loại câu chữ, giữ lời phủ định/lời kể gián tiếp, tóm tắt trung lập và hỏi phần thiếu. Zod loại mọi đầu ra ngoài schema. Model không tự tạo tọa độ, độ sâu nước, xác suất ngập, an toàn tuyến, quyền moderator hoặc lệnh công bố. Kết quả phải được người dùng sửa/duyệt và còn là gợi ý AI chưa xác minh.

LLM không gom/phát hiện trùng bằng embedding trong bản hiện tại; API endpoint chỉ xử lý mô tả đã opt-in, không gửi ảnh. Không công bố độ chính xác cho đến khi có bộ dữ liệu gán nhãn bởi con người.

## GIS và tuyến đường

WGS84 `[longitude, latitude]`, timestamp lưu ISO UTC, giao diện hiển thị `Asia/Ho_Chi_Minh`. Bản đồ dùng tile OSM với attribution. Bản đồ hiện chưa tải ranh giới hành chính có license/phiên bản; vùng API hiện là bounding box xấp xỉ để giới hạn tra cứu, không phải ranh giới pháp lý tỉnh sau hợp nhất.

Endpoint định tuyến chọn ORS `driving-car` / `foot-walking`, Valhalla `motor_scooter`; nhận tối đa ba tuyến ORS hoặc route alternates Valhalla khi provider trả về. Mỗi tuyến được đối chiếu với báo cáo `reviewed` còn hiệu lực trong view công khai, tính số ID báo cáo cách polyline ≤50m. Đây là số lượng bằng chứng đã công bố gần tuyến, không phải xác suất/nguy cơ ngập. Không có báo cáo gần tuyến không đồng nghĩa an toàn. Chưa có lớp độ phủ dữ liệu, thời gian đi qua từng đoạn hoặc hạn chế đường chính thức; không tự chọn tuyến an toàn.

## Nguồn và điều khoản cần kiểm tra

- Open-Meteo API/docs: https://open-meteo.com/en/docs và terms/pricing: https://open-meteo.com/en/pricing. Free tier phi thương mại, không SLA; xác nhận điều khoản trước deploy/scale.
- OpenStreetMap copyright: https://www.openstreetmap.org/copyright; tile policy: https://operations.osmfoundation.org/policies/tiles/.
- OpenRouteService API/restrictions: https://openrouteservice.org/restrictions/.
- Valhalla API: https://valhalla.github.io/valhalla/api/route/api-reference/; shared public endpoints là best-effort/fair-use.
- DeepSeek model docs: https://api-docs.deepseek.com/quick_start/pricing/; vision guide: https://api-docs.deepseek.com/guides/vision/.

Trước khi công bố, lưu ngày truy cập, điều khoản, attribution, phiên bản GIS và bằng chứng smoke test vào nhật ký triển khai. Không scrape dữ liệu mạng xã hội, không lấy ảnh không có quyền sử dụng, và không tự gắn nhãn official cho nguồn cộng đồng.
