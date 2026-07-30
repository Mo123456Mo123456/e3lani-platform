-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'EXPLORER', 'LIFE_MAKER', 'CIV_BUILDER', 'HISTORIAN', 'MODERATOR', 'SIM_ADMIN', 'SYS_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('draft', 'analyzing', 'preview', 'confirmed', 'active', 'rejected');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('pending', 'approved', 'rejected', 'flagged');

-- CreateEnum
CREATE TYPE "WarStatus" AS ENUM ('active', 'ceasefire', 'resolved');

-- CreateEnum
CREATE TYPE "AllianceStatus" AS ENUM ('active', 'broken');

-- CreateEnum
CREATE TYPE "PlanetStatus" AS ENUM ('active', 'paused', 'archived');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "bannedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "impactLevel" INTEGER NOT NULL DEFAULT 0,
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "totalContributions" INTEGER NOT NULL DEFAULT 0,
    "totalEffects" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "replacedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "status" "PlanetStatus" NOT NULL DEFAULT 'active',
    "config" JSONB NOT NULL,
    "tick" INTEGER NOT NULL DEFAULT 0,
    "simYear" INTEGER NOT NULL DEFAULT 0,
    "stats" JSONB,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanetRegion" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "elevation" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL,
    "biome" TEXT NOT NULL,
    "fertility" DOUBLE PRECISION NOT NULL,
    "pollution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "river" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isOcean" BOOLEAN NOT NULL,
    "isVolcanic" BOOLEAN NOT NULL DEFAULT false,
    "hasIce" BOOLEAN NOT NULL DEFAULT false,
    "ownerCivKey" TEXT,
    "cityKey" TEXT,
    "population" INTEGER NOT NULL DEFAULT 0,
    "plantCoverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedTick" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanetRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Biome" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "cellCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Biome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClimateCell" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "regionId" TEXT,
    "index" INTEGER NOT NULL,
    "tick" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL,
    "storm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "drought" INTEGER NOT NULL DEFAULT 0,
    "fire" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ClimateCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Species" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentKey" TEXT,
    "homeBiome" TEXT NOT NULL,
    "traits" JSONB NOT NULL,
    "diet" TEXT NOT NULL,
    "preyKeys" JSONB NOT NULL DEFAULT '[]',
    "originContributionId" TEXT,
    "globalPopulation" INTEGER NOT NULL DEFAULT 0,
    "cellCount" INTEGER NOT NULL DEFAULT 0,
    "createdTick" INTEGER NOT NULL,
    "extinct" BOOLEAN NOT NULL DEFAULT false,
    "extinctTick" INTEGER,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "biomes" JSONB NOT NULL,
    "traits" JSONB NOT NULL,
    "originContributionId" TEXT,
    "coverage" INTEGER NOT NULL DEFAULT 0,
    "createdTick" INTEGER NOT NULL,
    "extinct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "renewalRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discovered" BOOLEAN NOT NULL DEFAULT false,
    "controllingCivKey" TEXT,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Civilization" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "foundedTick" INTEGER NOT NULL,
    "extinct" BOOLEAN NOT NULL DEFAULT false,
    "government" TEXT NOT NULL,
    "techEra" TEXT NOT NULL,
    "population" INTEGER NOT NULL DEFAULT 0,
    "territorySize" INTEGER NOT NULL DEFAULT 0,
    "military" DOUBLE PRECISION NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "happiness" DOUBLE PRECISION NOT NULL,
    "health" DOUBLE PRECISION NOT NULL,
    "education" DOUBLE PRECISION NOT NULL,
    "economy" DOUBLE PRECISION NOT NULL,
    "foodSecurity" DOUBLE PRECISION NOT NULL,
    "aggression" DOUBLE PRECISION NOT NULL,
    "innovation" DOUBLE PRECISION NOT NULL,
    "pollution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "techKeys" JSONB NOT NULL DEFAULT '[]',
    "stockpiles" JSONB NOT NULL DEFAULT '{}',
    "relations" JSONB NOT NULL DEFAULT '{}',
    "memory" JSONB NOT NULL DEFAULT '[]',
    "data" JSONB,

    CONSTRAINT "Civilization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "civDbId" TEXT,
    "civKey" TEXT NOT NULL,
    "regionIndex" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "population" INTEGER NOT NULL,
    "foundedTick" INTEGER NOT NULL,
    "isCapital" BOOLEAN NOT NULL DEFAULT false,
    "health" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "prosperity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technology" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "era" TEXT NOT NULL,
    "prereqKeys" JSONB NOT NULL DEFAULT '[]',
    "effects" JSONB NOT NULL DEFAULT '{}',
    "discoveredBy" JSONB NOT NULL DEFAULT '[]',
    "discoveredTick" INTEGER,

    CONSTRAINT "Technology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Culture" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "civDbId" TEXT,
    "civKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "influence" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Culture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "civDbId" TEXT,
    "civKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "speakers" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeRoute" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fromCityKey" TEXT NOT NULL,
    "toCityKey" TEXT NOT NULL,
    "fromCivKey" TEXT NOT NULL,
    "toCivKey" TEXT NOT NULL,
    "path" JSONB NOT NULL,
    "goods" JSONB NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "risk" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdTick" INTEGER NOT NULL,

    CONSTRAINT "TradeRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alliance" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memberCivKeys" JSONB NOT NULL,
    "status" "AllianceStatus" NOT NULL DEFAULT 'active',
    "createdTick" INTEGER NOT NULL,
    "brokenTick" INTEGER,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "War" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attackerCivKey" TEXT NOT NULL,
    "defenderCivKey" TEXT NOT NULL,
    "status" "WarStatus" NOT NULL DEFAULT 'active',
    "startedTick" INTEGER NOT NULL,
    "endedTick" INTEGER,
    "casualties" INTEGER NOT NULL DEFAULT 0,
    "frontCells" JSONB NOT NULL DEFAULT '[]',
    "causeSummary" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "War_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disease" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "severity" DOUBLE PRECISION NOT NULL,
    "contagiousness" DOUBLE PRECISION NOT NULL,
    "affectedCivKeys" JSONB NOT NULL DEFAULT '[]',
    "originContributionId" TEXT,
    "startedTick" INTEGER NOT NULL,
    "contained" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Disease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Migration" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "civKey" TEXT,
    "speciesKey" TEXT,
    "fromIndex" INTEGER NOT NULL,
    "toIndex" INTEGER NOT NULL,
    "path" JSONB NOT NULL,
    "size" INTEGER NOT NULL,
    "startedTick" INTEGER NOT NULL,
    "completedTick" INTEGER,

    CONSTRAINT "Migration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContribution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "parsed" JSONB,
    "originIndex" INTEGER,
    "originLat" DOUBLE PRECISION,
    "originLon" DOUBLE PRECISION,
    "status" "ContributionStatus" NOT NULL DEFAULT 'draft',
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'pending',
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "rootEventKey" TEXT,
    "impactScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "createdTick" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationTick" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "simYear" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "stats" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationTick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldEvent" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "simYear" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "regionIndex" INTEGER,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "actorIds" JSONB NOT NULL DEFAULT '[]',
    "contributionId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "magnitude" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CausalLink" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "causeEventId" TEXT NOT NULL,
    "effectEventId" TEXT NOT NULL,

    CONSTRAINT "CausalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineSnapshot" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "simYear" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationResult" (
    "id" TEXT NOT NULL,
    "contributionId" TEXT,
    "text" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
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
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_userId_role_key" ON "Role"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revoked_idx" ON "RefreshToken"("userId", "revoked");

