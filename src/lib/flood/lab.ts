export const floodLabScenarios = [
  { id: "rain_rises", label: "Mưa tăng", description: "Tín hiệu mưa mô phỏng tăng trong cửa sổ ba giờ.", rainMm: 24, signal: "Dự báo mưa mô phỏng tăng; chưa phải bằng chứng ngập." },
  { id: "new_report", label: "Phản ánh mới", description: "Thêm một phản ánh giả lập để xem lớp bằng chứng thay đổi.", rainMm: 24, signal: "Có một phản ánh mô phỏng mới, chờ người xem xét." },
  { id: "old_photo", label: "Ảnh cũ", description: "Kiểm tra cách giữ riêng thời điểm ảnh và thời điểm hiện tại.", rainMm: 24, signal: "Ảnh giả lập có thời điểm cũ; không đại diện tình trạng hiện tại." },
  { id: "duplicate_burst", label: "Trùng hàng loạt", description: "Nhiều phản ánh tương tự được gom thành ứng viên trùng.", rainMm: 24, signal: "Các mục mô phỏng có thể trùng; cần người kiểm duyệt xác nhận." },
  { id: "source_outage", label: "Nguồn lỗi", description: "Một nguồn giả lập mất kết nối, các nguồn khác giữ trạng thái riêng.", rainMm: 24, signal: "Một nguồn mô phỏng gián đoạn; không thay bằng dữ liệu giả." },
  { id: "conflicting_reports", label: "Mâu thuẫn", description: "Hai quan sát giả lập đưa ra tình trạng khác nhau.", rainMm: 24, signal: "Thông tin mô phỏng mâu thuẫn; cần xem thời gian và vị trí." },
  { id: "road_closure", label: "Đóng đường", description: "Tạo ràng buộc đóng đường mô phỏng để minh họa xử lý.", rainMm: 24, signal: "Đóng đường chỉ là giả lập, không gửi vào nhà cung cấp tuyến." },
  { id: "retract_decision", label: "Rút quyết định", description: "Một quyết định giả lập được rút để xem trước/sau.", rainMm: 24, signal: "Quyết định mô phỏng đã rút; dữ liệu thật không bị thay đổi." },
] as const;

export type FloodLabScenario = (typeof floodLabScenarios)[number];

export function getFloodLabScenario(id: string): FloodLabScenario {
  return floodLabScenarios.find((scenario) => scenario.id === id) ?? floodLabScenarios[0];
}
