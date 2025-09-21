// FILE: api/src/routes/analytics.js
import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

/* ------------------------------- helpers ------------------------------- */

function fmtDate(d) {
  if (!(d instanceof Date)) d = new Date(d);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
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

/* ------------------------------- routes -------------------------------- */

/**
 * GET /analytics/daily.csv
 * Incidents grouped by day × status × priority
 */
router.get("/daily.csv", async (_req, res) => {
  const rows = await prisma.$queryRaw`
    SELECT DATE("createdAt") AS day,
           "status",
           "priority",
           COUNT(*)::int AS count
    FROM "Incident"
    GROUP BY 1,2,3
    ORDER BY 1 ASC, 2 ASC, 3 ASC;
  `;

  const shaped = rows.map((r) => ({
    day: fmtDate(r.day),
    status: r.status,
    priority: r.priority,
    count: Number(r.count),
  }));

  sendCsv(res, "daily.csv", shaped);
});

/**
 * GET /analytics/by-asset.csv
 * Top assets by incident count (nulls filtered out)
 */
router.get("/by-asset.csv", async (_req, res) => {
  const rows = await prisma.$queryRaw`
    SELECT "assetId", COUNT(*)::int AS count
    FROM "Incident"
    WHERE "assetId" IS NOT NULL
    GROUP BY "assetId"
    ORDER BY count DESC, "assetId" ASC
    LIMIT 100;
  `;

  const shaped = rows.map((r) => ({
    assetId: r.assetId,
    count: Number(r.count),
  }));

  sendCsv(res, "by-asset.csv", shaped);
});

/**
 * GET /analytics/sla.csv
 * Daily count of events where we sent the "OPEN still stale after X minutes" alert
 */
router.get("/sla.csv", async (_req, res) => {
  const rows = await prisma.$queryRaw`
    SELECT DATE("createdAt") AS day, COUNT(*)::int AS breaches
    FROM "Event"
    WHERE "type" = 'sla.open_stale_alert'
    GROUP BY 1
    ORDER BY 1 ASC;
  `;

  const shaped = rows.map((r) => ({
    day: fmtDate(r.day),
    breaches: Number(r.breaches),
  }));

  sendCsv(res, "sla.csv", shaped);
});

export default router;
