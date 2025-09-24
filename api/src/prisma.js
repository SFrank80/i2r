// api/src/prisma.js
import { PrismaClient } from "@prisma/client";

// prevent creating many clients during nodemon reloads
const prisma = globalThis.__i2rPrisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__i2rPrisma = prisma;
}

export default prisma;
