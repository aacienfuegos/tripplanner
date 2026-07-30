-- CreateTable
CREATE TABLE "DiveEquipmentService" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiveEquipmentService_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DiveEquipmentService" ADD CONSTRAINT "DiveEquipmentService_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiveEquipmentService" ADD CONSTRAINT "DiveEquipmentService_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "DiveEquipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
