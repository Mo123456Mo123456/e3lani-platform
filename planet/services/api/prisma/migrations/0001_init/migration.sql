-- كوكب يولد أمامك — initial schema
-- Generated via prisma migrate diff, extensions prepended.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "roleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "avatarUrl" TEXT,
    "impactScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "titles" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "currentTick" INTEGER NOT NULL DEFAULT 0,
    "yearsPerTick" INTEGER NOT NULL DEFAULT 1,
    "era" TEXT NOT NULL DEFAULT 'genesis',
    "gridWidth" INTEGER NOT NULL,
    "gridHeight" INTEGER NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanetRegion" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "cellIndex" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "biome" TEXT NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL,
    "pollution" DOUBLE PRECISION NOT NULL,
    "fertility" DOUBLE PRECISION NOT NULL,
    "river" BOOLEAN NOT NULL DEFAULT false,
    "civEngineId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanetRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Biome" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "habitability" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Biome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClimateCell" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "cellIndex" INTEGER NOT NULL,
    "tick" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL,
    "pollution" DOUBLE PRECISION NOT NULL,
    "ice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ClimateCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Species" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "engineId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "population" DOUBLE PRECISION NOT NULL,
    "extinct" BOOLEAN NOT NULL DEFAULT false,
    "bornTick" INTEGER NOT NULL,
    "cells" JSONB NOT NULL DEFAULT '{}',
    "intelligence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aggression" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contributionId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "engineId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "population" DOUBLE PRECISION NOT NULL,
    "extinct" BOOLEAN NOT NULL DEFAULT false,
    "bornTick" INTEGER NOT NULL,
    "cells" JSONB NOT NULL DEFAULT '{}',
    "pollutionAbsorption" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nightLuminosity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contributionId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "engineId" INTEGER NOT NULL,
    "cell" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "regenRate" DOUBLE PRECISION NOT NULL,
    "extractionRate" DOUBLE PRECISION NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "discoveredBy" INTEGER,
    "depleted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Civilization" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "engineId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "population" DOUBLE PRECISION NOT NULL,
    "techLevel" INTEGER NOT NULL,
    "government" TEXT NOT NULL,
    "military" DOUBLE PRECISION NOT NULL,
    "economy" DOUBLE PRECISION NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "happiness" DOUBLE PRECISION NOT NULL,
    "education" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "health" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "culture" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "religion" TEXT NOT NULL,
    "fallen" BOOLEAN NOT NULL DEFAULT false,
    "capitalCell" INTEGER NOT NULL,
    "cells" JSONB NOT NULL DEFAULT '[]',
    "foundedTick" INTEGER NOT NULL,
    "contributionId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Civilization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "engineId" INTEGER NOT NULL,
    "civilizationId" TEXT,
    "civEngineId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cell" INTEGER NOT NULL,
    "population" DOUBLE PRECISION NOT NULL,
    "fallen" BOOLEAN NOT NULL DEFAULT false,
    "foundedTick" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technology" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "engineId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "discoveredBy" INTEGER,
    "discoveredTick" INTEGER,
    "contributionId" TEXT,

    CONSTRAINT "Technology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Culture" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "traits" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Culture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeRoute" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "engineId" INTEGER NOT NULL,
    "fromCityId" TEXT,
    "toCityId" TEXT,
    "fromCityEngineId" INTEGER NOT NULL,
    "toCityEngineId" INTEGER NOT NULL,
    "path" JSONB NOT NULL DEFAULT '[]',
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdTick" INTEGER NOT NULL,

    CONSTRAINT "TradeRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alliance" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "engineId" INTEGER NOT NULL,
    "civIds" JSONB NOT NULL DEFAULT '[]',
    "createdTick" INTEGER NOT NULL,
    "brokenTick" INTEGER,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "War" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "engineId" INTEGER NOT NULL,
    "attackerEngineId" INTEGER NOT NULL,
    "defenderEngineId" INTEGER NOT NULL,
    "startedTick" INTEGER NOT NULL,
    "endedTick" INTEGER,
    "casualties" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "contributionId" TEXT,

    CONSTRAINT "War_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disease" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "engineId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "virulence" DOUBLE PRECISION NOT NULL,
    "lethality" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startedTick" INTEGER NOT NULL,
    "contributionId" TEXT,

    CONSTRAINT "Disease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Migration" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "engineId" INTEGER NOT NULL,
    "civEngineId" INTEGER,
    "fromCell" INTEGER NOT NULL,
    "toCell" INTEGER NOT NULL,
    "path" JSONB NOT NULL DEFAULT '[]',
    "people" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "startedTick" INTEGER NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Migration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContribution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "analysis" JSONB,
    "preview" JSONB,
    "balance" JSONB,
    "cellIndex" INTEGER,
    "appliedTick" INTEGER,
    "impactScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationTick" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationTick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldEvent" (
    "id" BIGSERIAL NOT NULL,
    "planetId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "tick" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "cellIndex" INTEGER,
    "civIds" JSONB NOT NULL DEFAULT '[]',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "causes" JSONB NOT NULL DEFAULT '[]',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "contributionId" TEXT,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "hash" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CausalLink" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "fromSeq" INTEGER NOT NULL,
    "toSeq" INTEGER NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'causes',

    CONSTRAINT "CausalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineSnapshot" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "model" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contributionId" TEXT,
    "flags" JSONB NOT NULL DEFAULT '[]',
    "score" DOUBLE PRECISION NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planetId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "eventSeq" INTEGER,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanetRegion_planetId_cellIndex_key" ON "PlanetRegion"("planetId", "cellIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Biome_name_key" ON "Biome"("name");

