-- FILE: api/sql/convert_incident_enums.sql
-- Goal: keep existing rows while converting Incident.priority/status to Prisma enums.
-- Run this in Adminer or psql against your i2r database.

BEGIN;

-- 1) Normalize existing strings so they match enum labels
--    (handles lowercase, spaces, and dashes)
UPDATE "Incident"
SET "priority" = UPPER(REPLACE(REPLACE("priority"::text, '-', '_'), ' ', '_'))
WHERE "priority" IS NOT NULL;

UPDATE "Incident"
SET "status" = UPPER(REPLACE(REPLACE("status"::text, '-', '_'), ' ', '_'))
WHERE "status" IS NOT NULL;

-- 2) Create enum types if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Priority') THEN
    CREATE TYPE "Priority" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentStatus') THEN
    CREATE TYPE "IncidentStatus" AS ENUM ('OPEN','IN_PROGRESS','RESOLVED','CLOSED');
  END IF;
END$$;

-- 3) Convert columns to the new enum types (casts via text)
--    If they are already the correct enum type, these statements will be skipped by the DO blocks.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'Incident' AND column_name = 'priority' AND udt_name <> 'Priority'
  ) THEN
    ALTER TABLE "Incident"
      ALTER COLUMN "priority" TYPE "Priority"
      USING UPPER(REPLACE(REPLACE("priority"::text, '-', '_'), ' ', '_'))::"Priority";
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'Incident' AND column_name = 'status' AND udt_name <> 'IncidentStatus'
  ) THEN
    ALTER TABLE "Incident"
      ALTER COLUMN "status" TYPE "IncidentStatus"
      USING UPPER(REPLACE(REPLACE("status"::text, '-', '_'), ' ', '_'))::"IncidentStatus";
  END IF;
END$$;

COMMIT;
