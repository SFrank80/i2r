// FILE: api/scripts/englishify.js
// Converts any non-English-looking Incident titles to readable English.
// Heuristic: our English seed titles contain " at " (e.g., "Valve service at Main St Baltimore").

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { faker } = require("@faker-js/faker");

const prisma = new PrismaClient();

function englishTitle() {
  const actions = [
    "Water main break",
    "Hydrant repair",
    "Valve service",
    "Pump maintenance",
    "Sensor outage",
    "Road closure",
    "Storm cleanup",
    "Downed line",
  ];
  const where = faker.location.street() + " " + faker.location.city();
  return faker.helpers.arrayElement(actions) + " at " + where;
}

(async () => {
  try {
    const rows = await prisma.incident.findMany({ select: { id: true, title: true } });
    let changed = 0;
    for (const r of rows) {
      if (!r.title || !/\sat\s/i.test(r.title)) {
        await prisma.incident.update({
          where: { id: r.id },
          data: { title: englishTitle() },
        });
        changed++;
      }
    }
    console.log(`✓ Titles refreshed: ${changed} updated, ${rows.length - changed} left as-is.`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
