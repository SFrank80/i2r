// FILE: api/src/validators.js
import { z } from "zod";

// ---- Enums ---------------------------------------------------------------
export const IncidentPriority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const IncidentStatus   = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

// ---- Create / Update Schemas --------------------------------------------
export const createIncidentSchema = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().optional().nullable(),
  priority: IncidentPriority.default("MEDIUM"),
  status: IncidentStatus.default("OPEN"),
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  assetId: z.number().int().positive().optional().nullable(),
  reporterId: z.number().int().positive().optional(),
});

export const updateIncidentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  priority: IncidentPriority.optional(),
  status: IncidentStatus.optional(),
  assetId: z.number().int().positive().nullable().optional(),
  lon: z.number().optional(),
  lat: z.number().optional(),
});

// ---- List helpers --------------------------------------------------------
export function parseCsv(value) {
  if (value == null) return undefined;
  const s = Array.isArray(value) ? value.join(",") : String(value);
  const arr = s
    .split(",")
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => v.toUpperCase());
  return arr.length ? arr : undefined;
}
