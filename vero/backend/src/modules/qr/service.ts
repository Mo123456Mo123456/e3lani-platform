import QRCode from 'qrcode';
import { audit } from '../../core/audit.js';
import type { Ctx } from '../../core/context.js';
import { AppError, notFound } from '../../core/errors.js';
import { COLORS, createDoc, docToBuffer, pageFooter, text } from '../../core/pdf.js';
import { ar } from '../../core/arabic.js';
import { buildQrToken, newNonce } from '../../core/qr-token.js';
import { one, query, rows } from '../../db/pool.js';
import { requireCompany } from '../company/service.js';
import { existsSync } from 'node:fs';

export interface QrSummary {
  totalBins: number;
  generated: number;
  printed: number;
  notPrinted: number;
  missing: number;
}

export async function qrSummary(companyId: string): Promise<QrSummary> {
  const r = await one<{
    total: number;
    generated: number;
    printed: number;
    missing: number;
  }>(
    `SELECT
      (SELECT count(*)::int FROM bins WHERE company_id = $1) AS total,
      (SELECT count(*)::int FROM qr_tokens WHERE company_id = $1 AND is_active) AS generated,
      (SELECT count(*)::int FROM bins WHERE company_id = $1 AND qr_printed_at IS NOT NULL) AS printed,
      (SELECT count(*)::int FROM bins b WHERE b.company_id = $1
         AND NOT EXISTS (SELECT 1 FROM qr_tokens q WHERE q.bin_id = b.id AND q.is_active)) AS missing`,
    [companyId],
  );
  const total = r?.total ?? 0;
  const printed = r?.printed ?? 0;
  return {
    totalBins: total,
    generated: r?.generated ?? 0,
    printed,
    notPrinted: Math.max(0, total - printed),
    missing: r?.missing ?? 0,
  };
}

export interface StickerSelection {
  binIds?: string[];
  sector?: string;
  all?: boolean;
  onlyNotPrinted?: boolean;
}

interface StickerBin {
  id: string;
  public_id: string;
  name: string | null;
  sector: string | null;
  nonce: string;
}

async function selectBins(companyId: string, sel: StickerSelection): Promise<StickerBin[]> {
  const where = ['b.company_id = $1', 'q.is_active'];
  const params: unknown[] = [companyId];
  let p = 1;

  if (sel.binIds && sel.binIds.length > 0) {
    where.push(`b.id = ANY($${++p}::uuid[])`);
    params.push(sel.binIds);
  } else if (sel.sector) {
    where.push(`b.sector = $${++p}`);
    params.push(sel.sector);
  } else if (!sel.all) {
    throw new AppError('BAD_REQUEST', 'حدّد حاويات أو قطاعًا أو اختر «كل الحاويات»');
  }
  if (sel.onlyNotPrinted) where.push('b.qr_printed_at IS NULL');

  const list = await rows<StickerBin>(
    `SELECT b.id, b.public_id, b.name, b.sector, q.nonce
       FROM bins b JOIN qr_tokens q ON q.bin_id = b.id
      WHERE ${where.join(' AND ')}
      ORDER BY b.public_id`,
    params,
  );
  if (list.length === 0) throw notFound('لا توجد حاويات مطابقة للاختيار');
  return list;
}

/**
 * ملصقات QR جاهزة للطباعة على A4.
 * تخطيط 3 أعمدة × 5 صفوف = 15 ملصقًا في الصفحة، بحدود قص متقطعة.
 */
