// api/prisma/seed.js
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { faker } = require("@faker-js/faker");

const prisma = new PrismaClient();

async function main() {
  // 1) Create N unique users (emails are unique per run via timestamp)
  const N_USERS = 10;
  const TS = Date.now(); // makes emails unique each run

  const emails = Array.from({ length: N_USERS }).map(
    (_, i) => `seed-${TS}-${i}@example.com`
  );
  const usersData = emails.map((email) => ({
    email,
    name: faker.person.fullName(),
  }));

  await prisma.user.createMany({
    data: usersData,
    // if a previous run used the same TS (very unlikely), this prevents throwing
    skipDuplicates: true,
  });

  // Fetch the users we just created so we have their ids
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    orderBy: { id: "asc" },
  });

  // 2) Create some incidents referencing those users
  const PRIORITY = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const N_INC = 50;

  const incData = Array.from({ length: N_INC }).map((_, i) => {
    const u = users[i % users.length];
    return {
      title: faker.lorem.words({ min: 2, max: 5 }),
      description: faker.lorem.sentences({ min: 1, max: 2 }),
      priority: PRIORITY[i % PRIORITY.length],
      status: "OPEN",
      lon: Number(faker.location.longitude()),
      lat: Number(faker.location.latitude()),
      reporterId: u.id,
    };
  });

  await prisma.incident.createMany({ data: incData });

  console.log(`✔ Seeded ${users.length} users and ${incData.length} incidents`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
