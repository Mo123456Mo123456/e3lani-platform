import { Injectable } from '@nestjs/common';
import type { CategoryDto, CityDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';

const CACHE_TTL = 300;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async categoryTree(): Promise<CategoryDto[]> {
    const cached = await this.redis.getJson<CategoryDto[]>('catalog:categories');
    if (cached) return cached;

    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });

    const byId = new Map<string, CategoryDto>();
    for (const row of rows) {
      byId.set(row.id, {
        id: row.id,
        slug: row.slug,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        icon: row.icon,
        parentId: row.parentId,
        sortOrder: row.sortOrder,
        children: [],
      });
    }

    const tree: CategoryDto[] = [];
    for (const row of rows) {
      const node = byId.get(row.id)!;
      if (row.parentId && byId.has(row.parentId)) byId.get(row.parentId)!.children!.push(node);
      else tree.push(node);
    }

    await this.redis.setJson('catalog:categories', tree, CACHE_TTL);
    return tree;
  }

  async categoriesWithCounts(): Promise<CategoryDto[]> {
    const tree = await this.categoryTree();
    const counts = await this.prisma.ad.groupBy({
      by: ['categoryId'],
      where: { status: 'ACTIVE' },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((row) => [row.categoryId, row._count._all]));
    const decorate = (node: CategoryDto): CategoryDto => ({
      ...node,
      adsCount: countMap.get(node.id) ?? 0,
      children: node.children?.map(decorate),
    });
    return tree.map(decorate);
  }

  async cities(): Promise<CityDto[]> {
    const cached = await this.redis.getJson<CityDto[]>('catalog:cities');
    if (cached) return cached;

    const rows = await this.prisma.city.findMany({
      where: { isActive: true },
      include: { region: true },
      orderBy: [{ isPopular: 'desc' }, { sortOrder: 'asc' }, { nameAr: 'asc' }],
    });

    const cities: CityDto[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      regionId: row.regionId,
      regionNameAr: row.region.nameAr,
      regionNameEn: row.region.nameEn,
      lat: row.lat,
      lng: row.lng,
      isPopular: row.isPopular,
    }));

    await this.redis.setJson('catalog:cities', cities, CACHE_TTL);
    return cities;
  }

  async regions() {
    return this.prisma.region.findMany({ orderBy: { nameAr: 'asc' } });
  }

  /** أقرب مدينة لإحداثيات المستخدم — تُستخدم في تبويب «قريب منك». */
  async nearestCity(lat: number, lng: number): Promise<CityDto | null> {
    const cities = await this.cities();
    if (!cities.length) return null;
    let best = cities[0]!;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const city of cities) {
      const distance = (city.lat - lat) ** 2 + (city.lng - lng) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = city;
      }
    }
    return best;
  }

  async invalidate(): Promise<void> {
    await this.redis.del('catalog:categories');
    await this.redis.del('catalog:cities');
  }
}
