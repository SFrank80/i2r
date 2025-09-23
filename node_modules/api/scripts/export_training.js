// api/scripts/export_training.js
// Export incidents (title + description + priority) to CSV for model training.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../src/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.join(__dirname, "..", "data");
const OUT_FILE = path.join(OUT_DIR, "training.csv");

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const rows = await prisma.incident.findMany({
    select: { title: true, description: true, priority: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  // Keep only rows with some text and known priority
  const clean = rows
    .filter((r) => (r.title || r.description) && r.priority)
    .map((r) => ({
      text: `${r.title ?? ""} ${r.description ?? ""}`.replace(/\s+/g, " ").trim(),
      priority: r.priority,
    }))
    .filter((r) => r.text.length >= 8);

  const header = "text,priority\n";
  const body = clean
    .map((r) =>
      `"${r.text.replace(/"/g, '""')}",${r.priority}` // quote text in case of commas
    )
    .join("\n");

  fs.writeFileSync(OUT_FILE, header + body, "utf8");
  console.log(`Wrote ${clean.length} rows to ${OUT_FILE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
