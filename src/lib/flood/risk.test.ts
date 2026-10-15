import { describe, expect, it } from "vitest";
import { assessRainSignal } from "@/lib/flood/risk";

describe("assessRainSignal", () => {
  it("returns an explicit unknown when every source is missing", () => {
    expect(assessRainSignal({})).toEqual({
      level: "insufficient_data",
      source: "none",
      reasons: ["Chưa có dữ liệu mưa để đánh giá."],
      ruleVersion: "rain-reference-v1",
    });
  });

  it("keeps a forecast separate from a measured observation", () => {
    const result = assessRainSignal({ forecast1hMm: 30 });
    expect(result.level).toBe("elevated_signal");
    expect(result.source).toBe("forecast");
    expect(result.reasons).toContain("Dự báo mưa 1 giờ đạt ngưỡng tham khảo 25 mm.");
    expect(result.reasons.join(" ")).not.toMatch(/đã ngập|đang ngập|cm/i);
  });

  it("uses measured rainfall as measured without turning it into flood evidence", () => {
    const result = assessRainSignal({ observed1hMm: 25 });
    expect(result.level).toBe("elevated_signal");
    expect(result.source).toBe("observed");
    expect(result.reasons[0]).toContain("Mưa ghi nhận");
    expect(result.reasons.join(" ")).not.toContain("xác nhận ngập");
  });

  it("reports a moderate signal for accumulated forecast rain", () => {
    const result = assessRainSignal({ forecast3hMm: 30 });
    expect(result.level).toBe("moderate_signal");
    expect(result.source).toBe("forecast");
    expect(result.reasons[0]).toContain("3 giờ");
  });

  it.each([-0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    "ignores invalid rainfall values (%s)",
    (invalid) => {
      expect(assessRainSignal({ observed1hMm: invalid })).toMatchObject({
        level: "insufficient_data",
        source: "none",
      });
    },
  );
});
