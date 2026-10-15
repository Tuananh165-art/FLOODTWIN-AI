import { describe, expect, it } from "vitest";
import { isWithinVietnam, vietnamCoordinateQuerySchema, vietnamPointSchema } from "./vietnam";

describe("Vietnam coordinate scope", () => {
  it("accepts Đồng Nai, Hồ Chí Minh City and Hanoi points", () => {
    expect(isWithinVietnam({ lat: 10.956, lon: 106.838 })).toBe(true);
    expect(vietnamPointSchema.safeParse({ lat: 10.7769, lon: 106.7009 }).success).toBe(true);
    expect(vietnamPointSchema.safeParse({ lat: 21.0285, lon: 105.8542 }).success).toBe(true);
  });

  it("rejects coordinates outside the Vietnam lookup box", () => {
    expect(vietnamPointSchema.safeParse({ lat: 13.7563, lon: 100.5018 }).success).toBe(false);
    expect(vietnamCoordinateQuerySchema.safeParse({ lat: "7.9", lon: "106.7" }).success).toBe(false);
  });
});
