// CSV analytics endpoints: daily, by-asset, SLA breaches
import express from "express";
import prisma from "../db.js";

// helpers (no regex pitfalls)
function needsCsvQuote(s) { return s.includes(",") || s.includes('"') || s.includes("\n"); }
function csvEscape(s) { return `"${s.replace(/"/g, '""')}"`; }
function asCsvValue(v) {
  const s =
    v == null ? "" :
    typeof v === "string" ? v :
    typeof v === "number" ? String(v) :
    typeof v === "boolean" ? (v ? "true" : "false") :
    new Date(v).toString() !== "Invalid Date" ? new Date(v).toISOString() :
    JSON.stringify(v);
  return needsCsvQuote(s) ? csvEscape(s) : s;
}

export function attachAnalyticsRoutes(app) {
  const r = express.Router();

  // /analytics/daily.csv  -> model Daily { Day, Status, Count }
  r.get("/daily.csv", async (_req, res) => {
    try {
      const rows = await prisma.daily.findMany({ orderBy: { Day: "asc" } });
      const cols = ["Day", "Status", "Count"];
      const csv = [cols.join(","), ...rows.map(x => [
        asCsvValue(x.Day), asCsvValue(x.Status), asCsvValue(x.Count)
      ].join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="daily.csv"');
      res.send(csv);
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  // /analytics/by-asset.csv -> model ByAsset { AssetName, Count }
  r.get("/by-asset.csv", async (_req, res) => {
    try {
      const rows = await prisma.byAsset.findMany({ orderBy: { AssetName: "asc" } });
      const cols = ["AssetName", "Count"];
      const csv = [cols.join(","), ...rows.map(x => [
        asCsvValue(x.AssetName), asCsvValue(x.Count)
      ].join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="by-asset.csv"');
      res.send(csv);
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  // /analytics/sla-breaches.csv -> model SLA { CreatedAt, Status, Priority }
  r.get("/sla-breaches.csv", async (_req, res) => {
    try {
      const rows = await prisma.sLA.findMany({ orderBy: { CreatedAt: "desc" } });
      const cols = ["CreatedAt", "Status", "Priority"];
      const csv = [cols.join(","), ...rows.map(x => [
        asCsvValue(x.CreatedAt), asCsvValue(x.Status), asCsvValue(x.Priority)
      ].join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="sla-breaches.csv"');
      res.send(csv);
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  app.use("/analytics", r);
}
