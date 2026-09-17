
-- DropForeignKey
ALTER TABLE "DayClockOffset" DROP CONSTRAINT "DayClockOffset_userId_fkey";

-- DropTable
DROP TABLE "DayClockOffset";

-- CreateTable
CREATE TABLE "MediaSiteOffset" (
    "userId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "source" "OffsetSource" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaSiteOffset_pkey" PRIMARY KEY ("userId","day")
);

-- AddForeignKey
ALTER TABLE "MediaSiteOffset" ADD CONSTRAINT "MediaSiteOffset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

