// Wires your Incident lifecycle to ServiceNow with retries and a tiny persistence map.
import { PrismaClient } from "@prisma/client";
import { snCreate, snUpdate } from "./client.js";
import { toSnowFields } from "./mapping.js";

const prisma = globalThis.__prisma ?? new PrismaClient();
if (!globalThis.__prisma) globalThis.__prisma = prisma;

// We store the ServiceNow sys_id mapping in a small side-table to avoid schema changes.
// CREATE TABLE IF NOT EXISTS snow_link (incident_id int unique, sys_id varchar(64));
let ensurePromise = null;
async function ensureSnowLinkTable() {
  if (!ensurePromise) {
    ensurePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "snow_link" (
        incident_id INTEGER UNIQUE REFERENCES "Incident"(id) ON DELETE CASCADE,
        sys_id VARCHAR(64) NOT NULL
      );
    `).catch((e) => {
      console.warn("[snow] ensure table failed (will keep going):", e?.message || e);
    });
  }
  return ensurePromise;
}

async function getSysId(incidentId) {
  await ensureSnowLinkTable();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT sys_id FROM "snow_link" WHERE incident_id = $1 LIMIT 1;`,
    incidentId
  );
  return Array.isArray(rows) && rows[0]?.sys_id ? rows[0].sys_id : null;
}

async function upsertSysId(incidentId, sysId) {
  await ensureSnowLinkTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "snow_link"(incident_id, sys_id)
     VALUES ($1, $2)
     ON CONFLICT (incident_id) DO UPDATE SET sys_id = EXCLUDED.sys_id;`,
    incidentId,
    sysId
  );
}

async function withRetry(fn, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i))); // 0.5s, 1s, 2s
    }
  }
  throw lastErr;
}

// Public hooks you’ll call from your routes
export async function onIncidentCreated(incident) {
  const fields = toSnowFields(incident);

  // If SN env isn’t configured we silently skip
  if (!process.env.SN_INSTANCE_URL || !process.env.SN_USER || !process.env.SN_PASS) return;

  const result = await withRetry(() => snCreate(fields));
  const sysId = result?.sys_id;
  if (sysId) {
    await upsertSysId(incident.id, sysId);
  }

  // Log an event if the table exists; ignore failures
  try {
    await prisma.event.create({
      data: {
        type: "snow.create",
        incidentId: incident.id,
        metadata: { sysId },
      },
    });
  } catch {}
}

export async function onIncidentUpdated(incident) {
  if (!process.env.SN_INSTANCE_URL || !process.env.SN_USER || !process.env.SN_PASS) return;

  const sysId = await getSysId(incident.id);
  const fields = toSnowFields(incident);

  if (sysId) {
    const result = await withRetry(() => snUpdate(sysId, fields));
    try {
      await prisma.event.create({
        data: {
          type: "snow.update",
          incidentId: incident.id,
          metadata: { sysId, changed: Object.keys(fields) },
        },
      });
    } catch {}
    return result;
  } else {
    // No mapping yet (perhaps SN was offline at create) — create now.
    const res = await withRetry(() => snCreate(fields));
    const newId = res?.sys_id;
    if (newId) await upsertSysId(incident.id, newId);
    try {
      await prisma.event.create({
        data: {
          type: "snow.create_late",
          incidentId: incident.id,
          metadata: { sysId: newId },
        },
      });
    } catch {}
    return res;
  }
}
