import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    // Adjust select fields if your schema uses different column names
    const rows = await prisma.asset.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true }
    });
    res.json(rows);
  } catch (e) {
    console.error("[assets] list failed:", e.message || e);
    res.status(200).json({ ok: false, reason: "internal_error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, name: true }
    });
    if (!asset) return res.sendStatus(404);
    res.json(asset);
  } catch (e) {
    console.error("[assets] get failed:", e.message || e);
    res.status(200).json({ ok: false, reason: "internal_error" });
  }
});

export default router;
