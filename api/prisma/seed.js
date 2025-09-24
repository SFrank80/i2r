// FILE: api/prisma/seed.js
// - Creates 100 incidents in English
// - Uses enum strings that match schema.prisma

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ------- helpers -------
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rnd = (min, max) => Math.random() * (max - min) + min;

// Bounding box around Montgomery & Prince George’s Counties, MD (WSSC area)
const LON_MIN = -77.30, LON_MAX = -76.50;
const LAT_MIN = 38.70, LAT_MAX = 39.30;

// Enum strings (must match your Prisma enums)
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES   = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

// Map title → priority (simple keyword heuristic)
function inferPriority(title) {
  const t = title.toLowerCase();
  if (
    /main break|boil water|sewer overflow|overflow reported|no water|tank overflow|power failure|back[- ]?up/.test(t)
  ) return "CRITICAL";
  if (
    /hydrant leak|service line|blockage|low pressure|odor at pump|pump failure|comms loss|chlorine|prv|stuck/.test(t)
  ) return "HIGH";
  if (/complaint|brown water|odor|inspection|required|alarm|leaking|tamper|traffic/.test(t)) return "MEDIUM";
  return "LOW";
}

function inferDescription(title) {
  const notes = [
    "Dispatch crew, verify safety, and protect the public.",
    "Document photos, close valves as needed, and notify communications.",
    "Coordinate with operations; escalate if service levels are at risk.",
    "Capture GPS and update GIS as-builts after completion.",
  ];
  return `${title}. ${notes[randInt(0, notes.length - 1)]}`;
}

