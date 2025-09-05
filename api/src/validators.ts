// api/src/validators.ts
import { z } from "zod";

export const createIncidentSchema = z.object({
  title: z.string().min(3, "title must be at least 3 chars"),
  description: z.string().default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  reporterId: z.number().int().positive().default(1),
  assetId: z.number().int().positive().optional(),
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90)
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
