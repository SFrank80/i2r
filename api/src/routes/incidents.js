// FILE: api/src/routes/incidents.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { onIncidentCreated, onIncidentUpdated } from "../integrations/snow/hooks.js";

// --- Prisma singleton (prevents too many clients on nodemon hot reload) ---
const prisma = globalThis.__prisma ?? new PrismaClient();
if (!globalThis.__prisma) globalThis.__prisma = prisma;

const router = Router();

/* ------------------------------- helpers ------------------------------- */
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

// lightweight CSV escaper (handles quotes & newlines)
function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* -------------------------------- LIST --------------------------------- */
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
          lon: true,
          lat: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    res.json({ total, items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
});

/* ------------------------------- READ ONE ------------------------------ */
// GET /incidents/:id
router.get("/:id", async (req, res) => {
  try {
    const idNum = Number(req.params.id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return res.status(400).json({ ok: false, reason: "bad_id" });
    }

    const incident = await prisma.incident.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        assetId: true,
        lon: true,
        lat: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!incident) {
      return res.status(404).json({ ok: false, reason: "incident_not_found" });
    }

    res.json({ ok: true, incident });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
});

/* ------------------------------- CREATE -------------------------------- */
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

    // Fan-out to ServiceNow (fire-and-forget; errors are logged in the hook)
    onIncidentCreated(incident).catch((e) =>
      console.warn("[snow] create hook failed:", e?.message || e)
    );
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

    if (typeof status === "string" && status.length) {
      data.status = status; // "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
    }

    if (assetId === null || assetId === "null") {
      data.assetId = null; // clear assignment
    } else if (assetId !== undefined) {
      const assetIdNum = Number(assetId);
      if (!Number.isFinite(assetIdNum) || assetIdNum <= 0) {
        return res.status(400).json({ ok: false, reason: "bad_asset_id" });
      }
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

    // Fan-out to ServiceNow (fire-and-forget)
    onIncidentUpdated(incident).catch((e) =>
      console.warn("[snow] update hook failed:", e?.message || e)
    );
  } catch (e) {
    if (e?.code === "P2025") {
      return res.status(404).json({ ok: false, reason: "incident_not_found" });
    }
    if (e?.code === "P2003") {
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
      .map((r) => `${r.id},"${(r.title || "").replaceAll('"', '""')}",${r.priority},${r.status},${r.assetId ?? ""}`)
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="incidents.csv"');
    res.send(`${header}\n${body}`);
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

/* -------------------- GeoJSON export (kept) -------------------- */
router.get("/geojson", async (_req, res) => {
  try {
    const rows = await prisma.incident.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true, title: true, description: true,
        priority: true, status: true, lon: true, lat: true,
        assetId: true, createdAt: true,
      },
    });

    const features = rows
      .filter((r) => r.lon != null && r.lat != null)
      .map((r) => ({
        type: "Feature",
        id: r.id,
        geometry: { type: "Point", coordinates: [Number(r.lon), Number(r.lat)] },
        properties: {
          id: r.id, title: r.title ?? "", description: r.description ?? "",
          priority: r.priority, status: r.status, assetId: r.assetId,
          createdAt: r.createdAt?.toISOString?.() ?? null,
        },
      }));

    res.json({ type: "FeatureCollection", features });
  } catch (e) {
    console.error("[incidents] geojson failed:", e);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
});

export default router;
