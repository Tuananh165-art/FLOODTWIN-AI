import { describe, expect, it } from "vitest";
import { isCurrentFloodStatusQuestion, retrieveKnowledge } from "./knowledge-base";

describe("retrieveKnowledge", () => {
  it("retrieves relevant FloodPath guidance for Vietnamese questions", () => {
    expect(retrieveKnowledge("Tuyến FloodPath có an toàn khi ngập không?").map((item) => item.id)).toContain("floodpath-help");
  });

  it("retrieves the image and AI privacy limit", () => {
    expect(retrieveKnowledge("AI có gửi ảnh báo cáo lên không?").map((item) => item.id)).toContain("ai-report-limits");
  });

  it("retrieves forecast guidance for a product question without the module name", () => {
    expect(retrieveKnowledge("Dự báo mưa trong ứng dụng có phải số đo tại đường không?").map((item) => item.id)).toContain("floodpulse-help");
  });

  it("answers AI product capability questions without claiming live conditions", () => {
    expect(retrieveKnowledge("AI có xác minh đường đang ngập hiện nay không?").map((item) => item.id)).toContain("ai-report-limits");
    expect(isCurrentFloodStatusQuestion("AI có xác minh đường đang ngập hiện nay không?")).toBe(true);
  });

  it("returns no context for current flood status outside the product knowledge base", () => {
    expect(retrieveKnowledge("Đường Nguyễn Trãi hiện có ngập sâu bao nhiêu?")).toEqual([]);
  });
});
