// FILE: api/src/db.js
import { PrismaClient } from "@prisma/client";

// Named export (and default below) so ESM imports like `import { prisma } from "../db.js"`
export const prisma = new PrismaClient({
  log: ["warn", "error"],
});

// Optional: graceful shutdown so the client disconnects cleanly
if (process.env.NODE_ENV !== "test") {
  let shuttingDown = false;

  const cleanup = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await prisma.$disconnect();
    } catch (err) {
      console.warn("[prisma] disconnect failed:", err?.message || err);
    }
    if (signal) process.exit(0);
  };

  for (const s of ["SIGINT", "SIGTERM", "SIGQUIT"]) {
    process.once(s, cleanup);
  }
}

// Also export a default for modules that do `import prisma from "../db.js"`
export default prisma;
