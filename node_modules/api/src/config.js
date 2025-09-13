// FILE: api/src/config.js
import "dotenv/config";

export const cfg = {
  // Redis for BullMQ (use REDIS_URL if set, otherwise host/port)
  redisUrl:
    process.env.REDIS_URL ??
    `redis://${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? 6379}`,

  // SMTP (MailHog)
  smtpHost: process.env.SMTP_HOST ?? "localhost",
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),

  // who to email (demo)
  slaEmailTo: process.env.SLA_EMAIL_TO ?? "dispatcher@example.com",
};
