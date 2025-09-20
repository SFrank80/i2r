// FILE: api/src/db.js
// Prisma singleton for ESM + nodemon hot reload (Windows-safe)
import { PrismaClient } from "@prisma/client";

function getLogLevels() {
  return process.env.PRISMA_LOG
    ? process.env.PRISMA_LOG.split(",").map((s) => s.trim()).filter(Boolean)
    : ["warn", "error"];
}

// Reuse the same instance in dev to avoid multiple connections
const prismaClient =
  globalThis.__PRISMA__ ?? new PrismaClient({ log: getLogLevels() });

if (!globalThis.__PRISMA__) {
  globalThis.__PRISMA__ = prismaClient;
}

// Export both named and default (same instance)
export { prismaClient as prisma };
export default prismaClient;

// Optional: graceful shutdown (skip in tests)
if (process.env.NODE_ENV !== "test") {
  const shutdown = async () => {
    try { await prismaClient.$disconnect(); } catch { /* ignore */ }
  };
  for (const sig of ["SIGINT", "SIGTERM", "SIGQUIT"]) {
    process.once(sig, shutdown);
  }
}
