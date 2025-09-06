// FILE: api/src/db.ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ["error", "warn"], // add "query" if you want to see SQL
});
