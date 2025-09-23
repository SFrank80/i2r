import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

// GET /incidents?page=1&pageSize=10&asset=&q=
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 10)));

    const where = {};
    if (req.query.asset) where.assetId = Number(req.query.asset);
    if (req.query.q) where.title = { contains: String(req.query.q), mode: "insensitive" };

    const [total, rows] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, title: true, description: true, priority: true, status: true, assetId: true }
      })
    ]);

    res.json({ total, rows });
  } catch (e) {
    console.error("[incidents] list failed:", e.message || e);
    res.status(200).json({ ok: false, reason: "internal_error" });
  }
});

// PATCH /incidents/:id  (status or asset assignment)
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, assetId } = req.body || {};
    const updated = await prisma.incident.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(typeof assetId !== "undefined" ? { assetId } : {})
      },
      select: { id: true, status: true, assetId: true }
    });
    res.json({ ok: true, incident: updated });
  } catch (e) {
    console.error("[incidents] patch failed:", e.message || e);
    res.status(200).json({ ok: false, reason: "internal_error" });
  }
});

export default router;
