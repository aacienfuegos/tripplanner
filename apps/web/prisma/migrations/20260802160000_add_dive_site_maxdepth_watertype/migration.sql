-- CreateEnum
CREATE TYPE "WaterType" AS ENUM ('SALT', 'FRESH', 'BRACKISH', 'CHLORINATED');

-- AlterTable
ALTER TABLE "DiveSite" ADD COLUMN     "maxDepth" DOUBLE PRECISION,
ADD COLUMN     "waterType" "WaterType";
