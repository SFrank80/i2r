// FILE: api/src/index.js
// ESM API with analytics events + CSV analytics endpoints

import "dotenv/config";
import express from "express";
import cors from "cors";
import prismaDefault, { prisma as prismaNamed } from "./db.js";
import { logEvent } from "./analytics.js";
import { attachAnalyticsRoutes } from "./routes/analytics.js";

// Use whichever export the db module provides
const prisma = prismaNamed || prismaDefault;

// ---------- helpers ----------
function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function toStringOrUndef(v) {
  return typeof v === "string" && v.trim() ? v : undefined;
}
function getErrorMessage(e) {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}
function asCsvValue(v) {
  const s =
    v === null || v === undefined
      ? ""
      : typeof v === "string"
      ? v
      : typeof v === "number"
      ? String(v)
      : typeof v === "boolean"
      ? (v ? "true" : "false")
      : new Date(v).toString() !== "Invalid Date"
      ? new Date(v).toISOString()
      : JSON.stringify(v);
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------- app ----------
const app = express();
const PORT = Number(process.env.PORT ?? 5050);

app.use(cors());
app.use(express.json());

// ---- Health
app.get("/health", (_req, res) => res.type("text/plain").send("ok"));

// ---- Assets (list)
app.get("/assets", async (req, res) => {
  try {
    const q = toStringOrUndef(req.query.q);
    const page = Math.max(1, toInt(req.query.page, 1));
    const pageSize = Math.min(50, Math.max(1, toInt(req.query.pageSize, 10)));

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { type: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const findArgs = {
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * pageSize,
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
    };

    const [total, items] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany(findArgs),
    ]);

    res.json({ page, pageSize, total, items });
  } catch (e) {
    res.status(500).json({ error: getErrorMessage(e) });
  }
});

// ---- Incidents (create)
app.post("/incidents", async (req, res) => {
  try {
    const { title, description, priority, status, lon, lat, assetId } = req.body ?? {};
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }

    const data = {
      title: title.trim(),
      description: typeof description === "string" ? description : "",
      priority,
      status,
    };
    if (typeof lon === "number") data.lon = lon;
    if (typeof lat === "number") data.lat = lat;
    if (typeof assetId === "number") data.assetId = assetId;

    const created = await prisma.incident.create({ data });

    // log analytics event
    await logEvent(req, "incident.create", { priority, status }, created.id);

    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: getErrorMessage(e) });
  }
});

// ---- Incidents (update)
app.patch("/incidents/:id", async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

    const body = req.body ?? {};
    const data = {};
    for (const k of ["title", "description", "priority", "status"]) {
      if (k in body) data[k] = body[k];
    }
    if ("lon" in body) data.lon = typeof body.lon === "number" ? body.lon : undefined;
    if ("lat" in body) data.lat = typeof body.lat === "number" ? body.lat : undefined;
    if ("assetId" in body) data.assetId = typeof body.assetId === "number" ? body.assetId : null;

    const updated = await prisma.incident.update({ where: { id }, data });

    // log analytics event (special-case assign)
    const isAssign = Object.prototype.hasOwnProperty.call(body, "assetId");
    await logEvent(
      req,
      isAssign ? "incident.assign_asset" : "incident.update",
      { changed: Object.keys(body) },
      id
    );

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: getErrorMessage(e) });
  }
});

// ---- Incidents (list)
app.get("/incidents", async (req, res) => {
  try {
    const q = toStringOrUndef(req.query.q);
    const page = Math.max(1, toInt(req.query.page, 1));
    const pageSize = Math.min(50, Math.max(1, toInt(req.query.pageSize, 10)));
    const assetId = req.query.assetId ? toInt(req.query.assetId, NaN) : undefined;

    const statusList =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;

    const priorityList =
      typeof req.query.priority === "string" && req.query.priority.trim()
        ? req.query.priority.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;

    const where = {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(assetId ? { assetId } : {}),
      ...(statusList && statusList.length ? { status: { in: statusList } } : {}),
      ...(priorityList && priorityList.length ? { priority: { in: priorityList } } : {}),
    };

    const findArgs = {
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
        lon: true,
        lat: true,
        assetId: true,
        createdAt: true,
        updatedAt: true,
      },
    };

    const [total, items] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany(findArgs),
    ]);

    res.json({ page, pageSize, total, items });
  } catch (e) {
    res.status(500).json({ error: getErrorMessage(e) });
  }
});

// ---- Incidents export (CSV)
app.get("/incidents/export.csv", async (req, res) => {
  try {
    const q = toStringOrUndef(req.query.q);
    const assetId = req.query.assetId ? toInt(req.query.assetId, NaN) : undefined;

    const statusList =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;

    const priorityList =
      typeof req.query.priority === "string" && req.query.priority.trim()
        ? req.query.priority.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;

    const where = {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(assetId ? { assetId } : {}),
      ...(statusList && statusList.length ? { status: { in: statusList } } : {}),
      ...(priorityList && priorityList.length ? { priority: { in: priorityList } } : {}),
    };

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
        createdAt: true,
      },
      take: 10000,
    });

    const columns = ["id", "title", "description", "priority", "status", "assetId", "createdAt"];
    const csv =
      columns.join(",") +
      "\n" +
      rows
        .map((r) =>
          [
            asCsvValue(r.id),
            asCsvValue(r.title),
            asCsvValue(r.description),
            asCsvValue(r.priority),
            asCsvValue(r.status),
            asCsvValue(r.assetId),
            asCsvValue(r.createdAt),
          ].join(","),
        )
        .join("\n");

    // log analytics event
    await logEvent(req, "incidents.export_csv", { q, assetId, statusList, priorityList });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="incidents.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: getErrorMessage(e) });
  }
});

// ---- Analytics CSV routes
attachAnalyticsRoutes(app);

// ---- Start server (+ optional SLA inline runner)
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);

  if (process.env.SLA_INLINE === "1") {
    import("./jobs/sla.js")
      .then(async ({ scheduleSlaCheck, startSlaWorker }) => {
        try {
          if (typeof scheduleSlaCheck === "function") await scheduleSlaCheck();
          if (typeof startSlaWorker === "function") await startSlaWorker();
          console.log("[SLA] Inline runner active (SLA_INLINE=1)");
        } catch (err) {
          console.error("[SLA] Inline start failed:", err);
        }
      })
      .catch((err) => console.error("[SLA] Inline import failed:", err));
  }
});
