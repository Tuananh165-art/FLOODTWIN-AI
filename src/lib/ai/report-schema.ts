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
