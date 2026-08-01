import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { halalasToSar } from '@e3lani/config';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

/** نسبة ضريبة القيمة المضافة بنقاط الأساس (١٥٪ = 1500). */
export const DEFAULT_VAT_BPS = 1500;

/**
 * الأسعار المعروضة شاملة للضريبة، لذا تُستخرج الضريبة من الإجمالي لا تُضاف عليه.
 * مثال: ٥٩ ريال شاملة ١٥٪ ← أساس ٥١٫٣٠ + ضريبة ٧٫٧٠.
 */
export function splitVatInclusive(
  totalHalalas: number,
  vatBps: number = DEFAULT_VAT_BPS,
): { subtotal: number; vat: number; total: number } {
  const subtotal = Math.round((totalHalalas * 10_000) / (10_000 + vatBps));
  return { subtotal, vat: totalHalalas - subtotal, total: totalHalalas };
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitHalalas: number;
  totalHalalas: number;
}

/**
 * الفوترة والاستردادات ومحاولات الدفع.
 *
 * الأسعار المعروضة شاملة لضريبة القيمة المضافة (كما يوجب النظام السعودي)،
 * لذلك تُحتسب الضريبة استخراجًا من الإجمالي وليس إضافة عليه.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly vatBps: number;
  private readonly sellerName: string;
  private readonly sellerVatNumber?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    this.vatBps = Number(config.get('VAT_RATE_BPS') ?? DEFAULT_VAT_BPS);
    this.sellerName = config.get<string>('INVOICE_SELLER_NAME') ?? 'منصة إعلاني';
    this.sellerVatNumber = config.get<string>('INVOICE_SELLER_VAT_NUMBER') || undefined;
  }

  /* ------------------------- محاولات الدفع ----------------------------- */

  async recordAttempt(
    paymentId: string,
    provider: string,
    input: {
      status: 'STARTED' | 'SUCCEEDED' | 'FAILED';
      providerRef?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      payload?: unknown;
    },
  ): Promise<void> {
    try {
      await this.prisma.paymentAttempt.create({
        data: {
          paymentId,
          provider,
          status: input.status,
          providerRef: input.providerRef ?? null,
          errorCode: input.errorCode ?? null,
          errorMessage: input.errorMessage ?? null,
          payload: (input.payload ?? null) as any,
        },
      });
    } catch (error) {
      this.logger.warn(`تعذّر تسجيل محاولة الدفع: ${(error as Error).message}`);
    }
  }

  async attemptsFor(paymentId: string) {
    return this.prisma.paymentAttempt.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /* ---------------------------- الفواتير ------------------------------- */

  /** يولّد رقم فاتورة تسلسليًا متصلًا لكل سنة: E3-2026-000001 */
  private async nextInvoiceNumber(tx: any, year: number): Promise<string> {
    const counter = await tx.invoiceCounter.upsert({
      where: { year },
      update: { lastValue: { increment: 1 } },
      create: { year, lastValue: 1 },
    });
    return `E3-${year}-${String(counter.lastValue).padStart(6, '0')}`;
  }

  /** ينشئ فاتورة ضريبية للعملية المدفوعة (مرة واحدة فقط لكل عملية). */
  async issueInvoice(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: true,
        user: { select: { name: true, phone: true } },
      },
    });
    if (!payment) throw new NotFoundException({ message: 'العملية غير موجودة', code: 'PAYMENT_NOT_FOUND' });
    if (payment.invoice) return payment.invoice;
    if (payment.status !== 'PAID') {
      throw new BadRequestException({ message: 'لا تُصدر فاتورة لعملية غير مدفوعة', code: 'PAYMENT_NOT_PAID' });
    }

    const { subtotal, vat, total } = splitVatInclusive(payment.amountHalalas, this.vatBps);

    const items = Array.isArray(payment.items) ? (payment.items as any[]) : [];
    const lines: InvoiceLine[] = items.map((item) => ({
      description: item.nameAr ?? item.pricingKey,
      quantity: item.quantity ?? 1,
      unitHalalas: Math.round((item.amountHalalas ?? 0) / (item.quantity ?? 1)),
      totalHalalas: item.amountHalalas ?? 0,
    }));

    const year = new Date().getUTCFullYear();

    const invoice = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextInvoiceNumber(tx, year);
      return tx.invoice.create({
        data: {
          paymentId,
          number,
          subtotalHalalas: subtotal,
          vatHalalas: vat,
          totalHalalas: total,
          vatRateBps: this.vatBps,
          buyerName: payment.user.name,
          buyerPhone: payment.user.phone,
          sellerName: this.sellerName,
          sellerVatNumber: this.sellerVatNumber ?? null,
          lines: lines as any,
        },
      });
    });

    await this.audit.record({
      action: 'invoice.issued',
      entityType: 'Invoice',
      entityId: invoice.id,
      actorUserId: payment.userId,
      after: { number: invoice.number, totalHalalas: total },
    });

    return invoice;
  }

  async invoiceFor(paymentId: string, userId?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { paymentId },
      include: { payment: { select: { userId: true, createdAt: true, provider: true } } },
    });
    if (!invoice) throw new NotFoundException({ message: 'لا توجد فاتورة', code: 'INVOICE_NOT_FOUND' });
    if (userId && invoice.payment.userId !== userId) {
      throw new NotFoundException({ message: 'لا توجد فاتورة', code: 'INVOICE_NOT_FOUND' });
    }
    return {
      number: invoice.number,
      issuedAt: invoice.issuedAt.toISOString(),
      subtotalSar: halalasToSar(invoice.subtotalHalalas),
      vatSar: halalasToSar(invoice.vatHalalas),
      totalSar: halalasToSar(invoice.totalHalalas),
      vatRatePercent: invoice.vatRateBps / 100,
      buyerName: invoice.buyerName,
      buyerPhone: invoice.buyerPhone,
      sellerName: invoice.sellerName,
      sellerVatNumber: invoice.sellerVatNumber,
      lines: invoice.lines,
    };
  }

  async listInvoices(userId: string) {
    const rows = await this.prisma.invoice.findMany({
      where: { payment: { userId } },
      orderBy: { issuedAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({
      number: row.number,
      issuedAt: row.issuedAt.toISOString(),
      totalSar: halalasToSar(row.totalHalalas),
      paymentId: row.paymentId,
    }));
  }

  /* --------------------------- الاستردادات ----------------------------- */

  /** المبلغ القابل للاسترداد = المدفوع ناقص ما سبق استرداده. */
  async refundableAmount(paymentId: string): Promise<number> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { refunds: { where: { status: { in: ['PENDING', 'COMPLETED'] } } } },
    });
    const refunded = payment.refunds.reduce((sum, refund) => sum + refund.amountHalalas, 0);
    return Math.max(0, payment.amountHalalas - refunded);
  }

  async createRefund(
    adminId: string,
    paymentId: string,
    input: { amountHalalas?: number; reason: string },
    executor: (providerRef: string, amount: number) => Promise<boolean>,
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException({ message: 'العملية غير موجودة', code: 'PAYMENT_NOT_FOUND' });
    if (payment.status !== 'PAID') {
      throw new BadRequestException({ message: 'لا يمكن استرداد عملية غير مدفوعة', code: 'PAYMENT_NOT_PAID' });
    }

    const available = await this.refundableAmount(paymentId);
    const amount = input.amountHalalas ?? available;

    if (amount <= 0 || amount > available) {
      throw new BadRequestException({
        message: `المبلغ القابل للاسترداد ${halalasToSar(available)} ريال فقط`,
        code: 'REFUND_AMOUNT_INVALID',
      });
    }

    const refund = await this.prisma.refund.create({
      data: {
        paymentId,
        amountHalalas: amount,
        reason: input.reason,
        requestedByAdminId: adminId,
      },
    });

    let succeeded = false;
    let failureReason: string | null = null;
    try {
      succeeded = await executor(payment.providerRef ?? '', amount);
    } catch (error) {
      failureReason = (error as Error).message;
    }

    const updated = await this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: succeeded ? 'COMPLETED' : 'FAILED',
        failureReason: succeeded ? null : (failureReason ?? 'رفض المزوّد عملية الاسترداد'),
        completedAt: succeeded ? new Date() : null,
      },
    });

    if (succeeded) {
      const remaining = await this.refundableAmount(paymentId);
      if (remaining === 0) {
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });
      }

      await this.notifications.notify(payment.userId, 'PAYMENT_REFUNDED', {
        titleAr: 'تم استرداد مبلغ',
        titleEn: 'Refund processed',
        bodyAr: `تم استرداد ${halalasToSar(amount)} ريال. ${input.reason}`,
        bodyEn: `A refund of SAR ${halalasToSar(amount)} was processed. ${input.reason}`,
        data: { paymentId, refundId: refund.id },
      });
    }

    await this.audit.record({
      action: succeeded ? 'payment.refunded' : 'payment.refund_failed',
      entityType: 'Payment',
      entityId: paymentId,
      actorAdminId: adminId,
      reason: input.reason,
      after: { amountHalalas: amount, status: updated.status },
    });

    return updated;
  }

  async refundsFor(paymentId: string) {
    return this.prisma.refund.findMany({ where: { paymentId }, orderBy: { createdAt: 'desc' } });
  }
}