-- CreateIndex
CREATE INDEX "ClimateCell_planetId_tick_idx" ON "ClimateCell"("planetId", "tick");

-- CreateIndex
CREATE UNIQUE INDEX "ClimateCell_planetId_cellIndex_tick_key" ON "ClimateCell"("planetId", "cellIndex", "tick");

-- CreateIndex
CREATE INDEX "Species_planetId_extinct_idx" ON "Species"("planetId", "extinct");

-- CreateIndex
CREATE UNIQUE INDEX "Species_planetId_engineId_key" ON "Species"("planetId", "engineId");

-- CreateIndex
CREATE INDEX "Plant_planetId_extinct_idx" ON "Plant"("planetId", "extinct");

-- CreateIndex
CREATE UNIQUE INDEX "Plant_planetId_engineId_key" ON "Plant"("planetId", "engineId");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_planetId_engineId_key" ON "Resource"("planetId", "engineId");

-- CreateIndex
CREATE UNIQUE INDEX "Civilization_planetId_engineId_key" ON "Civilization"("planetId", "engineId");

-- CreateIndex
CREATE UNIQUE INDEX "City_planetId_engineId_key" ON "City"("planetId", "engineId");

-- CreateIndex
CREATE UNIQUE INDEX "Technology_planetId_engineId_key" ON "Technology"("planetId", "engineId");

-- CreateIndex
CREATE UNIQUE INDEX "Culture_planetId_name_key" ON "Culture"("planetId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Language_planetId_name_key" ON "Language"("planetId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TradeRoute_planetId_engineId_key" ON "TradeRoute"("planetId", "engineId");

-- CreateIndex
CREATE UNIQUE INDEX "Alliance_planetId_engineId_key" ON "Alliance"("planetId", "engineId");

-- CreateIndex
CREATE UNIQUE INDEX "War_planetId_engineId_key" ON "War"("planetId", "engineId");

-- CreateIndex
CREATE UNIQUE INDEX "Disease_planetId_engineId_key" ON "Disease"("planetId", "engineId");

-- CreateIndex
CREATE UNIQUE INDEX "Migration_planetId_engineId_key" ON "Migration"("planetId", "engineId");

-- CreateIndex
CREATE INDEX "UserContribution_userId_planetId_idx" ON "UserContribution"("userId", "planetId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationTick_planetId_tick_key" ON "SimulationTick"("planetId", "tick");

-- CreateIndex
CREATE INDEX "WorldEvent_planetId_type_idx" ON "WorldEvent"("planetId", "type");

-- CreateIndex
CREATE INDEX "WorldEvent_planetId_contributionId_idx" ON "WorldEvent"("planetId", "contributionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorldEvent_planetId_seq_key" ON "WorldEvent"("planetId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "CausalLink_planetId_fromSeq_toSeq_key" ON "CausalLink"("planetId", "fromSeq", "toSeq");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineSnapshot_planetId_tick_key" ON "TimelineSnapshot"("planetId", "tick");

-- CreateIndex
CREATE INDEX "AIRequest_createdAt_idx" ON "AIRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ModerationResult_userId_idx" ON "ModerationResult"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanetRegion" ADD CONSTRAINT "PlanetRegion_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimateCell" ADD CONSTRAINT "ClimateCell_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Species" ADD CONSTRAINT "Species_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Civilization" ADD CONSTRAINT "Civilization_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_civilizationId_fkey" FOREIGN KEY ("civilizationId") REFERENCES "Civilization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technology" ADD CONSTRAINT "Technology_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Culture" ADD CONSTRAINT "Culture_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Language" ADD CONSTRAINT "Language_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRoute" ADD CONSTRAINT "TradeRoute_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRoute" ADD CONSTRAINT "TradeRoute_fromCityId_fkey" FOREIGN KEY ("fromCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRoute" ADD CONSTRAINT "TradeRoute_toCityId_fkey" FOREIGN KEY ("toCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alliance" ADD CONSTRAINT "Alliance_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "War" ADD CONSTRAINT "War_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disease" ADD CONSTRAINT "Disease_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Migration" ADD CONSTRAINT "Migration_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContribution" ADD CONSTRAINT "UserContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContribution" ADD CONSTRAINT "UserContribution_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationTick" ADD CONSTRAINT "SimulationTick_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldEvent" ADD CONSTRAINT "WorldEvent_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CausalLink" ADD CONSTRAINT "CausalLink_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineSnapshot" ADD CONSTRAINT "TimelineSnapshot_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRequest" ADD CONSTRAINT "AIRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

