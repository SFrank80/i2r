// FILE: api/src/validators.ts
import { z } from "zod";

// enums used across API
export const IncidentPriority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const IncidentStatus   = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

// POST /incidents
export const createIncidentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: IncidentPriority,
  status: IncidentStatus,                 // <- include status
  lon: z.number(),
  lat: z.number(),
  assetId: z.number().int().positive().optional().nullable(),
});

// PATCH /incidents/:id  (everything optional)
export const updateIncidentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  priority: IncidentPriority.optional(),
  status: IncidentStatus.optional(),
  assetId: z.number().int().positive().nullable().optional(),
  lon: z.number().optional(),
  lat: z.number().optional(),
});
