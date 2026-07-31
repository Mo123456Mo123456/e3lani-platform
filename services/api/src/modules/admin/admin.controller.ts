import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  adminListQuerySchema, adminModerateAdSchema, createAdminUserSchema, reviewTickerRequestSchema,
  resolveReportSchema, sendNotificationSchema, updateSettingSchema, upsertCategorySchema,
  upsertCitySchema, upsertPricingSchema,
} from '@e3lani/types';
import { AdminService } from './admin.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PricingService } from '../pricing/pricing.service';
import { ReportsService } from '../moderation/reports.service';
import { AppealsService } from '../moderation/appeals.service';
import { TickerService } from '../ticker/ticker.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminOnly, CurrentAdmin, RequirePermissions, type AuthAdmin } from '../../common/decorators';

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const decideAppealSchema = z.object({
  decision: z.enum(['ACCEPT', 'REJECT']),
  note: z.string().trim().min(3).max(500),
});
const moderatePostSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});
const reorderTickerSchema = z.object({
  order: z.array(z.object({ id: z.string(), sortWeight: z.number().int().min(0).max(999) })).min(1),
});

/**
 * لوحة الإدارة — كل المسارات محمية برمز إدارة منفصل وصلاحيات فعلية (RBAC).
 */
@ApiTags('admin')
@AdminOnly()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly analytics: AnalyticsService,
    private readonly pricing: PricingService,
    private readonly reports: ReportsService,
    private readonly appeals: AppealsService,
    private readonly ticker: TickerService,
  ) {}

  /* ------------------------------ نظرة عامة ---------------------------- */

  @Get('me')
  me(@CurrentAdmin() admin: AuthAdmin) {
    return admin;
  }

  @Get('overview')
  @RequirePermissions('analytics.read')
  async overview(@Query('days') days?: string) {
    return this.analytics.platformOverview(Math.min(Number(days ?? 30) || 30, 365));
  }

  /* ----------------------------- المستخدمون ---------------------------- */

  @Get('users')
  @RequirePermissions('users.read')
  async users(@Query(zodPipe(adminListQuerySchema)) query: any) {
    return this.admin.listUsers(query);
  }

  @Post('users/:id/suspend')
  @RequirePermissions('users.suspend')
  async suspendUser(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('id') id: string,
    @Body(zodPipe(reasonSchema)) body: { reason: string },
  ) {
    return this.admin.setUserStatus(admin.id, id, 'SUSPENDED', body.reason);
  }

  @Post('users/:id/activate')
  @RequirePermissions('users.suspend')
  async activateUser(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('id') id: string,
    @Body(zodPipe(reasonSchema)) body: { reason: string },
  ) {
    return this.admin.setUserStatus(admin.id, id, 'ACTIVE', body.reason);
  }

  @Post('users/:id/verify')
  @RequirePermissions('business.verify')
  async verifyBusiness(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('id') id: string,
    @Body(zodPipe(z.object({ verified: z.boolean() }))) body: { verified: boolean },
  ) {
    return this.admin.verifyBusiness(admin.id, id, body.verified);
  }

  /* ------------------------ مستخدمو لوحة الإدارة ----------------------- */

  @Get('admins')
  @RequirePermissions('admins.read')
  async admins() {
    return this.admin.listAdmins();
  }

  @Post('admins')
  @RequirePermissions('admins.write')
  async createAdmin(
    @CurrentAdmin() admin: AuthAdmin,
    @Body(zodPipe(createAdminUserSchema)) body: any,
  ) {
    return this.admin.createAdmin(admin.id, body);
  }

  @Patch('admins/:id/active')
  @RequirePermissions('admins.write')
  async toggleAdmin(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('id') id: string,
    @Body(zodPipe(z.object({ isActive: z.boolean() }))) body: { isActive: boolean },
  ) {
    return this.admin.setAdminActive(admin.id, id, body.isActive);
  }

  /* ------------------------------ الإعلانات ---------------------------- */

  @Get('ads')
  @RequirePermissions('ads.read')
  async ads(@Query(zodPipe(adminListQuerySchema)) query: any) {
    return this.admin.listAds(query);
  }

  @Post('ads/:id/moderate')
  @RequirePermissions('ads.moderate')
  async moderateAd(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('id') id: string,
    @Body(zodPipe(adminModerateAdSchema)) body: any,
  ) {
    return this.admin.moderateAd(admin.id, id, body);
  }

  @Get('ads/:id/analytics')
  @RequirePermissions('analytics.read')
  async adAnalytics(@Param('id') id: string) {
    return this.analytics.compute(id, {});
  }

  /* ------------------------------ المنشورات ---------------------------- */

  @Get('posts')
  @RequirePermissions('posts.read')
  async posts(@Query(zodPipe(adminListQuerySchema)) query: any) {
    return this.admin.listPosts(query);
  }

  @Post('posts/:id/moderate')
  @RequirePermissions('posts.moderate')
  async moderatePost(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('id') id: string,
    @Body(zodPipe(moderatePostSchema)) body: { isActive: boolean; reason: string },
  ) {
    return this.admin.moderatePost(admin.id, id, body.isActive, body.reason);
  }

  /* ------------------------- البلاغات والاعتراضات ---------------------- */

  @Get('reports')
  @RequirePermissions('reports.read')
  async reportsList(@Query(zodPipe(adminListQuerySchema)) query: any) {
    return this.reports.listForAdmin(query);
  }

  @Post('reports/:id/resolve')
  @RequirePermissions('reports.resolve')
  async resolveReport(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('id') id: string,
    @Body(zodPipe(resolveReportSchema)) body: any,
  ) {
    return this.reports.resolve(admin.id, id, body);
  }

  @Get('appeals')
  @RequirePermissions('appeals.read')
  async appealsList(@Query('status') status?: string) {
    return this.appeals.listForAdmin(status);
  }

  @Post('appeals/:id/decide')
  @RequirePermissions('appeals.resolve')
  async decideAppeal(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('id') id: string,
    @Body(zodPipe(decideAppealSchema)) body: { decision: 'ACCEPT' | 'REJECT'; note: string },
  ) {
    return this.appeals.decide(admin.id, id, body);
  }

  /* ---------------------------- شريط الشعارات -------------------------- */

  @Get('ticker')
  @RequirePermissions('ticker.read')
  async tickerList(@Query('status') status?: string) {
    return this.ticker.listForAdmin(status);
  }

  @Post('ticker/:id/review')
  @RequirePermissions('ticker.review')
  async reviewTicker(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('id') id: string,
    @Body(zodPipe(reviewTickerRequestSchema)) body: any,
  ) {
    return this.ticker.review(admin.id, id, body);
  }

  @Post('ticker/reorder')
  @RequirePermissions('ticker.review')
  async reorderTicker(
    @CurrentAdmin() admin: AuthAdmin,
    @Body(zodPipe(reorderTickerSchema)) body: { order: { id: string; sortWeight: number }[] },
  ) {
    await this.ticker.reorder(admin.id, body.order);
    return { ok: true };
  }

  /* ------------------------------ الكتالوج ----------------------------- */

  @Post('categories')
  @RequirePermissions('catalog.write')
  async upsertCategory(
    @CurrentAdmin() admin: AuthAdmin,
    @Body(zodPipe(upsertCategorySchema)) body: any,
  ) {
    return this.admin.upsertCategory(admin.id, body);
  }

  @Post('cities')
  @RequirePermissions('catalog.write')
  async upsertCity(@CurrentAdmin() admin: AuthAdmin, @Body(zodPipe(upsertCitySchema)) body: any) {
    return this.admin.upsertCity(admin.id, body);
  }

  /* ------------------------------- الأسعار ----------------------------- */

  @Get('pricing')
  @RequirePermissions('pricing.read')
  async pricingList() {
    return this.pricing.list(true);
  }

  @Post('pricing')
  @RequirePermissions('pricing.write')
  async upsertPricing(
    @CurrentAdmin() admin: AuthAdmin,
    @Body(zodPipe(upsertPricingSchema)) body: any,
  ) {
    return this.pricing.upsert(admin.id, body);
  }

  /* ------------------------------ المدفوعات ---------------------------- */

  @Get('payments')
  @RequirePermissions('payments.read')
  async payments(@Query(zodPipe(adminListQuerySchema)) query: any) {
    return this.admin.listPayments(query);
  }

  /* ------------------------------ الإشعارات ---------------------------- */

  @Post('notifications/broadcast')
  @RequirePermissions('notifications.send')
  async broadcast(
    @CurrentAdmin() admin: AuthAdmin,
    @Body(zodPipe(sendNotificationSchema)) body: any,
  ) {
    return this.admin.broadcast(admin.id, body);
  }

  /* ------------------------- الإعدادات وسجل الإجراءات ------------------ */

  @Get('settings')
  @RequirePermissions('settings.read')
  async settings() {
    return this.admin.listSettings();
  }

  @Patch('settings')
  @RequirePermissions('settings.write')
  async updateSetting(
    @CurrentAdmin() admin: AuthAdmin,
    @Body(zodPipe(updateSettingSchema)) body: { key: string; value: unknown },
  ) {
    return this.admin.updateSetting(admin.id, body.key, body.value);
  }

  @Get('audit-logs')
  @RequirePermissions('audit.read')
  async auditLogs(@Query(zodPipe(adminListQuerySchema)) query: any, @Query('entityType') entityType?: string) {
    return this.admin.listAuditLogs({ ...query, entityType });
  }
}
