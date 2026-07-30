import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlanetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getDefaultPlanet() {
    const seed = this.config.getOrThrow<string>("defaultPlanetSeed");
    const planet =
      (await this.prisma.planet.findUnique({
        where: { seed },
        include: {
          regions: {
            orderBy: [{ gridY: "asc" }, { gridX: "asc" }],
            include: { _count: { select: { resources: true, cities: true } } },
            take: 500,
          },
        },
      })) ??
      (await this.prisma.planet.findFirst({
        where: { status: "active" },
        orderBy: { createdAt: "asc" },
        include: {
          regions: {
            orderBy: [{ gridY: "asc" }, { gridX: "asc" }],
            include: { _count: { select: { resources: true, cities: true } } },
            take: 500,
          },
        },
      }));

    if (!planet) {
      throw new NotFoundException("Default planet has not been seeded");
    }

    const [
      speciesCount,
      plantCount,
      resourceCount,
      civilizationCount,
      eventCount,
      latestEvents,
    ] = await Promise.all([
      this.prisma.species.count({ where: { planetId: planet.id, status: "alive" } }),
      this.prisma.plant.count({ where: { planetId: planet.id } }),
      this.prisma.resource.count({ where: { planetId: planet.id } }),
      this.prisma.civilization.count({ where: { planetId: planet.id } }),
      this.prisma.worldEvent.count({ where: { planetId: planet.id } }),
      this.prisma.worldEvent.findMany({
        where: { planetId: planet.id },
        orderBy: [{ tick: "desc" }, { createdAt: "desc" }],
        take: 25,
      }),
    ]);

    return {
      ...planet,
      regions: planet.regions.map((region) => ({
        id: region.id,
        name: region.name,
        nameAr: region.nameAr,
        biome: region.biome,
        lat: region.lat,
        lon: region.lon,
        elevation: region.elevation,
        temperature: region.temperature,
        moisture: region.moisture,
        fertility: region.fertility,
        population: region.population,
        pollution: region.pollution,
        gridX: region.gridX,
        gridY: region.gridY,
        civilizationId: region.civilizationId,
        resourceCount: region._count.resources,
        cityCount: region._count.cities,
      })),
      stats: {
        speciesCount,
        plantCount,
        resourceCount,
        civilizationCount,
        eventCount,
        regionCount: planet.regions.length,
      },
      overlays: latestEvents
        .filter((event) => event.lat !== null && event.lon !== null)
        .map((event) => ({
          id: event.id,
          category: event.type.toLowerCase(),
          label: event.title,
          labelAr: event.titleAr,
          value: event.description,
          valueAr: event.descriptionAr,
          lat: event.lat,
          lon: event.lon,
          color: event.importance >= 0.75 ? "#f97316" : "#38bdf8",
          tick: event.tick,
        })),
    };
  }

  async getPlanetEvents(planetId: string, limit = 50) {
    await this.ensurePlanet(planetId);

    return this.prisma.worldEvent.findMany({
      where: { planetId },
      orderBy: [{ tick: "desc" }, { createdAt: "desc" }],
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async getPlanetTimeline(planetId: string) {
    await this.ensurePlanet(planetId);

    const [snapshots, ticks, events] = await Promise.all([
      this.prisma.timelineSnapshot.findMany({
        where: { planetId },
        orderBy: { tick: "asc" },
      }),
      this.prisma.simulationTick.findMany({
        where: { planetId },
        orderBy: { tick: "asc" },
        take: 200,
      }),
      this.prisma.worldEvent.findMany({
        where: { planetId },
        orderBy: [{ tick: "asc" }, { createdAt: "asc" }],
        take: 500,
      }),
    ]);

    return {
      planetId,
      snapshots,
      ticks,
      events,
    };
  }

  async getRegion(planetId: string, regionId: string) {
    await this.ensurePlanet(planetId);

    const region = await this.prisma.planetRegion.findFirst({
      where: { id: regionId, planetId },
      include: {
        civilization: true,
        resources: true,
        cities: true,
      },
    });

    if (!region) {
      throw new NotFoundException("Region not found");
    }

    const events = await this.prisma.worldEvent.findMany({
      where: { planetId, regionId },
      orderBy: [{ tick: "desc" }, { createdAt: "desc" }],
      take: 25,
    });

    return {
      ...region,
      events,
    };
  }

  private async ensurePlanet(planetId: string): Promise<void> {
    const exists = await this.prisma.planet.findUnique({
      where: { id: planetId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException("Planet not found");
    }
  }
}
