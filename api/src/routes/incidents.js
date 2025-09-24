// api/src/routes/incidents.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

// --- Prisma singleton (prevents too many clients on nodemon hot reload) ---
const prisma = globalThis.__prisma ?? new PrismaClient();
if (!globalThis.__prisma) globalThis.__prisma = prisma;

const router = Router();

/* -------------------- helpers -------------------- */
const toInt = (v, def = undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

function buildWhere({ q, assetId }) {
  return {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(assetId ? { assetId } : {}),
  };
}

/* -------------------- LIST -------------------- */
// GET /incidents?page=&pageSize=&q=&assetId=
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const pageSize = Math.max(1, Math.min(1000, toInt(req.query.pageSize, 10)));
    const q = (req.query.q || "").toString().trim();
    const assetId = toInt(req.query.assetId);

    const where = buildWhere({ q, assetId });

    const [total, rows] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          status: true,
          assetId: true,
        },
      }),
    ]);

    // IMPORTANT: the UI expects { total, items }
    res.json({ total, items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
});

/* -------------------- CREATE -------------------- */
// POST /incidents
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description = "",
      priority,
      status,
      lon,
      lat,
      assetId,
    } = req.body || {};

    if (!title || !priority || !status) {
      return res.status(400).json({ ok: false, reason: "missing_fields" });
    }

    const lonNum = lon === undefined || lon === null ? null : toInt(lon, null);
    const latNum = lat === undefined || lat === null ? null : toInt(lat, null);
    const assetIdNum =
      assetId === undefined || assetId === null || assetId === ""
        ? undefined
        : toInt(assetId);

    const data = {
      title,
      description,
      priority, // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      status,   // "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
      lon: lonNum,
      lat: latNum,
      ...(assetIdNum ? { asset: { connect: { id: assetIdNum } } } : {}),
    };

    const incident = await prisma.incident.create({ data });
    res.status(201).json({ ok: true, incident });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
});

/* -------------------- UPDATE (status and/or asset) -------------------- */
router.patch("/:id", async (req, res) => {
  try {
    const idNum = Number(req.params.id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return res.status(400).json({ ok: false, reason: "bad_id" });
    }

    const { status, assetId } = req.body ?? {};
    const data = {};

    // status change (optional)
    if (typeof status === "string" && status.length) {
      data.status = status; // "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
    }

    // asset change (optional)
    if (assetId === null || assetId === "null") {
      data.assetId = null; // clear assignment
    } else if (assetId !== undefined) {
      const assetIdNum = Number(assetId);
      if (!Number.isFinite(assetIdNum) || assetIdNum <= 0) {
        return res.status(400).json({ ok: false, reason: "bad_asset_id" });
      }
      // make sure asset exists to avoid FK errors
      const asset = await prisma.asset.findUnique({ where: { id: assetIdNum } });
      if (!asset) {
        return res.status(400).json({ ok: false, reason: "asset_not_found" });
      }
      data.assetId = assetIdNum;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, reason: "no_fields_to_update" });
    }

    const incident = await prisma.incident.update({
      where: { id: idNum },
      data,
    });

    res.json({ ok: true, incident });
  } catch (e) {
    // Return better errors instead of a blanket 500
    if (e?.code === "P2025") {
      // Record to update not found
      return res.status(404).json({ ok: false, reason: "incident_not_found" });
    }
    if (e?.code === "P2003") {
      // Foreign key constraint failure
      return res.status(400).json({ ok: false, reason: "asset_fk_violation" });
    }
    console.error(e);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
});

/* -------------------- CSV export -------------------- */
// GET /incidents/export.csv?q=&assetId=
router.get("/export.csv", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const assetId = toInt(req.query.assetId);

    const where = buildWhere({ q, assetId });

    const rows = await prisma.incident.findMany({
      where,
      orderBy: { id: "desc" },
      select: { id: true, title: true, priority: true, status: true, assetId: true },
    });

    const header = "id,title,priority,status,assetId";
    const body = rows
      .map((r) => {
        const safeTitle = (r.title || "").replaceAll('"', '""');
        return `${r.id},"${safeTitle}",${r.priority},${r.status},${r.assetId ?? ""}`;
      })
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.send(`${header}\n${body}`);
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

export default router;
