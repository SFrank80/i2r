"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// api/src/index.ts
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const zod_1 = require("zod");
const db_1 = require("./db");
const validators_1 = require("./validators");
// -----------------------------------------------------------------------------
// App & middleware (order matters)
// -----------------------------------------------------------------------------
const app = (0, express_1.default)();
// Allow calls from Vite dev server
app.use((0, cors_1.default)({
    origin: ["http://localhost:5173"],
}));
// ❗ Body parser must come BEFORE any routes
app.use(express_1.default.json({
    limit: "1mb",
    // tolerate a few JSON content-types
    type: ["application/json", "application/*+json", "text/json"],
}));
// -----------------------------------------------------------------------------
// Shared enums & schemas
// -----------------------------------------------------------------------------
const Priority = zod_1.z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const IncidentStatus = zod_1.z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
const UpdateIncidentSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().max(10000).optional(),
    priority: Priority.optional(),
    status: IncidentStatus.optional(),
    assetId: zod_1.z.number().int().positive().nullable().optional(),
    lon: zod_1.z.number().optional(),
    lat: zod_1.z.number().optional(),
})
    // don’t allow completely empty body
    .refine((v) => Object.keys(v).length > 0, { message: "Body must include at least one field to update." });
function requireRole(...roles) {
    return (req, res, next) => {
        const role = String(req.header("x-user-role") ?? "VIEWER").toUpperCase();
        if (!roles.includes(role)) {
            return res.status(403).json({ error: "forbidden", message: `role ${role} cannot perform this action` });
        }
        req.role = role;
        next();
    };
}
// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------
// Health
app.get("/health", (_req, res) => res.send("ok"));
// GET /incidents?status=OPEN&priority=HIGH&page=1&pageSize=20&q=hydrant
app.get("/incidents", async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10)));
        const status = req.query.status;
        const priority = req.query.priority;
        const q = req.query.q?.trim();
        const where = {};
        if (status)
            where.status = status;
        if (priority)
            where.priority = priority;
        if (q) {
            where.OR = [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
            ];
        }
        const [items, total] = await Promise.all([
            db_1.prisma.incident.findMany({
                where,
                orderBy: { id: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            db_1.prisma.incident.count({ where }),
        ]);
        res.json({ page, pageSize, total, items });
    }
    catch (err) {
        next(err);
    }
});
// POST /incidents (create) — dispatcher or field tech
app.post("/incidents", requireRole("DISPATCHER", "FIELDTECH", "ADMIN"), async (req, res, next) => {
    try {
        const data = validators_1.createIncidentSchema.parse(req.body);
        const created = await db_1.prisma.incident.create({ data });
        res.status(201).json(created);
    }
    catch (err) {
        if (err instanceof zod_1.ZodError) {
            return res.status(400).json({ error: "validation_error", issues: err.issues });
        }
        next(err);
    }
});
// PATCH /incidents/:id (partial update) — dispatcher or admin
app.patch("/incidents/:id", requireRole("DISPATCHER", "ADMIN"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid id" });
    }
    const parsed = UpdateIncidentSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Validation failed",
            issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        });
    }
    const data = parsed.data;
    try {
        const updated = await db_1.prisma.incident.update({
            where: { id },
            data: {
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.priority !== undefined ? { priority: data.priority } : {}),
                ...(data.status !== undefined ? { status: data.status } : {}),
                ...(data.lon !== undefined ? { lon: data.lon } : {}),
                ...(data.lat !== undefined ? { lat: data.lat } : {}),
                ...(data.assetId !== undefined ? { assetId: data.assetId } : {}),
            },
        });
        res.json(updated);
    }
    catch (err) {
        if (err?.code === "P2025") {
            return res.status(404).json({ message: "Incident not found" });
        }
        console.error(err);
        res.status(500).json({ message: "Update failed" });
    }
});
// -----------------------------------------------------------------------------
// Error handler
// -----------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({ error: "validation_error", issues: err.issues });
    }
    console.error(err);
    res.status(500).json({ error: "internal_error" });
});
// -----------------------------------------------------------------------------
// Listen
// -----------------------------------------------------------------------------
const PORT = Number(process.env.PORT ?? 5050);
app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
});
