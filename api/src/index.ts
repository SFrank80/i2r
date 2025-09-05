// api/src/index.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { z, ZodError } from "zod";
import { prisma } from "./db";
import { createIncidentSchema } from "./validators";

// -----------------------------------------------------------------------------
// App & middleware (order matters)
// -----------------------------------------------------------------------------
const app = express();

// Allow calls from Vite dev server
app.use(
  cors({
    origin: ["http://localhost:5173"],
  })
);

// ❗ Body parser must come BEFORE any routes
app.use(
  express.json({
    limit: "1mb",
    // tolerate a few JSON content-types
    type: ["application/json", "application/*+json", "text/json"],
  })
);

// -----------------------------------------------------------------------------
// Shared enums & schemas
// -----------------------------------------------------------------------------
const Priority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const IncidentStatus = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

const UpdateIncidentSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(10_000).optional(),
    priority: Priority.optional(),
    status: IncidentStatus.optional(),
    assetId: z.number().int().positive().nullable().optional(),
    lon: z.number().optional(),
    lat: z.number().optional(),
  })
  // don’t allow completely empty body
  .refine((v) => Object.keys(v).length > 0, { message: "Body must include at least one field to update." });

// -----------------------------------------------------------------------------
// Tiny RBAC via header: x-user-role (ADMIN / DISPATCHER / FIELDTECH / VIEWER)
// -----------------------------------------------------------------------------
type Role = "ADMIN" | "DISPATCHER" | "FIELDTECH" | "VIEWER";

function requireRole(...roles: Array<Exclude<Role, "VIEWER">>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = String(req.header("x-user-role") ?? "VIEWER").toUpperCase() as Role;
    if (!roles.includes(role as any)) {
      return res.status(403).json({ error: "forbidden", message: `role ${role} cannot perform this action` });
    }
    (req as any).role = role;
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

    const status = req.query.status as z.infer<typeof IncidentStatus> | undefined;
    const priority = req.query.priority as z.infer<typeof Priority> | undefined;
    const q = (req.query.q as string | undefined)?.trim();

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

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

// POST /incidents (create) — dispatcher or field tech
app.post(
  "/incidents",
  requireRole("DISPATCHER", "FIELDTECH", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createIncidentSchema.parse(req.body);
      const created = await prisma.incident.create({ data });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: "validation_error", issues: err.issues });
      }
      next(err);
    }
  }
);

// PATCH /incidents/:id (partial update) — dispatcher or admin
app.patch(
  "/incidents/:id",
  requireRole("DISPATCHER", "ADMIN"),
  async (req: Request, res: Response) => {
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
      const updated = await prisma.incident.update({
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
    } catch (err: any) {
      if (err?.code === "P2025") {
        return res.status(404).json({ message: "Incident not found" });
      }
      console.error(err);
      res.status(500).json({ message: "Update failed" });
    }
  }
);

// -----------------------------------------------------------------------------
// Error handler
// -----------------------------------------------------------------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
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
