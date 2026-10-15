import { describe, expect, it } from "vitest";
import { normalizeReportExtraction, reportExtractionSchema } from "@/lib/ai/report-schema";

describe("AI report extraction contract", () => {
  it("accepts a neutral extraction that preserves hearsay and uncertainty", () => {
    const result = reportExtractionSchema.safeParse({
      condition: "unclear",
      sourceType: "hearsay",
      certainty: "uncertain",
      reportedTime: "tối qua",
      placeMentioned: "gần chợ, chưa rõ tên",
      needsLocationConfirmation: true,
      missingDetails: ["thời gian cụ thể", "vị trí trên bản đồ"],
      neutralSummary: "Người gửi nghe kể về nước trên đường tối qua; vị trí và thời điểm cần xác nhận.",
      questions: ["Bạn có thể chọn vị trí gần đúng trên bản đồ không?"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported categorical or unsafe certainty values", () => {
    const result = reportExtractionSchema.safeParse({
      condition: "safe_route",
      sourceType: "firsthand",
      certainty: "certain",
      reportedTime: "now",
      placeMentioned: "Biên Hòa",
      needsLocationConfirmation: false,
      missingDetails: [],
      neutralSummary: "The route is safe.",
      questions: [],
    });
    expect(result.success).toBe(false);
  });

  it("fills conservative defaults when the model returns an incomplete object", () => {
    expect(normalizeReportExtraction({ condition: "flooding", missingDetails: "thời điểm" })).toMatchObject({
      condition: "flooding",
      sourceType: "unknown",
      certainty: "unknown",
      needsLocationConfirmation: true,
      missingDetails: ["thời điểm"],
      neutralSummary: "Chưa có tóm tắt; người gửi cần tự rà soát.",
      questions: [],
    });
  });

  it("does not try to normalize non-object output", () => {
    expect(normalizeReportExtraction(["flooding"])).toBeNull();
  });
});
