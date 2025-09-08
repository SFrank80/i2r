// FILE: api/src/config.ts
import "dotenv/config";

export const cfg = {
  // Redis for BullMQ
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  // SMTP (MailHog)
  smtpHost: process.env.SMTP_HOST ?? "localhost",
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),

  // who to email (for demo)
  slaEmailTo: process.env.SLA_EMAIL_TO ?? "dispatcher@example.com",
};
