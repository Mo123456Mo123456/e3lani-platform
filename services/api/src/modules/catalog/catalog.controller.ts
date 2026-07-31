import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get('categories')
  async categories(@Query('withCounts') withCounts?: string) {
    return withCounts === 'true'
      ? this.catalog.categoriesWithCounts()
      : this.catalog.categoryTree();
  }

  @Public()
  @Get('cities')
  async cities() {
    return this.catalog.cities();
  }

  @Public()
  @Get('regions')
  async regions() {
    return this.catalog.regions();
  }
}
