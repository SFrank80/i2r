// FILE: prisma/seed.js
// Clean English seed data for demo. No runtime enum lookups—uses string values.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Helpers
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rnd = (min, max) => Math.random() * (max - min) + min;

// Enum string values that match your schema.prisma
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES   = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

async function main() {
  console.log("Seeding…");

  // ---- Clear in dependency order ----
  await db.event.deleteMany().catch(() => {});
  await db.incident.deleteMany().catch(() => {});
  await db.asset.deleteMany().catch(() => {});

  // Optional analytics tables (ignore if they don't exist)
  try { await db.daily.deleteMany(); } catch {}
  try { await db.byAsset.deleteMany(); } catch {}
  try { await db.sLA.deleteMany(); } catch {} // model "SLA" -> client "sLA"

  // ---- Assets ----
  const assetTypes = ["Camera", "Router", "Switch", "Server", "Sensor", "Gateway"];
  const assets = [];
  for (let i = 1; i <= 20; i++) {
    const created = await db.asset.create({
      data: {
        name: `Asset-${String(i).padStart(2, "0")}`,
        type: assetTypes[(i - 1) % assetTypes.length],
        lon: rnd(-120, -60), // rough USA-ish box
        lat: rnd(25, 45),
      },
    });
    assets.push(created);
  }
  const assetIds = assets.map(a => a.id);
  console.log(`Created ${assets.length} assets.`);

  // ---- Incidents (English, proper grammar) ----
  const titles = [
    "Investigate VPN connectivity issue",
    "Server room temperature alert",
    "Unauthorized login attempt detected",
    "Packet loss on the core switch",
    "Camera feed is intermittently offline",
    "Backups are failing on the database server",
    "API latency is above the threshold",
    "Email delivery is delayed",
    "Wireless coverage is weak on the east floor",
    "Unexpected device reboot reported",
    "Firewall rule requires review",
    "Shared storage is reaching capacity",
    "TLS certificate renewal required",
    "Log volume spikes during business hours",
    "Elevated error rate from the payment gateway",
    "Application crash observed after the update",
    "Alert storms from the monitoring agent",
    "Slow queries detected on the analytics database",
    "Access card reader malfunction",
    "Time synchronization drift detected",
  ];
  const detail = [
    "Please verify and document the root cause.",
    "Confirm impact, gather evidence, and propose a fix.",
    "Coordinate with the network team to isolate the issue.",
    "Escalate if service-level objectives are at risk.",
  ];

  let createdIncidents = 0;
  for (let i = 0; i < 50; i++) {
    const title = titles[i % titles.length];
    const description = `${title}. ${detail[i % detail.length]}`;

    const attachAsset = Math.random() < 0.85; // most incidents have an asset
    const data = {
      title,
      description,
      priority: PRIORITIES[i % PRIORITIES.length], // string enum
      status:   STATUSES[i % STATUSES.length],     // string enum
      lon: rnd(-120, -60),
      lat: rnd(25, 45),
      ...(attachAsset
        ? { asset: { connect: { id: assetIds[randInt(0, assetIds.length - 1)] } } }
        : {}),
    };

    await db.incident.create({ data });
    createdIncidents++;
  }

  console.log(`Created ${createdIncidents} incidents.`);
  console.log("Seed complete.");
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
