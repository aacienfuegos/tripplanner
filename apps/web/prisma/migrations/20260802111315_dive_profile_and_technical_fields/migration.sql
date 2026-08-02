-- CreateEnum
CREATE TYPE "DiveCurrent" AS ENUM ('NONE', 'LIGHT', 'MODERATE', 'STRONG');

-- CreateEnum
CREATE TYPE "DiveEntryType" AS ENUM ('SHORE', 'BOAT');

-- AlterTable
ALTER TABLE "DiveLog" ADD COLUMN     "boat" TEXT,
ADD COLUMN     "cnsPercent" INTEGER,
ADD COLUMN     "current" "DiveCurrent",
ADD COLUMN     "decoRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "divemaster" TEXT,
ADD COLUMN     "entryType" "DiveEntryType",
ADD COLUMN     "maxPpo2" DOUBLE PRECISION,
ADD COLUMN     "minPpo2" DOUBLE PRECISION,
ADD COLUMN     "safetyStopMinutes" INTEGER,
ADD COLUMN     "visibilityHorizontal" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "DiveProfileSample" (
    "id" TEXT NOT NULL,
    "diveLogId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "depth" DOUBLE PRECISION NOT NULL,
    "temp" DOUBLE PRECISION,

    CONSTRAINT "DiveProfileSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiveProfileSample_diveLogId_seconds_idx" ON "DiveProfileSample"("diveLogId", "seconds");

-- AddForeignKey
ALTER TABLE "DiveProfileSample" ADD CONSTRAINT "DiveProfileSample_diveLogId_fkey" FOREIGN KEY ("diveLogId") REFERENCES "DiveLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
