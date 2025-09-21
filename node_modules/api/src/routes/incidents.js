// FILE: api/src/routes/incidents.js
import { Router } from "express";
import { prisma } from "../db.js";
import {
  notifyIncidentCreated,
  notifyAssignment,
  notifyStatusChange,
} from "../notifications/index.js";

const router = Router();

/* ------------------------------ helpers ------------------------------ */

function toInt(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}
function toStr(v) {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function getError(e) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
async function logEvent(type, incidentId, actor = "api", metadata = {}) {
  try {
    await prisma.event.create({
      data: { type, incidentId, actor, metadata },
    });
  } catch (err) {
    console.warn("[event] log failed:", err?.message || err);
  }
}

/* ------------------------------- LIST -------------------------------- */
/**
 * GET /incidents
 * Query: q, page, pageSize, assetId, status=CSV, priority=CSV
 */
router.get("/", async (req, res) => {
  try {
    const q = toStr(req.query.q);
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

    const [total, items] = await Promise.all([
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
          lon: true,
          lat: true,
          assetId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    res.json({ page, pageSize, total, items });
  } catch (e) {
    res.status(500).json({ error: getError(e) });
  }
});

/* ------------------------------ CREATE ------------------------------- */
/**
 * POST /incidents
 * Body: { title, description, priority, status, lon, lat, assetId? }
 * Also sends an email + logs an event.
 */
router.post("/", async (req, res) => {
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
      lon: typeof lon === "number" ? lon : undefined,
      lat: typeof lat === "number" ? lat : undefined,
      assetId: typeof assetId === "number" ? assetId : undefined,
    };

    const created = await prisma.incident.create({ data });

    // event + email
    await logEvent("incident.create", created.id, "api", {
      priority,
      status,
      assetId: data.assetId ?? null,
    });
    await notifyIncidentCreated(created).catch((err) =>
      console.warn("[notifyIncidentCreated] failed:", err?.message || err),
    );

    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: getError(e) });
  }
});

/* ------------------------------ UPDATE ------------------------------- */
/**
 * PATCH /incidents/:id
 * Body: partial Incident fields (title, description, status, priority, lon, lat, assetId?)
 * Sends emails on assignment/status change + logs events.
 */
router.patch("/:id", async (req, res) => {
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

    // Take a snapshot for diffing (so await is INSIDE the handler)
    const before = await prisma.incident.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: "not found" });

    const updated = await prisma.incident.update({ where: { id }, data });

    // status change?
    if ("status" in body && body.status !== before.status) {
      await logEvent("incident.status_change", id, "api", {
        from: before.status,
        to: body.status,
      });
      await notifyStatusChange(id, body.status).catch((err) =>
        console.warn("[notifyStatusChange] failed:", err?.message || err),
      );
    }

    // asset assignment change?
    if ("assetId" in body && body.assetId !== before.assetId) {
      await logEvent("incident.assign_asset", id, "api", {
        from: before.assetId,
        to: body.assetId ?? null,
      });
      await notifyAssignment(id, body.assetId ?? null).catch((err) =>
        console.warn("[notifyAssignment] failed:", err?.message || err),
      );
    }

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: getError(e) });
  }
});

export default router;