async function resetIdentities() {
  // Try a single TRUNCATE with RESTART IDENTITY for the core tables.
  // If any table doesn’t exist, fall back to deleteMany().
  try {
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Event') THEN
          EXECUTE 'TRUNCATE TABLE "Event" RESTART IDENTITY CASCADE';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Incident') THEN
          EXECUTE 'TRUNCATE TABLE "Incident" RESTART IDENTITY CASCADE';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Asset') THEN
          EXECUTE 'TRUNCATE TABLE "Asset" RESTART IDENTITY CASCADE';
        END IF;
      END$$;
    `);
  } catch {
    // Fallback: clear by client API; identities may not reset in this path.
    try { await db.event.deleteMany(); } catch {}
    try { await db.incident.deleteMany(); } catch {}
    try { await db.asset.deleteMany(); } catch {}
  }

  // Optional analytics tables—clear if you have them.
  try { await db.$executeRawUnsafe(`TRUNCATE TABLE "Daily" RESTART IDENTITY CASCADE`); } catch {}
  try { await db.$executeRawUnsafe(`TRUNCATE TABLE "ByAsset" RESTART IDENTITY CASCADE`); } catch {}
  try { await db.$executeRawUnsafe(`TRUNCATE TABLE "SLA" RESTART IDENTITY CASCADE`); } catch {}
}

async function seedAssets() {
  const assetCatalog = [
    { prefix: "HYD",  type: "Hydrant" },
    { prefix: "VAL",  type: "Valve" },
    { prefix: "WM",   type: "WaterMain" },
    { prefix: "SM",   type: "SewerMain" },
    { prefix: "MH",   type: "Manhole" },
    { prefix: "PRV",  type: "PressureReducingValve" },
    { prefix: "PS",   type: "PumpStation" },
    { prefix: "TANK", type: "StorageTank" },
    { prefix: "TP",   type: "TreatmentPlant" },
    { prefix: "FM",   type: "FlowMeter" },
    { prefix: "SEN",  type: "Sensor" },
    { prefix: "RTU",  type: "SCADA_RTU" },
  ];

  const assets = [];

  // Create ~30 assets spread across types
  for (let i = 1; i <= 30; i++) {
    const cat = assetCatalog[i % assetCatalog.length];
    const name = `${cat.prefix}-${String(i).padStart(3, "0")}`;
    const created = await db.asset.create({
      data: {
        name,
        type: cat.type,
        lon: rnd(LON_MIN, LON_MAX),
        lat: rnd(LAT_MIN, LAT_MAX),
      },
    });
    assets.push(created);
  }

  return assets;
}

async function seedIncidents(assets) {
  const titles = [
    "Hydrant leak at corner",
    "Water main break on 8\" cast iron",
    "Service line leak reported by customer",
    "Valve stuck partially closed",
    "Discolored water complaint after flushing",
    "No water pressure on block",
    "Low pressure in Zone 3",
    "High pressure alarm at PRV",
    "Chlorine residual below target",
    "Chlorine residual above target",
    "Sewer overflow reported near creek",
    "Manhole surcharge during storm",
    "Odor complaint at pump station",
    "Lift station power failure",
    "Pump failure at Station A",
    "SCADA communications loss at RTU",
    "Filter backwash failure at plant",
    "Clarifier scraper jammed",
    "Grit chamber blockage",
    "AMI endpoint offline",
    "Backflow device failure noted",
    "Air release valve leaking",
    "PRV stuck open",
    "PRV stuck closed",
    "Frozen service line",
    "Water main break on 12\" ductile iron",
    "Valve exercising required",
    "Hydrant out of service",
    "Treatment plant turbidity high (NTU)",
    "Reservoir low level alarm",
    "Tank overflow alarm",
    "Sewer main blockage suspected",
    "Grease blockage in gravity main",
    "Inflow and infiltration observed",
    "Sinkhole forming near main",
    "Third-party damage from construction",
    "Road collapse risk over main",
    "Meter pit flooded",
    "Lead service line verification visit",
    "Unauthorized hydrant use",
    "Illegal dumping into sewer",
    "811 locate request received",
    "CCTV inspection required",
    "Pipe corrosion identified",
    "Cathodic protection alarm",
    "Generator test failed at site",
    "Facility on generator after outage",
    "Pressure sensor failure",
    "Flow meter calibration due",
    "Bypass pump setup requested",
    "Emergency interconnect opened",
    "Interconnect closed after event",
    "Tank mixer failure",
    "SCADA alarm flood (nuisance)",
    "Cybersecurity alert on SCADA",
    "Ammonia analyzer fault",
    "pH analyzer fault",
    "UV system fault",
    "Membrane integrity breach alarm",
    "Chemical delivery delay",
    "Minor chemical spill contained",
    "Safety incident (no injury)",
    "Wildlife intrusion at facility",
    "Security fence breach",
    "Gate stuck at yard",
    "Site access blocked by contractor",
    "Road closure impacting crew",
    "Storm flooding reports",
    "Damaged meter lid",
    "Meter tampering suspected",
    "Sewer odor complaint from customer",
    "Backyard easement access needed",
    "Root intrusion confirmed by CCTV",
    "CIPP liner curing delay",
    "Capital project conflict in field",
    "Permit issue holding work",
    "Flooded basement complaint",
    "Sewer backup inside home",
    "Dead-end main requires flushing",
    "Air in distribution lines",
    "Brown water after repair",
    "Temporary asphalt patch needed",
    "Permanent pavement restoration",
    "Traffic control requested",
    "Police assist requested for closure",
    "Media inquiry about incident",
    "Council office inquiry",
    "Public notification required",
    "Door hanger distribution needed",
    "Customer callback requested",
    "Work order follow-up",
    "Closeout documentation pending",
    "GIS update required",
    "Hydrant flushing needed",
    "Service turn-on request",
    "Service turn-off request",
    "Meter re-read requested",
    "AMI endpoint replacement scheduled",
    "Valve locating required",
    "Air release valve inspection",
    "Manhole lid replacement",
    "Sewer cleaning crew dispatch",
    "Hydrant painting scheduled",
    "Storm-related debris removal",
  ];

  // Create exactly 100 incidents by cycling the title list
  const incidentsToCreate = 100;
  let created = 0;

  for (let i = 0; i < incidentsToCreate; i++) {
    const title = titles[i % titles.length];
    const description = inferDescription(title);
    const priority = inferPriority(title);

    // Status mix skewed toward OPEN / IN_PROGRESS for realism
    const statusWeights = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
    const statusPick = statusWeights[randInt(0, statusWeights.length - 1)];

    // 90% with an asset
    const attachAsset = Math.random() < 0.9;
    const data = {
      title,
      description,
      priority,                   // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      status: statusPick,         // "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
      lon: rnd(LON_MIN, LON_MAX),
      lat: rnd(LAT_MIN, LAT_MAX),
      ...(attachAsset && assets.length
        ? { asset: { connect: { id: assets[randInt(0, assets.length - 1)].id } } }
        : {}),
    };

    await db.incident.create({ data });
    created++;
  }

  return created;
}

async function main() {
  console.log("Seeding (WSSC-style)…");

  await resetIdentities();

  // Seed assets
  const assets = await seedAssets();
  console.log(`Created ${assets.length} assets.`);

  // Seed incidents
  const count = await seedIncidents(assets);
  console.log(`Created ${count} incidents.`);

  console.log("Seed complete.");
}

main()
  .then(async () => { await db.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
