import request from "supertest";
import app from "../src/index.js";
import { prisma } from "../src/db.js";

beforeAll(async () => {
  // ensure DB is reachable; in CI we run migrate before tests
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

test("create -> list -> update status -> assign asset", async () => {
  // create
  const create = await request(app)
    .post("/incidents")
    .send({
      title: "e2e test incident",
      description: "created from jest",
      priority: "MEDIUM",
      status: "OPEN",
      lon: -76.61,
      lat: 39.29,
    })
    .expect(201);

  const id = create.body.id;
  expect(id).toBeGreaterThan(0);

  // list
  const list = await request(app).get("/incidents").expect(200);
  expect(list.body.items.some((it) => it.id === id)).toBe(true);

  // update status
  await request(app).patch(`/incidents/${id}`).send({ status: "IN_PROGRESS" }).expect(200);

  // assign asset (pick an existing asset id or null)
  await request(app).patch(`/incidents/${id}`).send({ assetId: null }).expect(200);
});
