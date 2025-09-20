// api/src/routes/incidents.js
import { Router } from "express";
import prisma from "../db.js";
const router = Router();

router.post("/", async (req, res) => {
  const { title, description, priority, status, lon, lat, assetId } = req.body;

  /** @type {import('@prisma/client').Prisma.IncidentCreateInput} */
  const data = {
    title,
    description,
    priority, // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    status,   // "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
    lon,
    lat,
  };

  // Only add relation when assetId is present
  if (assetId != null && String(assetId).trim() !== "") {
    data.asset = { connect: { id: Number(assetId) } };
  }

  try {
    const created = await prisma.incident.create({ data });
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err?.message ?? "Internal Server Error" });
  }
});

export default router;
