import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { SettingsService } from '../../common/services/settings.service';
import { Public } from '../../common/decorators';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
  ) {}

  @Public()
  @Get()
  async list() {
    const [items, publishingMode, paymentsEnabled] = await Promise.all([
      this.pricing.list(),
      this.settings.publishingMode(),
      this.settings.paymentsEnabled(),
    ]);
    return { items, publishingMode, paymentsEnabled, currency: 'SAR' };
  }
}
