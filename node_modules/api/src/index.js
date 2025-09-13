// FILE: api/src/index.js
// ESM all the way; no `require`.

import "dotenv/config";
import express from "express";
import cors from "cors";

// Be tolerant of how db.js exports:
//  - named export:  export const prisma = new PrismaClient(...)
//  - default export: export default prisma
import prismaDefault, { prisma as prismaNamed } from "./db.js";
const db = prismaNamed ?? prismaDefault;

// ---------------------------- helpers ---------------------------------
function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function toStringOrUndef(v) {
  return typeof v === "string" && v.trim() ? v : undefined;
}
function toFloat(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function inRange(n, min, max) {
  return typeof n === "number" && n >= min && n <= max ? n : undefined;
}
function parseLonOrUndef(v) {
  return inRange(toFloat(v), -180, 180);
}
function parseLatOrUndef(v) {
  return inRange(toFloat(v), -90, 90);
}
function getErrorMessage(e) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
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

// Defaults used when client omits/invalid lon/lat
const DEFAULT_LON =
  inRange(toFloat(process.env.DEFAULT_LON), -180, 180) ?? -76.6122; // Baltimore-ish
const DEFAULT_LAT =
  inRange(toFloat(process.env.DEFAULT_LAT), -90, 90) ?? 39.2904;

// ------------------------------ app -----------------------------------
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
      db.asset.count({ where }),
      db.asset.findMany(findArgs),
    ]);

    res.json({ page, pageSize, total, items });
  } catch (e) {
    res.status(500).json({ error: getErrorMessage(e) });
  }
});

// ---- Incidents (create)
// Option B: keep schema strict; fill lon/lat with defaults if missing/invalid.
app.post("/incidents", async (req, res) => {
  try {
    const { title, description, priority, status, lon, lat, assetId } =
      req.body ?? {};

    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }

    const lonNum = parseLonOrUndef(lon) ?? DEFAULT_LON;
    const latNum = parseLatOrUndef(lat) ?? DEFAULT_LAT;

    const data = {
      title: title.trim(),
      description: typeof description === "string" ? description : "",
      priority,
      status,
      lon: lonNum,
      lat: latNum,
      assetId: typeof assetId === "number" ? assetId : undefined,
    };

    const created = await db.incident.create({ data });
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: getErrorMessage(e) });
  }
});

// ---- Incidents (update)
app.patch("/incidents/:id", async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "invalid id" });
    }

    const body = req.body ?? {};
    const data = {};

    for (const k of ["title", "description", "priority", "status"]) {
      if (k in body) data[k] = body[k];
    }

    if ("lon" in body) {
      const n = parseLonOrUndef(body.lon);
      if (typeof n === "number") data.lon = n;
    }
    if ("lat" in body) {
      const n = parseLatOrUndef(body.lat);
      if (typeof n === "number") data.lat = n;
    }
    if ("assetId" in body) {
      if (typeof body.assetId === "number") data.assetId = body.assetId;
    }

    const updated = await db.incident.update({ where: { id }, data });
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
      ...(priorityList && priorityList.length
        ? { priority: { in: priorityList } }
        : {}),
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
      db.incident.count({ where }),
      db.incident.findMany(findArgs),
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
      ...(priorityList && priorityList.length
        ? { priority: { in: priorityList } }
        : {}),
    };

    const rows = await db.incident.findMany({
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
      take: 10000, // cap export
    });

    const header = [
      "id",
      "title",
      "description",
      "priority",
      "status",
      "assetId",
      "createdAt",
    ];

    const csv =
      header.join(",") +
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

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="incidents.csv"',
    );
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: getErrorMessage(e) });
  }
});

// ---- Start server + optional inline SLA runner
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);

  if (process.env.SLA_INLINE === "1") {
    // IMPORTANT: include .js so ESM resolves correctly
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
