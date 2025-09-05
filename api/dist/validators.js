"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIncidentSchema = void 0;
// api/src/validators.ts
const zod_1 = require("zod");
exports.createIncidentSchema = zod_1.z.object({
    title: zod_1.z.string().min(3, "title must be at least 3 chars"),
    description: zod_1.z.string().default(""),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
    reporterId: zod_1.z.number().int().positive().default(1),
    assetId: zod_1.z.number().int().positive().optional(),
    lon: zod_1.z.number().min(-180).max(180),
    lat: zod_1.z.number().min(-90).max(90)
});
