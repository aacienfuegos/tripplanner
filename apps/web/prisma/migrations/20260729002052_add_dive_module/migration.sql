-- CreateEnum
CREATE TYPE "DiveSource" AS ENUM ('MANUAL', 'IMPORTED');

-- CreateEnum
CREATE TYPE "GasMix" AS ENUM ('AIR', 'NITROX', 'TRIMIX', 'OXYGEN');

-- CreateTable
CREATE TABLE "DiveSite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "country" TEXT,
    "region" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "source" "DiveSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiveSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiveLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT,
    "diveSiteId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "diveNumber" INTEGER NOT NULL,
    "depthMax" DOUBLE PRECISION NOT NULL,
    "bottomTime" INTEGER NOT NULL,
    "surfaceInterval" INTEGER,
    "gasMix" "GasMix" NOT NULL,
    "o2Percentage" INTEGER,
    "heliumPercentage" INTEGER,
    "pressureStart" INTEGER,
    "pressureEnd" INTEGER,
    "waterTemp" DOUBLE PRECISION,
    "airTemp" DOUBLE PRECISION,
    "visibility" DOUBLE PRECISION,
    "diveType" TEXT,
    "buddyName" TEXT,
    "suitType" TEXT,
    "weight" DOUBLE PRECISION,
    "notes" TEXT,
    "rating" INTEGER,
    "source" "DiveSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiveLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiveCertification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "certNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "instructorName" TEXT,
    "notes" TEXT,
    "source" "DiveSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiveCertification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiveSite_userId_externalId_key" ON "DiveSite"("userId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "DiveLog_userId_externalId_key" ON "DiveLog"("userId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "DiveCertification_userId_externalId_key" ON "DiveCertification"("userId", "externalId");

-- AddForeignKey
ALTER TABLE "DiveSite" ADD CONSTRAINT "DiveSite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiveLog" ADD CONSTRAINT "DiveLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiveLog" ADD CONSTRAINT "DiveLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiveLog" ADD CONSTRAINT "DiveLog_diveSiteId_fkey" FOREIGN KEY ("diveSiteId") REFERENCES "DiveSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiveCertification" ADD CONSTRAINT "DiveCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