export async function generateStickersPdf(
  ctx: Ctx,
  sel: StickerSelection,
): Promise<{ pdf: Buffer; count: number; binIds: string[] }> {
  const company = await requireCompany();
  const bins = await selectBins(ctx.companyId, sel);

  const doc = createDoc({ margin: 20 });
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = 20;
  const cols = 3;
  const rowsPerPage = 5;
  const cellW = (pageW - margin * 2) / cols;
  const cellH = (pageH - margin * 2) / rowsPerPage;

  const logoPath = company.logo_path && existsSync(company.logo_path) ? company.logo_path : null;

  // نولّد كل صور QR مسبقًا (أسرع من التوليد داخل حلقة الرسم)
  const qrImages = await Promise.all(
    bins.map((b) =>
      QRCode.toBuffer(buildQrToken(b.public_id, b.nonce), {
        errorCorrectionLevel: 'M',
        margin: 0,
        width: 320,
        color: { dark: '#0F4C4AFF', light: '#FFFFFFFF' },
      }),
    ),
  );

  for (let i = 0; i < bins.length; i++) {
    const bin = bins[i]!;
    const posInPage = i % (cols * rowsPerPage);
    if (i > 0 && posInPage === 0) doc.addPage();

    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);
    const x = margin + col * cellW;
    const y = margin + row * cellH;
    const pad = 8;

    // حد القص
    doc
      .save()
      .dash(2, { space: 2 })
      .lineWidth(0.5)
      .strokeColor(COLORS.line)
      .rect(x + 2, y + 2, cellW - 4, cellH - 4)
      .stroke()
      .undash()
      .restore();

    // شريط علوي بهوية الشركة
    doc
      .save()
      .rect(x + 4, y + 4, cellW - 8, 22)
      .fill(COLORS.primary)
      .restore();

    if (logoPath) {
      try {
        doc.image(logoPath, x + cellW - 26, y + 6, { fit: [18, 18] });
      } catch {
        /* شعار غير صالح */
      }
    }
    doc
      .font('ar-bold')
      .fontSize(8.5)
      .fillColor(COLORS.white)
      .text(ar(company.name), x + pad, y + 10, {
        width: cellW - pad * 2 - (logoPath ? 24 : 0),
        align: 'right',
        lineBreak: false,
      });

    // رمز QR
    const qrSize = Math.min(cellW - pad * 2, cellH - 78);
    const qrX = x + (cellW - qrSize) / 2;
    const qrY = y + 30;
    doc.image(qrImages[i]!, qrX, qrY, { width: qrSize, height: qrSize });

    // رقم الحاوية
    doc
      .font('ar-bold')
      .fontSize(11)
      .fillColor(COLORS.text)
      .text(bin.public_id, x + pad, qrY + qrSize + 4, {
        width: cellW - pad * 2,
        align: 'center',
        lineBreak: false,
      });

    // العبارة التوجيهية
    doc
      .font('ar')
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(ar('امسح الرمز لإثبات الخدمة'), x + pad, qrY + qrSize + 19, {
        width: cellW - pad * 2,
        align: 'center',
        lineBreak: false,
      });

    if (bin.name || bin.sector) {
      doc
        .font('ar')
        .fontSize(6.5)
        .fillColor(COLORS.muted)
        .text(ar([bin.name, bin.sector].filter(Boolean).join(' · ')), x + pad, qrY + qrSize + 30, {
          width: cellW - pad * 2,
          align: 'center',
          lineBreak: false,
        });
    }
  }

  const pdf = await docToBuffer(doc);
  const binIds = bins.map((b) => b.id);

  await query('UPDATE qr_tokens SET print_count = print_count + 1 WHERE bin_id = ANY($1::uuid[])', [
    binIds,
  ]);
  await audit(ctx, {
    action: 'qr.stickers.generate',
    entity: 'qr',
    after: { count: bins.length, selection: sel },
  });

  return { pdf, count: bins.length, binIds };
}

export async function markPrinted(ctx: Ctx, binIds: string[]): Promise<number> {
  const res = await query(
    'UPDATE bins SET qr_printed_at = now() WHERE company_id = $1 AND id = ANY($2::uuid[])',
    [ctx.companyId, binIds],
  );
  await audit(ctx, {
    action: 'qr.mark_printed',
    entity: 'bin',
    after: { count: res.rowCount ?? 0 },
  });
  return res.rowCount ?? 0;
}

export async function binQrPng(companyId: string, binId: string, size = 400): Promise<Buffer> {
  const row = await one<{ public_id: string; nonce: string }>(
    `SELECT b.public_id, q.nonce FROM bins b
      JOIN qr_tokens q ON q.bin_id = b.id AND q.is_active
     WHERE b.id = $1 AND b.company_id = $2`,
    [binId, companyId],
  );
  if (!row) throw notFound('لا يوجد رمز QR فعّال لهذه الحاوية');
  return QRCode.toBuffer(buildQrToken(row.public_id, row.nonce), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: Math.min(1200, Math.max(120, size)),
  });
}

