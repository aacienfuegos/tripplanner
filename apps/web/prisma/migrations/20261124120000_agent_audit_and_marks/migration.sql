-- CreateEnum
CREATE TYPE "AgentAuditAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'SUGGESTED');

-- AlterTable
ALTER TABLE "Accommodation" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "Destination" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "DiveArea" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "DiveCertification" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "DiveEquipment" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "DiveEquipmentService" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "DiveLog" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "DiveSite" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "Flight" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "PackingItem" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "agentGrantId" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "agentGrantId" TEXT;

-- CreateTable
CREATE TABLE "AgentAuditEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tripId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AgentAuditAction" NOT NULL,
    "changes" JSONB,
    "snapshot" JSONB,
    "restoredAt" TIMESTAMP(3),

    CONSTRAINT "AgentAuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentAuditEntry_userId_createdAt_idx" ON "AgentAuditEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentAuditEntry_grantId_action_createdAt_idx" ON "AgentAuditEntry"("grantId", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentAuditEntry" ADD CONSTRAINT "AgentAuditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
