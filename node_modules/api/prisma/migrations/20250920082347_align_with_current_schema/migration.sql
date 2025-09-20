/*
  Warnings:

  - You are about to drop the column `reporterId` on the `Incident` table. All the data in the column will be lost.
  - Made the column `description` on table `Incident` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `Priority` on the `SLA` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."Incident" DROP COLUMN "reporterId",
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."SLA" DROP COLUMN "Priority",
ADD COLUMN     "Priority" "public"."Priority" NOT NULL;

-- CreateTable
CREATE TABLE "public"."Event" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incident_assetId_idx" ON "public"."Incident"("assetId");

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "public"."Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
