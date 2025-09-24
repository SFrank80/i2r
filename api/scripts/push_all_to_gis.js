import { PrismaClient } from "@prisma/client";
import { pushIncidentAdd, pushAssetUpsert } from "../src/gis/arcgis.js";

const db = new PrismaClient();

async function main() {
  // Assets
  const assets = await db.asset.findMany();
  for (const a of assets) await pushAssetUpsert(a).catch(console.error);

  // Incidents
  const incs = await db.incident.findMany();
  for (const i of incs) await pushIncidentAdd(i).catch(console.error);

  console.log("Backfill complete.");
  await db.$disconnect();
}

main().catch((e)=>{ console.error(e); process.exit(1); });