-- CreateIndex
CREATE UNIQUE INDEX "Planet_seed_key" ON "Planet"("seed");

-- CreateIndex
CREATE INDEX "PlanetRegion_planetId_biome_idx" ON "PlanetRegion"("planetId", "biome");

-- CreateIndex
CREATE UNIQUE INDEX "PlanetRegion_planetId_index_key" ON "PlanetRegion"("planetId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Biome_planetId_key_key" ON "Biome"("planetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ClimateCell_planetId_index_tick_key" ON "ClimateCell"("planetId", "index", "tick");

-- CreateIndex
CREATE INDEX "Species_planetId_extinct_idx" ON "Species"("planetId", "extinct");

-- CreateIndex
CREATE UNIQUE INDEX "Species_planetId_key_key" ON "Species"("planetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Plant_planetId_key_key" ON "Plant"("planetId", "key");

-- CreateIndex
CREATE INDEX "Resource_planetId_kind_idx" ON "Resource"("planetId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Civilization_planetId_key_key" ON "Civilization"("planetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "City_planetId_key_key" ON "City"("planetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Technology_planetId_key_key" ON "Technology"("planetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "TradeRoute_planetId_key_key" ON "TradeRoute"("planetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Alliance_planetId_key_key" ON "Alliance"("planetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "War_planetId_key_key" ON "War"("planetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Disease_planetId_key_key" ON "Disease"("planetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Migration_planetId_key_key" ON "Migration"("planetId", "key");

-- CreateIndex
CREATE INDEX "UserContribution_userId_planetId_idx" ON "UserContribution"("userId", "planetId");

-- CreateIndex
CREATE INDEX "UserContribution_planetId_status_idx" ON "UserContribution"("planetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationTick_planetId_tick_key" ON "SimulationTick"("planetId", "tick");

-- CreateIndex
CREATE INDEX "WorldEvent_planetId_tick_idx" ON "WorldEvent"("planetId", "tick");

-- CreateIndex
CREATE INDEX "WorldEvent_planetId_type_idx" ON "WorldEvent"("planetId", "type");

-- CreateIndex
CREATE INDEX "WorldEvent_contributionId_idx" ON "WorldEvent"("contributionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorldEvent_planetId_key_key" ON "WorldEvent"("planetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CausalLink_causeEventId_effectEventId_key" ON "CausalLink"("causeEventId", "effectEventId");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineSnapshot_planetId_tick_key" ON "TimelineSnapshot"("planetId", "tick");

-- CreateIndex
CREATE INDEX "AIRequest_createdAt_idx" ON "AIRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanetRegion" ADD CONSTRAINT "PlanetRegion_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Biome" ADD CONSTRAINT "Biome_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimateCell" ADD CONSTRAINT "ClimateCell_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimateCell" ADD CONSTRAINT "ClimateCell_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "PlanetRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Species" ADD CONSTRAINT "Species_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "PlanetRegion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Civilization" ADD CONSTRAINT "Civilization_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_civDbId_fkey" FOREIGN KEY ("civDbId") REFERENCES "Civilization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technology" ADD CONSTRAINT "Technology_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Culture" ADD CONSTRAINT "Culture_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Culture" ADD CONSTRAINT "Culture_civDbId_fkey" FOREIGN KEY ("civDbId") REFERENCES "Civilization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Language" ADD CONSTRAINT "Language_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Language" ADD CONSTRAINT "Language_civDbId_fkey" FOREIGN KEY ("civDbId") REFERENCES "Civilization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRoute" ADD CONSTRAINT "TradeRoute_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "CausalLink" ADD CONSTRAINT "CausalLink_causeEventId_fkey" FOREIGN KEY ("causeEventId") REFERENCES "WorldEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CausalLink" ADD CONSTRAINT "CausalLink_effectEventId_fkey" FOREIGN KEY ("effectEventId") REFERENCES "WorldEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineSnapshot" ADD CONSTRAINT "TimelineSnapshot_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationResult" ADD CONSTRAINT "ModerationResult_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "UserContribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationResult" ADD CONSTRAINT "ModerationResult_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

