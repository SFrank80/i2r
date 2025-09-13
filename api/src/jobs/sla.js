// SLA worker + scheduler for incident aging alerts (BullMQ v4 – no QueueScheduler)
// - Schedules a repeatable job (default: every 5 minutes)
// - Scans for incidents that violate a simple SLA window
// - Sends an email summary via SMTP (MailHog by default)

import { Queue, Worker } from "bullmq";
import nodemailer from "nodemailer";
import { prisma } from "../db.js";

/* -------------------------------------------------------------------------- */
/* Redis connection                                                           */
/* -------------------------------------------------------------------------- */
// Prefer REDIS_URL when provided (e.g., "redis://localhost:6379")
// Otherwise use host/port (defaults to 'redis' for docker-compose, or 'localhost')
function getRedisConnection() {
  if (process.env.REDIS_URL) return { url: process.env.REDIS_URL };

  const host =
    process.env.REDIS_HOST ||
    (process.env.DOCKER === "1" ? "redis" : "localhost");
  const port = Number(process.env.REDIS_PORT || 6379);
  return { host, port };
}

const QUEUE_NAME = process.env.SLA_QUEUE_NAME || "sla-checks";

// Create the queue; if Redis/DNS is unavailable, don’t crash
let queue = null;
try {
  queue = new Queue(QUEUE_NAME, { connection: getRedisConnection() });
} catch (err) {
  console.warn("[SLA] Queue init failed:", err?.message);
}

/* -------------------------------------------------------------------------- */
/* SMTP transport (MailHog-friendly defaults)                                 */
/* -------------------------------------------------------------------------- */
function makeTransport() {
  const smtpUrl = process.env.SMTP_URL || process.env.MAIL_URL;
  if (smtpUrl) return nodemailer.createTransport(smtpUrl);

  const host = process.env.SMTP_HOST || process.env.MAIL_HOST || "mailhog";
  const port = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 1025);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: user && pass ? { user, pass } : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */
export async function scheduleSlaCheck() {
  if (!queue) {
    console.warn("[SLA] scheduleSlaCheck skipped – queue not available (Redis?)");
    return;
  }

  const pattern = process.env.SLA_CHECK_CRON || "*/5 * * * *"; // every 5 minutes
  const jobName = "scan";

  try {
    // Ensure only one repeatable exists with same key
    const existing = await queue.getRepeatableJobs();
    for (const r of existing) {
      if (r.name === jobName && r.pattern === pattern) {
        await queue.removeRepeatable(jobName, { pattern });
      }
    }

    await queue.add(
      jobName,
      {},
      {
        repeat: { pattern },
        removeOnComplete: 25,
        removeOnFail: 100,
      },
    );

    console.log(`[SLA] Scheduled repeatable job '${jobName}' with pattern '${pattern}'`);
  } catch (err) {
    console.warn("[SLA] scheduleSlaCheck failed:", err?.message || err);
  }
}

export function startSlaWorker() {
  if (!queue) {
    console.warn("[SLA] startSlaWorker skipped – queue not available (Redis?)");
    return null;
  }

  const thresholdHours = Number(process.env.SLA_HOURS_OPEN || 24);
  const toEmail = process.env.SLA_ALERT_TO || "alerts@example.com";
  const fromEmail = process.env.SLA_ALERT_FROM || "i2r@local";
  const transport = makeTransport();

  const worker = new Worker(
    queue.name,
    async (job) => {
      if (job.name !== "scan") return { skipped: true };

      const now = new Date();
      const cutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);

      const offenders = await prisma.incident.findMany({
        where: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
          createdAt: { lt: cutoff },
        },
        orderBy: { createdAt: "asc" },
        take: 500,
      });

      if (offenders.length === 0) {
        return { scanned: 0, cutoff: cutoff.toISOString() };
      }

      const lines = offenders.map(
        (r) =>
          `#${r.id} | ${r.status} | ${r.priority} | ${r.title} | created ${r.createdAt.toISOString()}`,
      );

      const info = await transport.sendMail({
        to: toEmail,
        from: fromEmail,
        subject: `[i2r] SLA aging incidents (> ${thresholdHours}h): ${offenders.length}`,
        text:
          `The following incidents exceed ${thresholdHours}h since creation ` +
          `(cutoff ${cutoff.toISOString()}):\n\n` +
          `${lines.join("\n")}\n\n— i2r SLA bot`,
      });

      return {
        scanned: offenders.length,
        cutoff: cutoff.toISOString(),
        messageId: info?.messageId,
      };
    },
    { connection: getRedisConnection() },
  );

  worker.on("failed", (job, err) => {
    console.error(`[SLA] Job ${job?.id} failed:`, err);
  });
  worker.on("completed", (job, res) => {
    console.log(`[SLA] Job ${job.id} completed:`, res);
  });

  console.log(
    `[SLA] Worker started on queue '${queue.name}' (threshold ${thresholdHours}h)`,
  );
  return worker;
}
