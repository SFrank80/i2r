// FILE: api/scripts/diag.ts
import "dotenv/config";
import prisma from "../src/db";

async function main() {
  console.log("Checking DB…");
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("DB connection: OK");
  } catch (e) {
    console.error("DB connection failed:", e);
  }

  try {
    const ic = await prisma.incident.count();
    console.log("Incident count:", ic);
  } catch (e) {
    console.error("Incident table issue:", e);
  }

  try {
    const ac = await prisma.asset.count();
    console.log("Asset count:", ac);
  } catch (e) {
    console.error("Asset table issue:", e);
  }
}

main().finally(() => prisma.$disconnect());
