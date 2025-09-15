// FILE: api/src/routes/analytics.js
// CSV analytics endpoints

import { prisma } from "../db.js";
import { toCsv } from "../analytics.js";

function setCsvHeaders(res, filename) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
}

/**
 * Attach /analytics routes to the Express app.
 *  - /analytics/daily.csv
 *  - /analytics/by-asset.csv
 *  - /analytics/sla.csv
 */
export function attachAnalyticsRoutes(app) {
  // Daily counts by status + priority (one row per day/status/priority)
  app.get("/analytics/daily.csv", async (_req, res) => {
    try {
      const rows =
        await prisma.$queryRawUnsafe(`
          SELECT
            (date_trunc('day', "createdAt"))::date AS day,
            "status"::text AS status,
            "priority"::text AS priority,
            count(*)::int AS count
          FROM "Incident"
          GROUP BY 1,2,3
          ORDER BY 1 DESC, 2, 3
        `);

      const columns = ["day", "status", "priority", "count"];
      setCsvHeaders(res, "daily.csv");
      res.send(toCsv(rows, columns));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Counts by asset (id/name/type)
  app.get("/analytics/by-asset.csv", async (_req, res) => {
    try {
      const rows =
        await prisma.$queryRawUnsafe(`
          SELECT
            i."assetId",
            a."name" AS assetName,
            a."type" AS assetType,
            count(*)::int AS count
          FROM "Incident" i
          LEFT JOIN "Asset" a ON a."id" = i."assetId"
          GROUP BY i."assetId", a."name", a."type"
          ORDER BY count DESC NULLS LAST
        `);

      const columns = ["assetId", "assetName", "assetType", "count"];
      setCsvHeaders(res, "by-asset.csv");
      res.send(toCsv(rows, columns));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // SLA snapshot: OPEN/IN_PROGRESS older than SLA_HOURS_OPEN
  app.get("/analytics/sla.csv", async (_req, res) => {
    try {
      const hours = Number(process.env.SLA_HOURS_OPEN ?? 24);
      const rows =
        await prisma.$queryRawUnsafe(
          `
          SELECT
            "id",
            "title",
            "status"::text AS status,
            "priority"::text AS priority,
            "assetId",
            "createdAt"
          FROM "Incident"
          WHERE "status" IN ('OPEN','IN_PROGRESS')
            AND "createdAt" < (now() - ($1 || ' hours')::interval)
          ORDER BY "createdAt" ASC
        `,
          String(hours),
        );

      const columns = ["id", "title", "status", "priority", "assetId", "createdAt"];
      setCsvHeaders(res, "sla.csv");
      res.send(toCsv(rows, columns));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
