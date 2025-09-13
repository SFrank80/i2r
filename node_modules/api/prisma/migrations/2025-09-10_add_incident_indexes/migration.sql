-- FILE: api/prisma/migrations/2025-09-10_add_incident_indexes/migration.sql
-- Safe indexes for faster filters & SLA scans.
-- Works on PostgreSQL. Quotes keep Prisma's default case-sensitive table names.

CREATE INDEX IF NOT EXISTS "Incident_status_idx"         ON "Incident" ("status");
CREATE INDEX IF NOT EXISTS "Incident_priority_idx"       ON "Incident" ("priority");
CREATE INDEX IF NOT EXISTS "Incident_assetId_idx"        ON "Incident" ("assetId");
CREATE INDEX IF NOT EXISTS "Incident_createdAt_idx"      ON "Incident" ("createdAt");
CREATE INDEX IF NOT EXISTS "Incident_status_created_idx" ON "Incident" ("status", "createdAt");
