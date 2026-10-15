export type ExportablePublicReport = {
  public_summary: string;
  verification_level: string;
  latitude: number;
  longitude: number;
  observed_at: string;
  expires_at: string;
  status: string;
};

function safeCell(value: string | number) {
  let text = String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function publicReportsCsv(reports: ExportablePublicReport[]) {
  const rows = [
    ["tom_tat_cong_khai", "cap_xem_xet", "vi_do", "kinh_do", "thoi_diem_quan_sat_utc", "het_hieu_luc_utc", "trang_thai"],
    ...reports.map((report) => [report.public_summary, report.verification_level, report.latitude, report.longitude, report.observed_at, report.expires_at, report.status]),
  ];
  return `\uFEFF${rows.map((row) => row.map(safeCell).join(",")).join("\r\n")}\r\n`;
}

export function publicReportsGeoJson(reports: ExportablePublicReport[]) {
  return {
    type: "FeatureCollection" as const,
    features: reports.map((report) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [report.longitude, report.latitude] },
      properties: {
        summary: report.public_summary,
        verificationLevel: report.verification_level,
        observedAt: report.observed_at,
        expiresAt: report.expires_at,
        status: report.status,
      },
    })),
  };
}
