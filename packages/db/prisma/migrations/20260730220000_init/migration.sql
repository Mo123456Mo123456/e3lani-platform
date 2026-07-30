-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('guest', 'user', 'explorer', 'life_maker', 'civilization_creator', 'historian', 'content_moderator', 'simulation_manager', 'system_admin', 'super_admin');

-- CreateEnum
CREATE TYPE "ElementCategory" AS ENUM ('creature', 'plant', 'resource', 'civilization', 'city', 'invention', 'technology', 'disease', 'climate_phenomenon', 'natural_law', 'disaster', 'alliance', 'culture', 'language', 'transport', 'energy', 'custom');

-- CreateEnum
CREATE TYPE "BiomeType" AS ENUM ('ocean', 'coast', 'plains', 'rainforest', 'temperate_forest', 'desert', 'mountain', 'tundra', 'wetland', 'steppe', 'volcanic', 'ice');

-- CreateEnum
CREATE TYPE "TickUnit" AS ENUM ('day', 'month', 'year', 'decade');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "title" TEXT DEFAULT 'Planet Explorer',
    "impactScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "currentTick" INTEGER NOT NULL DEFAULT 0,
    "currentYear" INTEGER NOT NULL DEFAULT 0,
    "tickUnit" "TickUnit" NOT NULL DEFAULT 'year',
    "resolutionLat" INTEGER NOT NULL DEFAULT 36,
    "resolutionLon" INTEGER NOT NULL DEFAULT 72,
    "status" TEXT NOT NULL DEFAULT 'active',
    "atmosphereTint" TEXT NOT NULL DEFAULT '#4fa3ff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanetRegion" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "biome" "BiomeType" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "elevation" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL,
    "fertility" DOUBLE PRECISION NOT NULL,
    "population" INTEGER NOT NULL DEFAULT 0,
    "pollution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,
    "civilizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanetRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClimateCell" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL,
    "pressure" DOUBLE PRECISION NOT NULL,
    "windU" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "windV" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pollution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedTick" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClimateCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Species" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "population" DOUBLE PRECISION NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "reproduction" DOUBLE PRECISION NOT NULL,
    "aggression" DOUBLE PRECISION NOT NULL,
    "intelligence" DOUBLE PRECISION NOT NULL,
    "heatResistance" DOUBLE PRECISION NOT NULL,
    "coldResistance" DOUBLE PRECISION NOT NULL,
    "waterNeed" DOUBLE PRECISION NOT NULL,
    "adaptability" DOUBLE PRECISION NOT NULL,
    "mutationRate" DOUBLE PRECISION NOT NULL,
    "habitatBiomes" "BiomeType"[],
    "preyOf" TEXT[],
    "foodOf" TEXT[],
    "contributionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'alive',
    "createdTick" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "coverage" DOUBLE PRECISION NOT NULL,
    "growthRate" DOUBLE PRECISION NOT NULL,
    "waterNeed" DOUBLE PRECISION NOT NULL,
    "pollutionAbsorption" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nightLuminosity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "energyOutput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "habitatBiomes" "BiomeType"[],
    "contributionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'thriving',
    "createdTick" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "regionId" TEXT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "regenerate" DOUBLE PRECISION NOT NULL,
    "extractRate" DOUBLE PRECISION NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "envImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL,
    "contributionId" TEXT,
    "createdTick" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Civilization" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "population" INTEGER NOT NULL,
    "techLevel" DOUBLE PRECISION NOT NULL,
    "military" DOUBLE PRECISION NOT NULL,
    "economy" DOUBLE PRECISION NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "happiness" DOUBLE PRECISION NOT NULL,
    "education" DOUBLE PRECISION NOT NULL,
    "pollution" DOUBLE PRECISION NOT NULL,
    "innovation" DOUBLE PRECISION NOT NULL,
    "aggression" DOUBLE PRECISION NOT NULL,
    "color" TEXT NOT NULL,
    "government" TEXT NOT NULL,
    "capitalCityId" TEXT,
    "foundedTick" INTEGER NOT NULL DEFAULT 0,
    "memoryJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Civilization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "civilizationId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "population" INTEGER NOT NULL,
    "prosperity" DOUBLE PRECISION NOT NULL,
    "defense" DOUBLE PRECISION NOT NULL,
    "foundedTick" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technology" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "level" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "discoveredTick" INTEGER NOT NULL DEFAULT 0,
    "contributionId" TEXT,

    CONSTRAINT "Technology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Culture" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "traits" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Culture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "family" TEXT,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeRoute" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "fromCityId" TEXT NOT NULL,
    "toCityId" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "risk" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "resourceType" TEXT,

    CONSTRAINT "TradeRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alliance" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "members" TEXT[],
    "strength" DOUBLE PRECISION NOT NULL,
    "formedTick" INTEGER NOT NULL,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "War" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "attackerId" TEXT NOT NULL,
    "defenderId" TEXT NOT NULL,
    "intensity" DOUBLE PRECISION NOT NULL,
    "cause" TEXT NOT NULL,
    "startedTick" INTEGER NOT NULL,
    "endedTick" INTEGER,
    "outcome" TEXT,

    CONSTRAINT "War_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disease" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "virulence" DOUBLE PRECISION NOT NULL,
    "spread" DOUBLE PRECISION NOT NULL,
    "mortality" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startedTick" INTEGER NOT NULL,

    CONSTRAINT "Disease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Migration" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "fromRegionId" TEXT NOT NULL,
    "toRegionId" TEXT NOT NULL,
    "population" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "startedTick" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Migration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContribution" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "ElementCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "traitsJson" JSONB NOT NULL,
    "biomes" "BiomeType"[],
    "risks" TEXT[],
    "benefits" TEXT[],
    "balanceScore" DOUBLE PRECISION NOT NULL,
    "wasBalanced" BOOLEAN NOT NULL DEFAULT false,
    "regionId" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appliedTick" INTEGER,
    "narrativeAr" TEXT,
    "narrativeEn" TEXT,
    "causalGraphJson" JSONB,
    "forecastJson" JSONB,
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
    "unit" "TickUnit" NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationTick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldEvent" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL,
    "regionId" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "causeIds" TEXT[],
    "contributionId" TEXT,
    "userId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "directImpact" JSONB NOT NULL DEFAULT '{}',
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CausalLink" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "fromNode" TEXT NOT NULL,
    "toNode" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "tick" INTEGER NOT NULL,
    "eventId" TEXT,

    CONSTRAINT "CausalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineSnapshot" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "stateJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationResult" (
    "id" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "labels" TEXT[],
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metaJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metaJson" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Planet_seed_key" ON "Planet"("seed");

-- CreateIndex
CREATE INDEX "PlanetRegion_planetId_idx" ON "PlanetRegion"("planetId");

-- CreateIndex
CREATE INDEX "PlanetRegion_biome_idx" ON "PlanetRegion"("biome");

-- CreateIndex
CREATE UNIQUE INDEX "PlanetRegion_planetId_gridX_gridY_key" ON "PlanetRegion"("planetId", "gridX", "gridY");

-- CreateIndex
CREATE INDEX "ClimateCell_planetId_idx" ON "ClimateCell"("planetId");

-- CreateIndex
CREATE UNIQUE INDEX "ClimateCell_planetId_gridX_gridY_key" ON "ClimateCell"("planetId", "gridX", "gridY");

-- CreateIndex
CREATE INDEX "Species_planetId_idx" ON "Species"("planetId");

-- CreateIndex
CREATE INDEX "Plant_planetId_idx" ON "Plant"("planetId");

-- CreateIndex
CREATE INDEX "Resource_planetId_idx" ON "Resource"("planetId");

-- CreateIndex
CREATE INDEX "Civilization_planetId_idx" ON "Civilization"("planetId");

-- CreateIndex
CREATE INDEX "City_civilizationId_idx" ON "City"("civilizationId");

-- CreateIndex
CREATE INDEX "UserContribution_planetId_idx" ON "UserContribution"("planetId");

-- CreateIndex
CREATE INDEX "UserContribution_userId_idx" ON "UserContribution"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationTick_planetId_tick_key" ON "SimulationTick"("planetId", "tick");

-- CreateIndex
CREATE INDEX "WorldEvent_planetId_tick_idx" ON "WorldEvent"("planetId", "tick");

-- CreateIndex
CREATE INDEX "WorldEvent_type_idx" ON "WorldEvent"("type");

-- CreateIndex
CREATE INDEX "CausalLink_planetId_idx" ON "CausalLink"("planetId");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineSnapshot_planetId_tick_key" ON "TimelineSnapshot"("planetId", "tick");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanetRegion" ADD CONSTRAINT "PlanetRegion_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanetRegion" ADD CONSTRAINT "PlanetRegion_civilizationId_fkey" FOREIGN KEY ("civilizationId") REFERENCES "Civilization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimateCell" ADD CONSTRAINT "ClimateCell_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Species" ADD CONSTRAINT "Species_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "PlanetRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Civilization" ADD CONSTRAINT "Civilization_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_civilizationId_fkey" FOREIGN KEY ("civilizationId") REFERENCES "Civilization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "PlanetRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technology" ADD CONSTRAINT "Technology_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Culture" ADD CONSTRAINT "Culture_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Language" ADD CONSTRAINT "Language_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "UserContribution" ADD CONSTRAINT "UserContribution_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContribution" ADD CONSTRAINT "UserContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationTick" ADD CONSTRAINT "SimulationTick_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldEvent" ADD CONSTRAINT "WorldEvent_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldEvent" ADD CONSTRAINT "WorldEvent_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "UserContribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CausalLink" ADD CONSTRAINT "CausalLink_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineSnapshot" ADD CONSTRAINT "TimelineSnapshot_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRequest" ADD CONSTRAINT "AIRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

