// FILE: api/src/jobs/sla.ts
// SLA job implementation using BullMQ, Prisma, and Nodemailer.
// Note: The schema has models `incident` and `asset`; there is no `workOrder`.
// This worker flags overdue incidents instead of non-existent work orders.

import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import nodemailer from "nodemailer";
import { prisma } from "../db";
import { cfg } from "../config";

// Redis connection shared by queue and worker
const connection = new IORedis(cfg.redisUrl, { maxRetriesPerRequest: null });

export const slaQueue = new Queue("sla", { connection });

// Basic mailer (MailHog in docker-compose by default)
const mailer = nodemailer.createTransport({
  host: cfg.smtpHost,
  port: cfg.smtpPort,
  secure: false,
});

// Threshold for considering an incident overdue (minutes)
const DEFAULT_SLA_MINUTES = 30;

export async function enqueueSlaOverdueCheck() {
  await slaQueue.add("overdue", {}, {
    removeOnComplete: true,
    removeOnFail: 50,
  });
}

export function startSlaWorker() {
  const worker = new Worker(
    "sla",
    async (job) => {
      if (job.name !== "overdue") return;
      await runSlaCheck();
    },
    { connection }
  );
  return worker;
}

export async function runSlaCheck(options?: { thresholdMinutes?: number }) {
  const thresholdMinutes = options?.thresholdMinutes ?? DEFAULT_SLA_MINUTES;
  const threshold = new Date(Date.now() - thresholdMinutes * 60_000);

  // Find incidents older than threshold that are not closed/resolved
  const overdue = await prisma.incident.findMany({
    where: {
      createdAt: { lt: threshold },
      status: { notIn: ["RESOLVED", "CLOSED"] },
    },
    select: { id: true, title: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  if (overdue.length === 0) {
    return { updated: 0, checked: 0, thresholdMinutes };
  }

  let updated = 0;
  for (const inc of overdue) {
    // Example action: move OPEN incidents to IN_PROGRESS
    if (inc.status === "OPEN") {
      await prisma.incident.update({
        where: { id: inc.id },
        data: { status: "IN_PROGRESS" },
      });
      updated += 1;
    }

    // Notify via email
    await mailer.sendMail({
      from: "sla-bot@i2r.local",
      to: cfg.slaEmailTo,
      subject: `SLA escalation: Incident #${inc.id}`,
      text: `Incident #${inc.id} (\"${inc.title}\") is overdue and currently ${inc.status}.`,
    });
  }

  return { updated, checked: overdue.length, thresholdMinutes };
}

// Optional: run directly for ad-hoc checks
if (require.main === module) {
  runSlaCheck()
    .then((r) => {
      console.log(
        `SLA check done. Checked=${r.checked} Updated=${r.updated} Threshold=${r.thresholdMinutes}m`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("SLA check failed:", err);
      process.exit(1);
    });
}
