export type RainSignalInput = {
  observed1hMm?: number | null;
  observed3hMm?: number | null;
  forecast1hMm?: number | null;
  forecast3hMm?: number | null;
};

export type RainSignal = {
  level: "insufficient_data" | "low_signal" | "moderate_signal" | "elevated_signal";
  source: "none" | "observed" | "forecast";
  reasons: string[];
  ruleVersion: "rain-reference-v1";
};

const validRainfall = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/**
 * A transparent weather attention signal. These uncalibrated pilot thresholds
 * describe rain only; they never assert that a street is flooded.
 */
export function assessRainSignal(input: RainSignalInput): RainSignal {
  const observed1h = validRainfall(input.observed1hMm) ? input.observed1hMm : undefined;
  const observed3h = validRainfall(input.observed3hMm) ? input.observed3hMm : undefined;
  const forecast1h = validRainfall(input.forecast1hMm) ? input.forecast1hMm : undefined;
  const forecast3h = validRainfall(input.forecast3hMm) ? input.forecast3hMm : undefined;

  const hasObservation = observed1h !== undefined || observed3h !== undefined;
  const source = hasObservation ? "observed" : forecast1h !== undefined || forecast3h !== undefined ? "forecast" : "none";

  if (source === "none") {
    return {
      level: "insufficient_data",
      source,
      reasons: ["Chưa có dữ liệu mưa để đánh giá."],
      ruleVersion: "rain-reference-v1",
    };
  }

  const oneHour = hasObservation ? observed1h : forecast1h;
  const threeHour = hasObservation ? observed3h : forecast3h;
  const label = hasObservation ? "Mưa ghi nhận" : "Dự báo mưa";
  const reasons: string[] = [];
  let level: RainSignal["level"] = "low_signal";

  if (oneHour !== undefined && oneHour >= 25) {
    level = "elevated_signal";
    reasons.push(`${label} 1 giờ đạt ngưỡng tham khảo 25 mm.`);
  } else if (threeHour !== undefined && threeHour >= 30) {
    level = "moderate_signal";
    reasons.push(`${label} tích lũy 3 giờ đạt ngưỡng tham khảo 30 mm.`);
  } else if (oneHour !== undefined || threeHour !== undefined) {
    reasons.push(`${label} hiện dưới ngưỡng chú ý thử nghiệm.`);
  }

  return { level, source, reasons, ruleVersion: "rain-reference-v1" };
}
