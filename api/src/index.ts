// api/src/index.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { prisma } from "./db";
import { createIncidentSchema } from "./validators";
import type { Prisma } from "@prisma/client";

// ---- helpers ---------------------------------------------------------------

function toInt(v: unknown, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
}

// Build a safe Prisma filter for string searches
const INSENSITIVE: Prisma.QueryMode = "insensitive";

function assetWhere(q?: string): Prisma.AssetWhereInput {
  if (!q || !q.trim()) return {};
  return {
    OR: [
      { name: { contains: q, mode: INSENSITIVE } },
      { type: { contains: q, mode: INSENSITIVE } },
    ],
  };
}

function incidentWhere(q?: string): Prisma.IncidentWhereInput {
  if (!q || !q.trim()) return {};
  return {
    OR: [
      { title: { contains: q, mode: INSENSITIVE } },
      { description: { contains: q, mode: INSENSITIVE } },
    ],
  };
}

// Very small role check used by POST/PATCH endpoints
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = String(req.header("x-user-role") ?? "").toUpperCase();
    if (!roles.includes(role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}

// ---- app -------------------------------------------------------------------

const app = express();
app.use(cors());
app.use(express.json());

// health + tiny diag
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

// ---- ASSETS (list) ---------------------------------------------------------

app.get("/assets", async (req, res, next) => {
  try {
    const page = toInt(req.query.page, 1);
    const pageSize = toInt(req.query.pageSize, 10);
    const skip = (page - 1) * pageSize;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;

    const where = assetWhere(q);

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { id: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          type: true,
          lon: true,
          lat: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.asset.count({ where }),
    ]);

    res.json({ page, pageSize, total, items });
  } catch (err) {
    next(err);
  }
});

// ---- INCIDENTS (list/create/patch) ----------------------------------------

app.get("/incidents", async (req, res, next) => {
  try {
    const page = toInt(req.query.page, 1);
    const pageSize = toInt(req.query.pageSize, 10);
    const skip = (page - 1) * pageSize;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;

    const where = incidentWhere(q);

    const [items, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        orderBy: { id: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          status: true,
          reporterId: true,
          assetId: true,
          lon: true,
          lat: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.incident.count({ where }),
    ]);

    res.json({ page, pageSize, total, items });
  } catch (err) {
    next(err);
  }
});

app.post(
  "/incidents",
  requireRole("DISPATCHER", "FIELDTECH"),
  async (req, res, next) => {
    try {
      // parse + validate request
      const parsed = createIncidentSchema.parse(req.body);

      // if you don’t post reporterId from UI, default to a valid user (id 1)
      const reporterId = req.body.reporterId ?? 1;

      const created = await prisma.incident.create({
        data: {
          title: parsed.title,
          description: parsed.description ?? null,
          priority: parsed.priority,
          status: parsed.status,
          lon: parsed.lon,
          lat: parsed.lat,
          reporterId,
          assetId: parsed.assetId ?? null,
        },
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          status: true,
          reporterId: true,
          assetId: true,
          lon: true,
          lat: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(201).json(created);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: "validation_error", issues: err.issues });
      }
      next(err);
    }
  }
);

app.patch(
  "/incidents/:id",
  requireRole("DISPATCHER", "FIELDTECH"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });

      // accept small partial set: status/priority/assetId
      const patch: Prisma.IncidentUpdateInput = {};
      if (typeof req.body.status === "string") patch.status = req.body.status;
      if (typeof req.body.priority === "string") patch.priority = req.body.priority;
      if (req.body.assetId === null || Number.isFinite(Number(req.body.assetId))) {
        patch.asset = req.body.assetId == null
          ? { disconnect: true }
          : { connect: { id: Number(req.body.assetId) } };
      }

      const updated = await prisma.incident.update({
        where: { id },
        data: patch,
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          status: true,
          reporterId: true,
          assetId: true,
          lon: true,
          lat: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ---- errors ---------------------------------------------------------------

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

// ---- boot (keep port 5050) ------------------------------------------------

const PORT = Number(process.env.PORT ?? 5050);
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

export default app;

