-- CreateEnum
CREATE TYPE "AgentSuggestionKind" AS ENUM ('ACCOMMODATION', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "AgentSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "AgentSuggestion" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "kind" "AgentSuggestionKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "AgentSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resultId" TEXT,

    CONSTRAINT "AgentSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentSuggestion_tripId_status_idx" ON "AgentSuggestion"("tripId", "status");

-- AddForeignKey
ALTER TABLE "AgentSuggestion" ADD CONSTRAINT "AgentSuggestion_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
