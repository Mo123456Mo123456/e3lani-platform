import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  addPricingVersionSchema, adminListQuerySchema, adminModerateAdSchema, createAdminUserSchema,
  createRefundSchema, handleDataRequestSchema, resolveReportSchema, reviewTickerRequestSchema,
  sendNotificationSchema, updateSettingSchema, upsertCategorySchema, upsertCitySchema,
  upsertPricingItemSchema,
} from '@e3lani/types';
import { AdminService } from './admin.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PricingService } from '../pricing/pricing.service';
import { ReportsService } from '../moderation/reports.service';
import { AppealsService } from '../moderation/appeals.service';
import { TickerService } from '../ticker/ticker.service';
import { AdsService } from '../ads/ads.service';
import { PaymentsService } from '../payments/payments.service';
import { PrivacyService } from '../privacy/privacy.service';
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
    private readonly ads: AdsService,
    private readonly payments: PaymentsService,
    private readonly privacy: PrivacyService,
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
  async adsList(@Query(zodPipe(adminListQuerySchema)) query: any) {
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

  @Get('ads/:id/revisions')
  @RequirePermissions('ads.read')
  async adRevisions(@Param('id') id: string) {
    return this.ads.revisions(id, { isAdmin: true });
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
    return this.pricing.listForAdmin();
  }

  @Get('pricing/:key/history')
  @RequirePermissions('pricing.read')
  async pricingHistory(@Param('key') key: string) {
    return this.pricing.history(key);
  }

  /** تعديل تعريف الخدمة (الأسماء والتفعيل) — لا يمس السعر. */
  @Post('pricing/items')
  @RequirePermissions('pricing.write')
  async upsertPricingItem(
    @CurrentAdmin() admin: AuthAdmin,
    @Body(zodPipe(upsertPricingItemSchema)) body: any,
  ) {
    return this.pricing.upsertItem(admin.id, body);
  }

  /** إضافة إصدار سعر جديد: فوري أو مجدول بتاريخ مستقبلي. */
  @Post('pricing/versions')
  @RequirePermissions('pricing.write')
  async addPricingVersion(
    @CurrentAdmin() admin: AuthAdmin,
    @Body(zodPipe(addPricingVersionSchema)) body: any,
  ) {
    const { key, ...rest } = body;
    return this.pricing.addVersion(admin.id, key, rest);
  }

  @Delete('pricing/versions/:id')
  @RequirePermissions('pricing.write')
  async cancelPricingVersion(@CurrentAdmin() admin: AuthAdmin, @Param('id') id: string) {
    await this.pricing.cancelScheduled(admin.id, id);
    return { cancelled: true };
  }

  @Post('pricing/:key/rollback')
  @RequirePermissions('pricing.write')
  async rollbackPricing(@CurrentAdmin() admin: AuthAdmin, @Param('key') key: string) {
    return this.pricing.rollback(admin.id, key);
  }

  @Patch('pricing/:key/active')
  @RequirePermissions('pricing.write')
  async togglePricing(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('key') key: string,
    @Body(zodPipe(z.object({ isActive: z.boolean() }))) body: { isActive: boolean },
  ) {
    return this.pricing.setActive(admin.id, key, body.isActive);
  }

  /* ------------------------------ المدفوعات ---------------------------- */

  @Get('payments')
  @RequirePermissions('payments.read')
  async paymentsList(@Query(zodPipe(adminListQuerySchema)) query: any) {
    return this.admin.listPayments(query);
  }

  /** كل تفاصيل العملية: المحاولات مع البوابة والاستردادات والفاتورة. */
  @Get('payments/:id')
  @RequirePermissions('payments.read')
  async paymentDetails(@Param('id') id: string) {
    return this.payments.detailsForAdmin(id);
  }

  @Post('payments/:id/refund')
  @RequirePermissions('payments.refund')
  async refundPayment(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('id') id: string,
    @Body(zodPipe(createRefundSchema)) body: { amountHalalas?: number; reason: string },
  ) {
    return this.payments.refund(admin.id, id, body);
  }

  /* ------------------------ طلبات بيانات المستخدم ---------------------- */

  @Get('data-requests')
  @RequirePermissions('users.read')
  async dataRequests(@Query('status') status?: string) {
    return this.privacy.listRequests(status);
  }

  @Post('data-requests/:id/handle')
  @RequirePermissions('users.write')
  async handleDataRequest(
    @CurrentAdmin() admin: AuthAdmin,
    @Param('id') id: string,
    @Body(zodPipe(handleDataRequestSchema)) body: any,
  ) {
    return this.privacy.handleRequest(admin.id, id, body);
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
