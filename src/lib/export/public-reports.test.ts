import { describe, expect, it } from "vitest";
import { publicReportsCsv, publicReportsGeoJson, type ExportablePublicReport } from "@/lib/export/public-reports";

const report: ExportablePublicReport = {
  public_summary: "=HYPERLINK(\"https://example.test\")",
  verification_level: "team_reviewed",
  latitude: 10.95,
  longitude: 106.85,
  observed_at: "2026-10-15T03:00:00.000Z",
  expires_at: "2026-10-15T05:00:00.000Z",
  status: "reviewed",
};

describe("privacy-safe public report exports", () => {
  it("quotes CSV cells and neutralizes spreadsheet formulas", () => {
    const csv = publicReportsCsv([report]);
    expect(csv).toContain("\uFEFF");
    expect(csv).toContain("\"'=HYPERLINK(\"\"https://example.test\"\")\"");
    expect(csv).not.toContain("author_id");
  });

  it("exports GeoJSON in longitude-latitude order without report IDs or authors", () => {
    const geojson = publicReportsGeoJson([report]);
    expect(geojson.features[0].geometry.coordinates).toEqual([106.85, 10.95]);
    expect(geojson.features[0].properties).not.toHaveProperty("author_id");
    expect(geojson.features[0].properties).not.toHaveProperty("id");
  });
});
