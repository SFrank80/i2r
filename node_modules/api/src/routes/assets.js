// FILE: api/src/routes/assets.js
import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

/* ------------------------------- CSV helpers ------------------------------- */
function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function sendCsv(res, filename, rows) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  if (!rows || rows.length === 0) return res.send("");
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];
  res.send(lines.join("\n"));
}

/* ------------------------------- routes ----------------------------------- */

/**
 * NOTE: Put /export.csv and /geojson BEFORE /:id so they aren't captured by the param route.
 *
 * GET /assets/export.csv
 * Minimal asset export (includes lon/lat)
 * Example: http://localhost:5050/assets/export.csv
 */
router.get("/export.csv", async (_req, res) => {
  try {
    const rows = await prisma.asset.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true, type: true, lon: true, lat: true },
    });

    const shaped = rows.map((r) => ({
      id: r.id,
      name: r.name ?? "",
      type: r.type ?? "",
      lon: r.lon == null ? "" : Number(r.lon),
      lat: r.lat == null ? "" : Number(r.lat),
    }));

    sendCsv(res, "assets.csv", shaped);
  } catch (e) {
    console.error("[assets] export.csv failed:", e);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
});

/**
 * GET /assets/geojson
 * GeoJSON FeatureCollection of assets with Point geometry.
 * Example: http://localhost:5050/assets/geojson
 */
router.get("/geojson", async (_req, res) => {
  try {
    const rows = await prisma.asset.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true, type: true, lon: true, lat: true },
    });

    const features = rows
      .filter((r) => r.lon != null && r.lat != null)
      .map((r) => ({
        type: "Feature",
        id: r.id,
        geometry: {
          type: "Point",
          coordinates: [Number(r.lon), Number(r.lat)], // [lon, lat]
        },
        properties: {
          id: r.id,
          name: r.name ?? "",
          type: r.type ?? "",
        },
      }));

    res.json({ type: "FeatureCollection", features });
  } catch (e) {
    console.error("[assets] geojson failed:", e);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
});

/**
 * GET /assets
 * Lightweight list used by the UI (id + name).
 */
router.get("/", async (_req, res) => {
  try {
    const rows = await prisma.asset.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.json(rows);
  } catch (e) {
    console.error("[assets] list failed:", e.message || e);
    // keep your existing behavior of returning 200 with an error payload
    res.status(200).json({ ok: false, reason: "internal_error" });
  }
});

/**
 * GET /assets/:id
 * Fetch single asset (id + name to match your current API).
 */
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, reason: "bad_id" });
    }
    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!asset) return res.sendStatus(404);
    res.json(asset);
  } catch (e) {
    console.error("[assets] get failed:", e.message || e);
    // keep your existing behavior
    res.status(200).json({ ok: false, reason: "internal_error" });
  }
});

export default router;
