-- CreateEnum
CREATE TYPE "OAuthClientKind" AS ENUM ('MANUAL', 'CIMD');

-- CreateEnum
CREATE TYPE "AgentGrantRevokedReason" AS ENUM ('USER', 'CLIENT_DELETED', 'TOKEN_REUSE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OAuthTokenKind" AS ENUM ('ACCESS', 'REFRESH');

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" "OAuthClientKind" NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "ownerUserId" TEXT,
    "metadataFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allTrips" BOOLEAN NOT NULL,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" "AgentGrantRevokedReason",

    CONSTRAINT "AgentGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentGrantTrip" (
    "grantId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,

    CONSTRAINT "AgentGrantTrip_pkey" PRIMARY KEY ("grantId","tripId")
);

-- CreateTable
CREATE TABLE "OAuthAuthorizationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "state" TEXT,
    "resource" TEXT NOT NULL,
    "requestedScopes" TEXT[],
    "csrfTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthAuthorizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthCode" (
    "codeHash" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthCode_pkey" PRIMARY KEY ("codeHash")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "tokenHash" TEXT NOT NULL,
    "kind" "OAuthTokenKind" NOT NULL,
    "grantId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "OAuthClient_ownerUserId_idx" ON "OAuthClient"("ownerUserId");

-- CreateIndex
CREATE INDEX "AgentGrant_userId_idx" ON "AgentGrant"("userId");

-- CreateIndex
CREATE INDEX "AgentGrant_clientId_idx" ON "AgentGrant"("clientId");

-- CreateIndex
CREATE INDEX "AgentGrantTrip_tripId_idx" ON "AgentGrantTrip"("tripId");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationRequest_userId_idx" ON "OAuthAuthorizationRequest"("userId");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationRequest_clientId_idx" ON "OAuthAuthorizationRequest"("clientId");

-- CreateIndex
CREATE INDEX "OAuthCode_grantId_idx" ON "OAuthCode"("grantId");

-- CreateIndex
CREATE INDEX "OAuthToken_grantId_idx" ON "OAuthToken"("grantId");

-- AddForeignKey
ALTER TABLE "OAuthClient" ADD CONSTRAINT "OAuthClient_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGrant" ADD CONSTRAINT "AgentGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGrant" ADD CONSTRAINT "AgentGrant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGrantTrip" ADD CONSTRAINT "AgentGrantTrip_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "AgentGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGrantTrip" ADD CONSTRAINT "AgentGrantTrip_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationRequest" ADD CONSTRAINT "OAuthAuthorizationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationRequest" ADD CONSTRAINT "OAuthAuthorizationRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthCode" ADD CONSTRAINT "OAuthCode_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "AgentGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "AgentGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
