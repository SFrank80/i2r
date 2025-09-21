// FILE: api/src/notifications/index.js
import nodemailer from "nodemailer";

function makeTransport() {
  const url = process.env.SMTP_URL || process.env.MAIL_URL;
  if (url) return nodemailer.createTransport(url);

  const host = process.env.SMTP_HOST || "localhost";
  const port = Number(process.env.SMTP_PORT || 1025);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: user && pass ? { user, pass } : undefined,
  });
}

const transport = makeTransport();
const FROM = process.env.NOTIFY_FROM || process.env.SLA_ALERT_FROM || "no-reply@i2r.local";
const DEFAULT_TO = process.env.NOTIFY_TO || process.env.SLA_ALERT_TO || "alerts@example.com";

async function send(to, subject, text) {
  const info = await transport.sendMail({
    from: FROM,
    to: to || DEFAULT_TO,
    subject,
    text,
  });
  return info?.messageId;
}

export async function notifyIncidentCreated(incident) {
  const subject = `[i2r] New incident #${incident.id}: ${incident.title}`;
  const text =
    `A new incident was created.\n\n` +
    `ID: ${incident.id}\n` +
    `Title: ${incident.title}\n` +
    `Priority: ${incident.priority}\n` +
    `Status: ${incident.status}\n` +
    `Asset: ${incident.assetId ?? "—"}\n` +
    `Created: ${incident.createdAt?.toISOString?.() || new Date().toISOString()}\n`;
  return send(undefined, subject, text);
}

export async function notifyAssignment(incidentId, assetId) {
  const subject = `[i2r] Incident #${incidentId} ${assetId ? "assigned" : "unassigned"}`;
  const text = assetId
    ? `Incident #${incidentId} has been assigned to asset #${assetId}.`
    : `Incident #${incidentId} has been unassigned.`;
  return send(undefined, subject, text);
}

export async function notifyStatusChange(incidentId, status) {
  const subject = `[i2r] Incident #${incidentId} status → ${status}`;
  const text = `Incident #${incidentId} status changed to ${status}.`;
  return send(undefined, subject, text);
}

export async function notifyOpenStale({ incidentId, minutes }) {
  const subject = `[i2r] Incident #${incidentId} still OPEN after ${minutes} minutes`;
  const text = `Please acknowledge and move to IN_PROGRESS.\nIncident #${incidentId}.`;
  return send(undefined, subject, text);
}
