-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('VIDEO', 'PHOTO');

-- CreateEnum
CREATE TYPE "OffsetSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "MediaClip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "sizeBytes" BIGINT,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaClipLink" (
    "clipId" TEXT NOT NULL,
    "diveLogId" TEXT NOT NULL,
    "included" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaClipLink_pkey" PRIMARY KEY ("clipId","diveLogId")
);

-- CreateTable
CREATE TABLE "DayClockOffset" (
    "userId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "source" "OffsetSource" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayClockOffset_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE INDEX "MediaClip_userId_capturedAt_idx" ON "MediaClip"("userId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaClip_userId_path_key" ON "MediaClip"("userId", "path");

-- CreateIndex
CREATE INDEX "MediaClipLink_diveLogId_idx" ON "MediaClipLink"("diveLogId");

-- AddForeignKey
ALTER TABLE "MediaClip" ADD CONSTRAINT "MediaClip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaClipLink" ADD CONSTRAINT "MediaClipLink_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "MediaClip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaClipLink" ADD CONSTRAINT "MediaClipLink_diveLogId_fkey" FOREIGN KEY ("diveLogId") REFERENCES "DiveLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayClockOffset" ADD CONSTRAINT "DayClockOffset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
