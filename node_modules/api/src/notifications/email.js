// ADD: alert email when an incident has remained OPEN beyond the threshold
export async function sendOpenStaleEmail({ to, incidentId, minutes }) {
  return send({
    to,
    subject: `Incident #${incidentId}: still OPEN after ${minutes} min`,
    text:
`Incident #${incidentId} has remained OPEN for ~${minutes} minutes.
Please acknowledge and change the status to IN_PROGRESS.

Link: ${process.env.PUBLIC_WEB_ORIGIN || "http://localhost:5173"}/`,
  });
}