/**
 * إعادة توليد رمز حاوية. تُستخدم فقط عند الاشتباه في تسريب الرمز —
 * وليست إجراء إعادة الطباعة العادي، لأن إعادة الطباعة تُبقي نفس الرمز.
 */
export async function regenerateToken(ctx: Ctx, binId: string): Promise<string> {
  const bin = await one<{ id: string; public_id: string }>(
    'SELECT id, public_id FROM bins WHERE id = $1 AND company_id = $2',
    [binId, ctx.companyId],
  );
  if (!bin) throw notFound('الحاوية غير موجودة');

  await query('UPDATE qr_tokens SET is_active = false, revoked_at = now() WHERE bin_id = $1', [
    binId,
  ]);
  const nonce = newNonce();
  await query(
    'INSERT INTO qr_tokens (company_id, bin_id, nonce, token_version) VALUES ($1,$2,$3, (SELECT COALESCE(MAX(token_version),0)+1 FROM qr_tokens WHERE bin_id = $2))',
    [ctx.companyId, binId, nonce],
  );
  await query('UPDATE bins SET qr_printed_at = NULL WHERE id = $1', [binId]);

  await audit(ctx, {
    action: 'qr.regenerate',
    entity: 'bin',
    entityId: binId,
    after: { publicId: bin.public_id, note: 'الرمز السابق أُلغي ولن يُقبل بعد الآن' },
  });
  return buildQrToken(bin.public_id, nonce);
}

/** ورقة تفعيل جهاز عامل: كود + QR جاهز للطباعة. */
export async function activationSheetPdf(
  companyId: string,
  data: { code: string; workerName: string; vehicleNo: string; expiresAt: string },
): Promise<Buffer> {
  const company = await requireCompany();
  if (company.id !== companyId) throw notFound('الشركة غير مطابقة');

  const doc = createDoc({ margin: 40 });
  const { left, right } = doc.page.margins;
  const width = doc.page.width - left - right;

  doc.save().rect(left, 40, width, 50).fill(COLORS.primary).restore();
  doc
    .font('ar-bold')
    .fontSize(15)
    .fillColor(COLORS.white)
    .text(ar(company.name), left + 10, 55, { width: width - 20, align: 'right', lineBreak: false });
  doc
    .font('ar-bold')
    .fontSize(13)
    .fillColor(COLORS.white)
    .text('VERO', left + 10, 57, { width: 100, align: 'left', lineBreak: false });

  text(doc, 'ورقة تفعيل جهاز عامل', left, 110, {
    size: 16,
    bold: true,
    width,
    align: 'center',
  });

  const png = await QRCode.toBuffer(`vero-activate:${data.code}`, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 500,
  });
  const qrSize = 200;
  doc.image(png, left + (width - qrSize) / 2, 145, { width: qrSize, height: qrSize });

  doc
    .font('ar-bold')
    .fontSize(24)
    .fillColor(COLORS.primary)
    .text(data.code, left, 360, { width, align: 'center', lineBreak: false });

  text(doc, `العامل: ${data.workerName}`, left, 400, { size: 11, width, align: 'center' });
  text(doc, `السيارة: ${data.vehicleNo}`, left, 418, { size: 11, width, align: 'center' });
  text(doc, `صالح حتى: ${data.expiresAt.slice(0, 16).replace('T', ' ')}`, left, 436, {
    size: 10,
    color: COLORS.muted,
    width,
    align: 'center',
  });

  text(
    doc,
    'افتح تطبيق VERO على جوال العامل، ثم امسح هذا الرمز مرة واحدة. لا حاجة لتسجيل دخول يومي بعدها.',
    left + 30,
    470,
    { size: 10, width: width - 60, align: 'center', color: COLORS.text },
  );
  text(doc, 'لا تشارك هذا الكود — يُستخدم مرة واحدة فقط.', left + 30, 505, {
    size: 9,
    width: width - 60,
    align: 'center',
    color: COLORS.danger,
  });

  pageFooter(doc, `${company.name} — ورقة تفعيل`);
  return docToBuffer(doc);
}
