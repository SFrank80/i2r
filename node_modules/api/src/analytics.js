// FILE: api/src/analytics.js
// Event logger + CSV helpers

import { prisma } from "./db.js";

/** Safely stringify errors/objects */
function getErrorMessage(e) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** Minimal CSV formatter from array of objects; preserves column order */
export function toCsv(rows, columns) {
  const esc = (v) => {
    const s =
      v === null || v === undefined
        ? ""
        : typeof v === "string"
        ? v
        : typeof v === "number"
        ? String(v)
        : typeof v === "boolean"
        ? (v ? "true" : "false")
        : v instanceof Date
        ? v.toISOString()
        : JSON.stringify(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

/** Derive an "actor" from request (very lightweight) */
function getActor(req) {
  return (
    req.get?.("x-api-key") ||
    req.headers?.["x-api-key"] ||
    req.ip ||
    req.headers?.["x-forwarded-for"] ||
    "web"
  ).toString();
}

/**
 * Log an analytics event.
 * @param {import('express').Request} req
 * @param {string} type - e.g. 'incident.create', 'incident.update', 'incidents.export_csv'
 * @param {object} meta - arbitrary JSON metadata (keep small)
 * @param {number|undefined} incidentId
 */
export async function logEvent(req, type, meta = {}, incidentId = undefined) {
  try {
    await prisma.event.create({
      data: {
        type,
        actor: getActor(req),
        incidentId: typeof incidentId === "number" ? incidentId : null,
        metadata: meta,
      },
    });
  } catch (e) {
    // Do not crash user flow if analytics fails
    console.warn("[analytics] logEvent failed:", getErrorMessage(e));
  }
}
