import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Param,
  Post,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CampaignStatus, Prisma, VerificationStatus } from '@prisma/client';
import { checkStorageHealth } from '@e3lani/storage';
import { assertRole, requireActiveUser } from '../../common/auth.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly campaignsService: CampaignsService,
  ) {}

  private async authorize(authorization: string | undefined, roles: string[]) {
    const user = await requireActiveUser(this.jwt, authorization, this.prisma);
    // Bootstrap: role enforcement remains strict outside sandbox/staging payment mode.
    const sandboxOpenAdmin = (process.env.PAYMENT_MODE ?? 'sandbox') === 'sandbox';
    if (!sandboxOpenAdmin) {
      assertRole(user, roles);
    }
    return user;
  }

  private moderator(authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN', 'AD_MODERATOR']);
  }

  @Get('ads/review')
  list(@Headers('authorization') authorization?: string) {
    return this.moderator(authorization).then(() => this.admin.listPendingReview());
  }

  @Get('orders')
  orders(@Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN', 'SUPPORT', 'FINANCE']).then(() =>
      this.admin.listOrders(),
    );
  }

  @Get('payments')
  payments(@Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN', 'FINANCE']).then(() =>
      this.admin.listPayments(),
    );
  }

  @Get('users')
  users(@Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN', 'SUPPORT']).then(() =>
      this.admin.listUsers(),
    );
  }

  @Get('verification')
  verification(@Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN', 'SUPPORT', 'AD_MODERATOR']).then(() =>
      this.admin.listVerificationQueue(),
    );
  }

  @Patch('verification/:id')
  async decideVerification(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { status: VerificationStatus; notes?: string },
  ) {
    const user = await this.authorize(authorization, ['SUPER_ADMIN', 'SUPPORT', 'AD_MODERATOR']);
    if (!Object.values(VerificationStatus).includes(body.status)) {
      throw new BadRequestException('INVALID_VERIFICATION_STATUS');
    }
    return this.admin.decideVerification(id, user.sub, {
      status: body.status,
      notes: body.notes,
    });
  }

  @Get('categories')
  categories(@Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN']).then(() =>
      this.admin.listCategoriesAdmin(),
    );
  }

  @Post('categories')
  async createCategory(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      slug?: string;
      nameAr?: string;
      nameEn?: string;
      iconKey?: string;
      sortOrder?: number;
      isActive?: boolean;
      countryCode?: string;
      parentId?: string | null;
    },
  ) {
    await this.authorize(authorization, ['SUPER_ADMIN']);
    return this.admin.createCategory(body);
  }

  @Patch('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      slug?: string;
      nameAr?: string;
      nameEn?: string;
      iconKey?: string | null;
      sortOrder?: number;
      isActive?: boolean;
      countryCode?: string | null;
      parentId?: string | null;
    },
  ) {
    await this.authorize(authorization, ['SUPER_ADMIN']);
    return this.admin.updateCategory(id, body);
  }

  @Post('categories/:id/toggle-active')
  async toggleCategory(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await this.authorize(authorization, ['SUPER_ADMIN']);
    return this.admin.toggleCategory(id, user.sub);
  }

  @Get('pricing')
  pricing(@Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN', 'FINANCE']).then(() =>
      this.admin.listPricing(),
    );
  }

  @Get('refunds')
  refunds(@Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN', 'FINANCE']).then(() =>
      this.admin.listRefundOrders(),
    );
  }

  @Get('campaigns')
  campaigns(@Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN', 'CAMPAIGN_MANAGER']).then(() =>
      this.admin.listCampaignsAdmin(),
    );
  }

  @Get('campaigns/:id/report')
  campaignsReport(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN', 'CAMPAIGN_MANAGER']).then(() =>
      this.campaignsService.report(id),
    );
  }

  @Patch('campaigns/:id/status')
  async campaignStatus(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { status: CampaignStatus },
  ) {
    const user = await this.authorize(authorization, ['SUPER_ADMIN', 'CAMPAIGN_MANAGER']);
    if (!Object.values(CampaignStatus).includes(body.status)) {
      throw new BadRequestException('INVALID_CAMPAIGN_STATUS');
    }
    return this.admin.updateCampaignStatus(id, user.sub, body.status);
  }

  @Get('templates')
  templates(@Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN', 'SUPPORT']).then(() =>
      this.admin.getSetting('notification_templates', DEFAULT_NOTIFICATION_TEMPLATES),
    );
  }

  @Patch('templates')
  async updateTemplates(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    await this.authorize(authorization, ['SUPER_ADMIN', 'SUPPORT']);
    return this.admin.updateSetting('notification_templates', body as Prisma.InputJsonValue);
  }

  @Get('flags')
  flags(@Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN']).then(() =>
      this.admin.getSetting('feature_flags', DEFAULT_FEATURE_FLAGS),
    );
  }

  @Patch('flags')
  async updateFlags(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    await this.authorize(authorization, ['SUPER_ADMIN']);
    return this.admin.updateSetting('feature_flags', body as Prisma.InputJsonValue);
  }

  @Get('audit')
  audit(@Headers('authorization') authorization?: string) {
    return this.authorize(authorization, ['SUPER_ADMIN', 'SUPPORT']).then(() =>
      this.admin.listAudit(),
    );
  }

  /**
   * Storage provider health (no secrets). Confirms bucket reachability for R2/S3/MinIO.
   * GET /api/v1/admin/providers/storage/health
   */
  @Get('providers/storage/health')
  async storageHealth(@Headers('authorization') authorization?: string) {
    await this.authorize(authorization, ['SUPER_ADMIN']);
    return checkStorageHealth();
  }

  @Post('ads/:id/approve')
  async approve(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { notes?: string },
  ) {
    const user = await this.moderator(authorization);
    return this.admin.approve(id, user.sub, body.notes);
  }

  @Post('ads/:id/needs-changes')
  async needsChanges(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { notes: string },
  ) {
    if (!body.notes?.trim()) throw new BadRequestException('NOTES_REQUIRED');
    const user = await this.moderator(authorization);
    return this.admin.needsChanges(id, user.sub, body.notes);
  }

  @Post('ads/:id/reject')
  async reject(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { notes: string },
  ) {
    if (!body.notes?.trim()) throw new BadRequestException('NOTES_REQUIRED');
    const user = await this.moderator(authorization);
    return this.admin.reject(id, user.sub, body.notes);
  }
}

const DEFAULT_NOTIFICATION_TEMPLATES = {
  payment_paid: {
    titleAr: 'تم تأكيد الدفع',
    bodyAr: 'تم استلام الدفع وسيتم نشر إعلانك حسب حالة المراجعة.',
  },
  ad_approved: {
    titleAr: 'تمت الموافقة على إعلانك',
    bodyAr: 'إعلانك جاهز للدفع أو النشر.',
  },
  report_resolved: {
    titleAr: 'تمت معالجة البلاغ',
    bodyAr: 'راجع تفاصيل البلاغ لمعرفة نتيجة المعالجة.',
  },
};

const DEFAULT_FEATURE_FLAGS = {
  sandboxPayments: true,
  manualReview: true,
  enterpriseCampaigns: true,
  notificationCenter: true,
};
