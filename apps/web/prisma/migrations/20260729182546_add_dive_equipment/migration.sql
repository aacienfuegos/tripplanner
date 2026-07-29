-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('WETSUIT', 'BCD', 'REGULATOR', 'COMPUTER', 'FINS', 'MASK', 'TANK', 'WEIGHT', 'TORCH', 'CAMERA', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('OWNED', 'WISHLIST', 'RETIRED', 'SOLD');

-- CreateTable
CREATE TABLE "DiveEquipment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "size" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'OWNED',
    "lastServiceDate" TIMESTAMP(3),
    "serviceIntervalMonths" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiveEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DiveEquipmentToDiveLog" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DiveEquipmentToDiveLog_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DiveEquipmentToDiveLog_B_index" ON "_DiveEquipmentToDiveLog"("B");

-- AddForeignKey
ALTER TABLE "DiveEquipment" ADD CONSTRAINT "DiveEquipment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DiveEquipmentToDiveLog" ADD CONSTRAINT "_DiveEquipmentToDiveLog_A_fkey" FOREIGN KEY ("A") REFERENCES "DiveEquipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DiveEquipmentToDiveLog" ADD CONSTRAINT "_DiveEquipmentToDiveLog_B_fkey" FOREIGN KEY ("B") REFERENCES "DiveLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
