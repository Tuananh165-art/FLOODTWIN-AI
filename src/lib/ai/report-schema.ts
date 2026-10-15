import { z } from "zod";

export const reportExtractionSchema = z.object({
  condition: z.enum(["flooding", "water_on_road", "no_flood", "other", "unclear"]),
  sourceType: z.enum(["firsthand", "hearsay", "unknown"]),
  certainty: z.enum(["certain", "uncertain", "unknown"]),
  reportedTime: z.string().max(120),
  placeMentioned: z.string().max(160),
  needsLocationConfirmation: z.boolean(),
  missingDetails: z.array(z.string().max(120)).max(5),
  neutralSummary: z.string().max(280),
  questions: z.array(z.string().max(160)).max(3),
});

export type ReportExtraction = z.infer<typeof reportExtractionSchema>;

function normalizedText(value: unknown, maxLength: number, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : fallback;
}

function normalizedList(value: unknown, maxItems: number, maxLength: number) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems).map((item) => item.trim().slice(0, maxLength));
}

/** Fill conservative defaults for incomplete but parseable model objects. */
export function normalizeReportExtraction(value: unknown): ReportExtraction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const condition = normalizedText(candidate.condition, 32).toLowerCase().replaceAll(" ", "_");
  const sourceType = normalizedText(candidate.sourceType, 32).toLowerCase();
  const certainty = normalizedText(candidate.certainty, 32).toLowerCase();
  const normalized = reportExtractionSchema.safeParse({
    condition: ["flooding", "water_on_road", "no_flood", "other", "unclear"].includes(condition) ? condition : "unclear",
    sourceType: ["firsthand", "hearsay", "unknown"].includes(sourceType) ? sourceType : "unknown",
    certainty: ["certain", "uncertain", "unknown"].includes(certainty) ? certainty : "unknown",
    reportedTime: normalizedText(candidate.reportedTime, 120),
    placeMentioned: normalizedText(candidate.placeMentioned, 160),
    needsLocationConfirmation: typeof candidate.needsLocationConfirmation === "boolean" ? candidate.needsLocationConfirmation : true,
    missingDetails: normalizedList(candidate.missingDetails, 5, 120),
    neutralSummary: normalizedText(candidate.neutralSummary, 280) || "Chưa có tóm tắt; người gửi cần tự rà soát.",
    questions: normalizedList(candidate.questions, 3, 160),
  });
  return normalized.success ? normalized.data : null;
}
