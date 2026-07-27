import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  countries() {
    return this.prisma.country.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  cities(countryCode: string) {
    return this.prisma.city.findMany({
      where: { countryCode, isActive: true },
      orderBy: { nameAr: 'asc' },
    });
  }
}
