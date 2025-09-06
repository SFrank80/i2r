import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { z, ZodError } from "zod";
import { prisma } from "./db"; // expects api/src/db.ts exporting `prisma`

// ----------------------------------------------------------------------------
// App bootstrap
// ----------------------------------------------------------------------------
const app = express();
app.use(cors({ origin: ["http://localhost:5173"], credentials: false }));
app.use(express.json());

// ----------------------------------------------------------------------------
// Zod enums & schemas (local to this file for clarity)
// ----------------------------------------------------------------------------
const Priority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const IncidentStatus = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

const CreateIncidentSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(10_000).optional().nullable(),
  priority: Priority,
  status: IncidentStatus,
  lon: z.number(),
  lat: z.number(),
  assetId: z.number().int().positive().optional().nullable(),
  // Clients normally do not send this; we allow it, but the server will set a default
  reporterId: z.number().int().positive().optional(),
});

const PatchIncidentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(10_000).optional().nullable(),
  priority: Priority.optional(),
  status: IncidentStatus.optional(),
  lon: z.number().optional(),
  lat: z.number().optional(),
  assetId: z.number().int().positive().nullable().optional(),
});

// ----------------------------------------------------------------------------
// RBAC helper (header x-user-role)
// ----------------------------------------------------------------------------
function requireRole(...roles: Array<"ADMIN" | "DISPATCHER" | "FIELDTECH">) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = String(req.header("x-user-role") ?? "VIEWER").toUpperCase();
    if (!roles.includes(role as any)) {
      return res
        .status(403)
        .json({ error: "forbidden", message: `role ${role} cannot perform this action` });
    }
    (req as any).role = role;
    next();
  };
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------
app.get("/health", (_req, res) => res.send("ok"));

app.get("/__diag", async (_req, res, next) => {
  try {
    const [assets, incidents] = await Promise.all([
      prisma.asset.count(),
      prisma.incident.count(),
    ]);
    res.json({ ok: true, assets, incidents });
  } catch (err) {
    next(err);
  }
});

// List incidents (filters + paging)
app.get("/incidents", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10)));
    const q = (req.query.q as string | undefined)?.trim();
    const status = req.query.status as z.infer<typeof IncidentStatus> | undefined;
    const priority = req.query.priority as z.infer<typeof Priority> | undefined;

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (q) where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];

    const [items, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.incident.count({ where }),
    ]);

    res.json({ page, pageSize, total, items });
  } catch (err) {
    next(err);
  }
});

// Create incident (adds reporterId to satisfy Prisma IncidentCreateInput)
app.post("/incidents", requireRole("DISPATCHER", "FIELDTECH"), async (req, res, next) => {
  try {
    const parsed = CreateIncidentSchema.parse(req.body);

    // If caller provided header x-user-id, use it; else default to 1
    const headerUser = Number(req.header("x-user-id"));
    const reporterId = Number.isFinite(headerUser)
      ? headerUser
      : parsed.reporterId ?? 1; // fallback to 1 if neither header nor body provided

    const created = await prisma.incident.create({
      data: {
        title: parsed.title,
        description: parsed.description ?? null,
        priority: parsed.priority,
        status: parsed.status,
        lon: parsed.lon,
        lat: parsed.lat,
        assetId: parsed.assetId ?? null,
        reporterId, // ✅ required by IncidentCreateInput
      },
    });

    res.status(201).json(created);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "validation_error", issues: err.issues });
    }
    next(err);
  }
});

// Patch incident
app.patch("/incidents/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });

  const parsed = PatchIncidentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "validation_error", issues: parsed.error.issues });
  }

  try {
    const updated = await prisma.incident.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.lon !== undefined ? { lon: parsed.data.lon } : {}),
        ...(parsed.data.lat !== undefined ? { lat: parsed.data.lat } : {}),
        ...(parsed.data.assetId !== undefined ? { assetId: parsed.data.assetId } : {}),
      },
    });
    res.json(updated);
  } catch (err: any) {
    if (err?.code === "P2025") return res.status(404).json({ error: "not_found" });
    next(err);
  }
});

// List assets (search + paging)
app.get("/assets", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10)));
    const q = (req.query.q as string | undefined)?.trim();

    const where: any = {};
    if (q) where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { type: { contains: q, mode: "insensitive" } },
    ];

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.asset.count({ where }),
    ]);

    res.json({ page, pageSize, total, items });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------------------------------
// Central error handler
// ----------------------------------------------------------------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

// ----------------------------------------------------------------------------
// Listen
// ----------------------------------------------------------------------------
const PORT = Number(process.env.PORT ?? 5050);
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
