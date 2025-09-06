// FILE: api/prisma/seed.js (CommonJS)
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { faker } = require("@faker-js/faker");

const prisma = new PrismaClient();

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function englishTitle() {
  // Plain-English titles
  const actions = [
    "Water leak",
    "Hydrant leak",
    "Valve stuck",
    "Pump failure",
    "Sensor offline",
    "Traffic incident",
    "Tree down",
    "Road flooding",
  ];
  const where = `${faker.location.street()} ${faker.location.city()}`;
  return `${faker.helpers.arrayElement(actions)} at ${where}`;
}

async function main() {
  // 1) Users
  const users = await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      prisma.user.upsert({
        where: { email: `user${i + 1}@example.com` },
        update: {},
        create: { email: `user${i + 1}@example.com`, name: faker.person.fullName() },
      })
    )
  );

  // 2) Assets (ensure ~50)
  const haveAssets = await prisma.asset.count();
  if (haveAssets < 50) {
    await prisma.asset.createMany({
      data: Array.from({ length: 50 }).map(() => ({
        name: `${faker.word.adjective()} ${faker.word.noun()}`.slice(0, 40),
        type: faker.helpers.arrayElement(["Hydrant", "Valve", "Pump", "Sensor", "Manhole"]),
        lon: Number(faker.location.longitude()),
        lat: Number(faker.location.latitude()),
        status: "ACTIVE",
        updatedAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  const assets = await prisma.asset.findMany({ select: { id: true } });

  // 3) Incidents (ensure ~50)
  const haveInc = await prisma.incident.count();
  const missing = Math.max(0, 50 - haveInc);
  if (missing > 0) {
    await prisma.$transaction(
      Array.from({ length: missing }).map(() => {
        const prio = faker.helpers.arrayElement(PRIORITIES);
        const stat = faker.helpers.arrayElement(STATUSES);
        const maybeAsset = Math.random() < 0.5 ? faker.helpers.arrayElement(assets).id : null;
        return prisma.incident.create({
          data: {
            title: englishTitle(),
            description: faker.lorem.sentence(),
            priority: prio,
            status: stat,
            reporterId: faker.number.int({ min: users[0].id, max: users[users.length - 1].id }),
            assetId: maybeAsset,
            lon: Number(faker.location.longitude()),
            lat: Number(faker.location.latitude()),
          },
        });
      })
    );
  }

  console.log("✓ Seed complete: users, assets, incidents");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
