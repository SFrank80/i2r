// FILE: api/scripts/seed.ts
import "dotenv/config";
import prisma from "../src/db.js";

async function ensureAssets() {
  try {
    const count = await prisma.asset.count();
    if (count > 0) return;

    await prisma.asset.createMany({
      data: [
        { name: "Valve 50",  type: "VALVE" },
        { name: "Pump 1",    type: "PUMP" },
        { name: "Meter A12", type: "METER" },
      ],
      skipDuplicates: true,
    });
    console.log("Seeded assets.");
  } catch (e) {
    console.warn("Asset seed skipped (no Asset model/table?)", e);
  }
}

async function ensureIncidents() {
  try {
    const count = await prisma.incident.count();
    if (count > 0) return;

    const assets = await prisma.asset.findMany({ take: 1 });
    const assetId = assets[0]?.id ?? null;

    const base = {
      description: "Seeded incident for dev",
      lon: -76.6122,
      lat: 39.2904,
      assetId,
    };

    await prisma.incident.createMany({
      data: [
        { title: "Main break near 5th", priority: "HIGH",     status: "OPEN",        ...base },
        { title: "Meter offline alert", priority: "MEDIUM",   status: "IN_PROGRESS", ...base },
        { title: "Valve inspection",    priority: "LOW",      status: "RESOLVED",    ...base },
        { title: "Pump overheat",       priority: "CRITICAL", status: "OPEN",        ...base },
      ],
      skipDuplicates: true,
    });
    console.log("Seeded incidents.");
  } catch (e) {
    console.error("Incident seed failed:", e);
  }
}

async function main() {
  await ensureAssets();
  await ensureIncidents();
  console.log("Counts:", {
    assets: await prisma.asset.count().catch(() => -1),
    incidents: await prisma.incident.count().catch(() => -1),
  });
}

main().finally(() => prisma.$disconnect());
