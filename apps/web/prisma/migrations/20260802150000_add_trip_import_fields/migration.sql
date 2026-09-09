-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" "DiveSource" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE UNIQUE INDEX "Trip_userId_externalId_key" ON "Trip"("userId", "externalId");

