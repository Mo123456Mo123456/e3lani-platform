import { Global, Module } from '@nestjs/common';
import { PaymentsProviderService } from './payments-provider.service';
import { PaymentsController } from './payments.controller';

@Global()
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsProviderService],
  exports: [PaymentsProviderService],
})
export class PaymentsProviderModule {}
