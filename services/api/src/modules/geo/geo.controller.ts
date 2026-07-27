import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GeoService } from './geo.service';

@ApiTags('geo')
@Controller()
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('countries')
  countries() {
    return this.geo.countries();
  }

  @Get('countries/:code/cities')
  cities(@Param('code') code: string) {
    return this.geo.cities(code.toUpperCase());
  }

  @Get('cities')
  citiesDefault() {
    return this.geo.cities('SA');
  }
}
