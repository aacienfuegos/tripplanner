-- AlterTable
ALTER TABLE "DiveSite" ADD COLUMN     "diveAreaId" TEXT;

-- CreateTable
CREATE TABLE "DiveArea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiveArea_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DiveArea" ADD CONSTRAINT "DiveArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiveSite" ADD CONSTRAINT "DiveSite_diveAreaId_fkey" FOREIGN KEY ("diveAreaId") REFERENCES "DiveArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
