import { describe, expect, it } from "vitest";
import { parseModelJson } from "./parse-model-json";

describe("parseModelJson", () => {
  it("parses ordinary and fenced JSON", () => {
    expect(parseModelJson('{"ok":true}')).toEqual({ ok: true });
    expect(parseModelJson('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it("extracts one JSON object when the model adds surrounding text", () => {
    expect(parseModelJson('Kết quả: {"summary":"có } trong câu"} hết')).toEqual({ summary: "có } trong câu" });
  });

  it("rejects truncated or missing JSON", () => {
    expect(() => parseModelJson('{"ok":')).toThrow();
    expect(() => parseModelJson("Không có đối tượng JSON")).toThrow();
  });
});
