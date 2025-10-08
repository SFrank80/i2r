// FILE: api/src/routes/incidents.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

// --- Prisma singleton (prevents too many clients on nodemon hot reload) ---
const prisma = globalThis.__prisma ?? new PrismaClient();
if (!globalThis.__prisma) globalThis.__prisma = prisma;

const router = Router();

/* ------------------------------- helpers ------------------------------- */

const toNum = (v, def = undefined) => {
  if (v === null || v === undefined || v === "") return def;
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

// lightweight CSV escaper
function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* -------------------------------- LIST --------------------------------- */
// GET /incidents?page=&pageSize=&q=&assetId=
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, toNum(req.query.page, 1));
    const pageSize = Math.max(1, Math.min(1000, toNum(req.query.pageSize, 10)));
    const q = (req.query.q || "").toString().trim();
    const assetId = toNum(req.query.assetId);

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
        },
      }),
    ]);

    res.json({ total, items: rows });
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

    const lonNum = toNum(lon, null);
    const latNum = toNum(lat, null);
    const assetIdNum = toNum(assetId);

    const data = {
      title,
      description,
      priority, // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      status, // "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
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

/* ---------------------- UPDATE (status / asset / description) ---------- */
// PATCH /incidents/:id
router.patch("/:id", async (req, res) => {
  try {
    const idNum = toNum(req.params.id);
    if (!idNum) {
      return res.status(400).json({ ok: false, reason: "bad_id" });
    }

    const { status, assetId, description } = req.body ?? {};
    const data = {};

    // status (optional)
    if (typeof status === "string" && status.length) {
      data.status = status;
    }

    // description append/replace (optional)
    if (typeof description === "string") {
      data.description = description;
    }

    // asset change (optional)
    if (assetId === null || assetId === "null") {
      data.assetId = null;
    } else if (assetId !== undefined) {
      const assetIdNum = toNum(assetId);
      if (!assetIdNum) {
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

/* ------------------------------ CSV export ----------------------------- */
// GET /incidents/export.csv?q=&assetId=
// ignore any other params so the client can't 400 this by accident
router.get("/export.csv", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const assetId = toNum(req.query.assetId);

    const where = buildWhere({ q, assetId });

    const rows = await prisma.incident.findMany({
      where,
      orderBy: { id: "desc" },
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
      },
    });

    const headers = [
      "id",
      "title",
      "description",
      "priority",
      "status",
      "assetId",
      "lon",
      "lat",
      "createdAt",
    ];

    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.id,
          csvEscape(r.title ?? ""),
          csvEscape(r.description ?? ""),
          r.priority,
          r.status,
          r.assetId ?? "",
          r.lon ?? "",
          r.lat ?? "",
          r.createdAt ? new Date(r.createdAt).toISOString() : "",
        ].join(","),
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="incidents.csv"');
    res.send(lines.join("\n"));
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

/* -------------------- GeoJSON export (for map) ------------------------- */
// GET /incidents/geojson
router.get("/geojson", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const assetId = toNum(req.query.assetId);

    const where = buildWhere({ q, assetId });

    const rows = await prisma.incident.findMany({
      where,
      orderBy: { id: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        lon: true,
        lat: true,
        assetId: true,
        createdAt: true,
      },
    });

    const features = rows
      .filter((r) => r.lon != null && r.lat != null)
      .map((r) => ({
        type: "Feature",
        id: r.id,
        geometry: { type: "Point", coordinates: [Number(r.lon), Number(r.lat)] },
        properties: {
          id: r.id,
          title: r.title ?? "",
          description: r.description ?? "",
          priority: r.priority,
          status: r.status,
          assetId: r.assetId,
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
