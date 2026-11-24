-- CreateEnum
CREATE TYPE "SuitcaseType" AS ENUM ('CABIN', 'CHECKED', 'BACKPACK', 'OTHER');

-- AlterTable
ALTER TABLE "PackingItem" ADD COLUMN     "suitcaseId" TEXT;

-- CreateTable
CREATE TABLE "Suitcase" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SuitcaseType" NOT NULL DEFAULT 'OTHER',
    "weightGrams" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suitcase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suitcase_tripId_idx" ON "Suitcase"("tripId");

-- CreateIndex
CREATE INDEX "PackingItem_suitcaseId_idx" ON "PackingItem"("suitcaseId");

-- AddForeignKey
ALTER TABLE "PackingItem" ADD CONSTRAINT "PackingItem_suitcaseId_fkey" FOREIGN KEY ("suitcaseId") REFERENCES "Suitcase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suitcase" ADD CONSTRAINT "Suitcase_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
