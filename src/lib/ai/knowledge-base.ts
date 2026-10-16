export type KnowledgeChunk = {
  id: string;
  title: string;
  source: string;
  content: string;
};

export function isCurrentFloodStatusQuestion(question: string) {
  const normalizedQuestion = question.toLocaleLowerCase("vi-VN").replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /\b(hien|bay gio|hom nay|luc nay|dang)\b/.test(normalizedQuestion)
    && /\b(ngap|mua|nuoc|duong|tuyen|luong|an toan|du bao)\b/.test(normalizedQuestion);
}

const knowledge: KnowledgeChunk[] = [
  {
    id: "ai-report-help",
    title: "AI hỗ trợ viết phản ánh",
    source: "Tài liệu AI · docs/AI.md",
    content: "AI phân tích phần mô tả do người gửi nhập để gợi ý tình trạng, nguồn thông tin, mức chắc chắn theo lời kể, thời gian và địa điểm được nhắc, chi tiết còn thiếu và câu hỏi bổ sung. Người dùng cần đăng nhập, tự bật consent và bấm nút. Kết quả là gợi ý chưa xác minh; người gửi phải tự rà soát và có thể gửi phản ánh thủ công khi không dùng AI.",
  },
  {
    id: "ai-report-limits",
    title: "Giới hạn của AI",
    source: "docs/PHUONG-PHAP-VA-DU-LIEU.md · DeepSeek",
    content: "AI không xác minh sự việc hoặc vị trí, không suy ra tọa độ, độ sâu nước hay xác suất ngập, không xác nhận tuyến an toàn, không duyệt báo cáo, không cấp quyền moderator và không phát cảnh báo hoặc lệnh đóng đường. Nhãn certainty mô tả mức chắc chắn trong lời kể, không phải xác suất sự kiện đúng. Ảnh phản ánh hiện chỉ xem trước trên thiết bị và không gửi tới AI.",
  },
  {
    id: "floodpulse-help",
    title: "FloodPulse và dữ liệu mưa",
    source: "Hướng dẫn giao diện · FloodPulse",
    content: "FloodPulse hiển thị dự báo mưa Open-Meteo theo vị trí và thời điểm truy vấn, gồm tổng mưa các cửa sổ thời gian. Dự báo mưa không phải quan trắc tại đường, không chứng minh đang ngập và không phải cảnh báo thiên tai chính thức. Thiếu dữ liệu không đồng nghĩa an toàn.",
  },
  {
    id: "floodpath-help",
    title: "FloodPath và tuyến ứng viên",
    source: "Hướng dẫn giao diện · FloodPath",
    content: "FloodPath so sánh các tuyến ứng viên do provider trả về theo điểm đầu, điểm cuối và phương tiện. Tuyến hiển thị không được xác nhận an toàn hoặc tránh ngập. Số báo cáo đã xem xét gần tuyến chỉ là số lượng bằng chứng công khai; không có báo cáo gần tuyến không đồng nghĩa tuyến an toàn. Dự án chưa có lớp đóng đường chính thức.",
  },
  {
    id: "floodlab-help",
    title: "FloodLab là mô phỏng",
    source: "Hướng dẫn giao diện · FloodLab",
    content: "FloodLab chạy các kịch bản giả lập trong trình duyệt. Thay đổi trong FloodLab không ghi database, không gọi AI, thời tiết, tuyến API, không gửi thông báo và không tác động định tuyến thật. Không dùng kết quả mô phỏng để quyết định di chuyển.",
  },
  {
    id: "report-review-help",
    title: "Báo cáo và kiểm duyệt",
    source: "Hướng dẫn giao diện · FloodReport và FloodCommand",
    content: "Phản ánh cần được moderator xem xét trước khi xuất hiện công khai. FloodCommand hiện là hàng chờ kiểm duyệt, chưa điều phối cứu hộ, phát thông báo hay ra lệnh đóng đường. Báo cáo cộng đồng chưa được kiểm duyệt không nên xem như nguồn chính thức.",
  },
];

const stopWords = new Set([
  "va", "la", "gi", "the", "nao", "co", "khong", "duoc", "toi", "cho", "cua", "tren", "duoi", "mot", "nhung", "voi", "ve", "hay", "o", "khi", "thi", "se", "dang", "giup", "can", "muon", "nhieu", "tai", "sao", "theo", "tu", "den", "nay", "do", "khac", "nen", "phai", "lam", "du", "lieu", "floodtwin",
]);

function tokens(value: string) {
  return value
    .toLocaleLowerCase("vi-VN")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 1 && !stopWords.has(token)) ?? [];
}

export function retrieveKnowledge(question: string, limit = 3): KnowledgeChunk[] {
  const normalizedQuestion = question.toLocaleLowerCase("vi-VN").replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const productNames = /\b(floodtwin|floodpulse|floodpath|floodreport|floodcommand|floodlab|app|ung dung|tro ly)\b/;
  const productTopics = /\b(ai|anh|bao cao|du bao|mua|tuyen|mo phong|moderator|nguon du lieu|xac suat|chac chan|xac minh)\b/;
  const currentStatusQuestion = isCurrentFloodStatusQuestion(question);
  if (currentStatusQuestion && !productNames.test(normalizedQuestion) && !/\bai\b/.test(normalizedQuestion)) return [];
  if (!productNames.test(normalizedQuestion) && !productTopics.test(normalizedQuestion)) return [];

  const queryTokens = [...new Set(tokens(question))];
  if (queryTokens.length === 0) return [];

  return knowledge
    .map((chunk) => {
      const contentTokens = new Set(tokens(`${chunk.title} ${chunk.content}`));
      const score = queryTokens.reduce((total, token) => total + (contentTokens.has(token) ? 1 : 0), 0);
      return { chunk, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk }) => chunk);
}
