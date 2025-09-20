// Lightweight event logger used by index.js
import prisma from "./db.js";

export async function logEvent(req, type, metadata = {}, incidentId = null) {
  try {
    const actor =
      (req && (req.user?.email || req.headers["x-user"] || req.ip)) || "system";
    await prisma.event.create({
      data: {
        type,
        actor: String(actor),
        metadata,
        ...(incidentId ? { incident: { connect: { id: Number(incidentId) } } } : {}),
      },
    });
  } catch (err) {
    // don’t crash user flows on analytics failure
    console.warn("[analytics] logEvent failed:", err?.message || err);
  }
}
