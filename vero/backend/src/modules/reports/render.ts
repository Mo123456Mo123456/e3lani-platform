import { existsSync } from 'node:fs';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';
import { env } from '../../config/env.js';
import { ar } from '../../core/arabic.js';
import {
  COLORS,
  brandHeader,
  createDoc,
  docToBuffer,
  pageFooter,
  rule,
  statCard,
  table,
  text,
  type Doc,
} from '../../core/pdf.js';
import type { CompanyRow } from '../company/service.js';
import type { ReportDto } from './service.js';

const KIND_AR: Record<string, string> = {
  DAILY: 'تقرير يومي',
  WEEKLY: 'تقرير أسبوعي',
  MONTHLY: 'تقرير شهري',
  CUSTOM: 'تقرير فترة مخصصة',
};

const REASON_AR: Record<string, string> = {
  OUT_OF_RANGE: 'خارج النطاق',
  LOW_GPS_ACCURACY: 'دقة GPS ضعيفة',
  IMPLAUSIBLE_SPEED: 'انتقال غير منطقي',
  ROUTE_MISMATCH: 'خارج مسار السيارة',
  FUTURE_TIMESTAMP: 'وقت مستقبلي',
  STALE_TIMESTAMP: 'وقت قديم جدًا',
  TOKEN_BAD_SIGNATURE: 'توقيع رمز غير صالح',
  TOKEN_MALFORMED: 'رمز غير مقروء',
  TOKEN_REVOKED: 'رمز ملغى',
  BIN_NOT_FOUND: 'حاوية غير معروفة',
  BIN_DISABLED: 'حاوية معطّلة',
  INVALID_LOCATION: 'إحداثيات غير صالحة',
};

const translateReasons = (list: string[]): string =>
  list.map((r) => REASON_AR[r] ?? r).join('، ') || '—';

const fmtDateTime = (iso: string): string => iso.slice(0, 16).replace('T', ' ');

/**
 * تقرير PDF رسمي بهوية الشركة، جاهز للتقديم إلى البلدية أو الجهة المتعاقدة.
 * يتضمّن رمز QR للتحقق من صحة التقرير عبر رابط عام لا يكشف بيانات تشغيلية.
 */
export async function renderReportPdf(
  report: ReportDto,
  company: CompanyRow,
): Promise<Buffer> {
  const p = report.payload;
  const doc = createDoc({ margin: 36 });
  const { left, right } = doc.page.margins;
  const width = doc.page.width - left - right;
  const logoPath = company.logo_path && existsSync(company.logo_path) ? company.logo_path : null;
  const brand = { companyName: company.name, logoPath };

  const header = (d: Doc): number =>
    brandHeader(d, brand, `${KIND_AR[p.kind] ?? 'تقرير'} — إثبات تنفيذ خدمات النظافة`);

  let y = header(doc);

  // ── بيانات التقرير ──
  const metaRows = [
    ['رقم التقرير', report.reportNo],
    ['فترة التقرير', `${p.periodStart}  إلى  ${p.periodEnd}  (${p.days} يوم)`],
    ['تاريخ الإصدار', fmtDateTime(report.createdAt)],
    ['الجهة / العقد', p.sla.contractName ?? 'غير مرتبط بعقد'],
    ['أصدره', report.createdByName ?? '—'],
  ];
  for (const [k, v] of metaRows) {
    text(doc, `${k}:`, left + width - 110, y, { size: 9, bold: true, width: 110 });
    text(doc, String(v), left, y, { size: 9, width: width - 118, align: 'right' });
    y += 14;
  }
  y += 6;
  rule(doc, left, y, width);
  y += 12;

  // ── ملخّص الالتزام ──
  text(doc, 'ملخّص الالتزام بالعقد', left, y, { size: 12, bold: true, width, align: 'right' });
  y += 20;

  const cardW = (width - 4 * 6) / 5;
  const cards: [label: string, value: string, color: string][] = [
    ['الزيارات المطلوبة', String(p.sla.requiredVisits), COLORS.primary],
    ['المنفَّذ (Verified)', String(p.sla.verified), COLORS.success],
    ['تحتاج مراجعة', String(p.sla.suspicious), COLORS.warning],
    ['غير المنفَّذ', String(p.sla.missed), COLORS.danger],
    ['نسبة الالتزام', `${p.sla.complianceRate}%`, COLORS.accent],
  ];
  cards.forEach((c, i) => {
    statCard(doc, left + i * (cardW + 6), y, cardW, 46, c[0], c[1], c[2]);
  });
  y += 58;

  text(
    doc,
    `عدد نقاط الخدمة: ${p.sla.servicePoints} · الزيارات المطلوبة يوميًا لكل نقطة: ${p.sla.requiredVisitsPerDay} · محاولات مسح غير صالحة: ${p.sla.invalidAttempts}`,
    left,
    y,
    { size: 8.5, color: COLORS.muted, width, align: 'right' },
  );
  y += 22;

  // ── الأداء اليومي ──
  if (p.byDay.length > 0) {
    text(doc, 'الأداء اليومي', left, y, { size: 11, bold: true, width, align: 'right' });
    y += 16;
    y = table(doc, {
      x: left,
      y,
      onNewPage: header,
      columns: [
        { key: 'day', header: 'اليوم', width: width * 0.24 },
        { key: 'required', header: 'المطلوب', width: width * 0.19, align: 'center' },
        { key: 'verified', header: 'المنفَّذ', width: width * 0.19, align: 'center' },
        { key: 'missed', header: 'غير المنفَّذ', width: width * 0.19, align: 'center' },
        { key: 'ratio', header: 'النسبة', width: width * 0.19, align: 'center' },
      ],
      rows: p.byDay.map((d) => ({
        day: d.label,
        required: d.required,
        verified: d.verified,
        missed: d.missed,
        ratio: `${d.ratio}%`,
      })),
    });
    y += 18;
  }

  // ── أداء السيارات / العمال / القطاعات ──
  const perfSections: [string, typeof p.byVehicle, string][] = [
    ['أداء السيارات', p.byVehicle, 'السيارة'],
    ['أداء العمال', p.byWorker, 'العامل'],
    ['أداء القطاعات', p.bySector, 'القطاع'],
  ];
  for (const [title, dataRows, keyHeader] of perfSections) {
    if (dataRows.length === 0) continue;
    if (y > doc.page.height - 160) {
      doc.addPage();
      y = header(doc);
    }
    text(doc, title, left, y, { size: 11, bold: true, width, align: 'right' });
    y += 16;
    y = table(doc, {
      x: left,
      y,
      onNewPage: header,
      columns: [
        { key: 'label', header: keyHeader, width: width * 0.4 },
        { key: 'verified', header: 'موثّقة', width: width * 0.2, align: 'center' },
        { key: 'suspicious', header: 'مشبوهة', width: width * 0.2, align: 'center' },
        { key: 'ratio', header: 'نسبة الجودة', width: width * 0.2, align: 'center' },
      ],
      rows: dataRows.map((r) => ({
        label: r.label,
        verified: r.verified,
        suspicious: r.suspicious,
        ratio: `${r.ratio}%`,
      })),
    });
    y += 18;
  }

  // ── ملخّص خطوط السير ──
  if (y > doc.page.height - 140) {
    doc.addPage();
    y = header(doc);
  }
  text(doc, 'ملخّص خطوط السير', left, y, { size: 11, bold: true, width, align: 'right' });
  y += 16;
  text(
    doc,
    `عدد جلسات العمل: ${p.routes.sessions} · إجمالي المسافة: ${p.routes.totalDistanceKm} كم · السيارات العاملة: ${p.routes.vehiclesActive}`,
    left,
    y,
    { size: 9.5, width, align: 'right' },
  );
  y += 24;

  // ── الاستثناءات ──
  const missedBins = p.exceptions.binsNeverServiced;
  if (missedBins.length > 0) {
    if (y > doc.page.height - 160) {
      doc.addPage();
      y = header(doc);
    }
    text(
      doc,
      `نقاط لم تُخدَم خلال الفترة (${missedBins.length})`,
      left,
      y,
      { size: 11, bold: true, color: COLORS.danger, width, align: 'right' },
    );
    y += 16;
    y = table(doc, {
      x: left,
      y,
      onNewPage: header,
      headerFill: COLORS.danger,
      columns: [
        { key: 'publicId', header: 'رقم الحاوية', width: width * 0.3 },
        { key: 'name', header: 'الوصف', width: width * 0.4 },
        { key: 'sector', header: 'القطاع', width: width * 0.3 },
      ],
      rows: missedBins.slice(0, 200).map((b) => ({
        publicId: b.publicId,
        name: b.name ?? '—',
        sector: b.sector ?? '—',
      })),
    });
    if (missedBins.length > 200) {
      y += 6;
      text(doc, `… و${missedBins.length - 200} نقطة أخرى (راجع ملف Excel)`, left, y, {
        size: 8,
        color: COLORS.muted,
        width,
        align: 'right',
      });
      y += 14;
    }
    y += 18;
  }

  const susp = p.exceptions.suspiciousScans;
  if (susp.length > 0) {
    if (y > doc.page.height - 160) {
      doc.addPage();
      y = header(doc);
    }
    text(doc, `زيارات تحتاج مراجعة (${susp.length})`, left, y, {
      size: 11,
      bold: true,
      color: COLORS.warning,
      width,
      align: 'right',
    });
    y += 16;
    y = table(doc, {
      x: left,
      y,
      onNewPage: header,
      headerFill: COLORS.warning,
      columns: [
        { key: 'bin', header: 'الحاوية', width: width * 0.18 },
        { key: 'at', header: 'الوقت', width: width * 0.22, align: 'center' },
        { key: 'worker', header: 'العامل', width: width * 0.2 },
        { key: 'distance', header: 'المسافة/النطاق', width: width * 0.18, align: 'center' },
        { key: 'reasons', header: 'السبب', width: width * 0.22 },
      ],
      rows: susp.slice(0, 150).map((s) => ({
        bin: s.binPublicId,
        at: fmtDateTime(s.scannedAt),
        worker: s.workerName ?? '—',
        distance: `${s.distanceM} / ${s.radiusM} م`,
        reasons: translateReasons(s.reasons),
      })),
    });
    y += 18;
  }

  // ── ختم التحقق ──
  if (y > doc.page.height - 150) {
    doc.addPage();
    y = header(doc);
  }
  const verifyUrl = `${env.publicBaseUrl}/v1/verify/${report.verifyToken}`;
  const qr = await QRCode.toBuffer(verifyUrl, { margin: 0, width: 260 });
  const boxH = 92;
  doc.save().roundedRect(left, y, width, boxH, 8).fill(COLORS.primarySoft).restore();
  doc.image(qr, left + 12, y + 12, { width: 68, height: 68 });

  text(doc, 'تقرير موثّق — Verified Report', left + 90, y + 14, {
    size: 11,
    bold: true,
    color: COLORS.primary,
    width: width - 100,
    align: 'right',
  });
  text(doc, `امسح الرمز للتحقق من صحة هذا التقرير: ${report.reportNo}`, left + 90, y + 34, {
    size: 8.5,
    color: COLORS.text,
    width: width - 100,
    align: 'right',
  });
  doc
    .font('ar')
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text(verifyUrl, left + 90, y + 50, { width: width - 100, align: 'right', lineBreak: false });
  text(
    doc,
    'يعرض رابط التحقق رقم التقرير والفترة ونسبة التنفيذ فقط، دون أي بيانات تشغيلية.',
    left + 90,
    y + 66,
    { size: 7.5, color: COLORS.muted, width: width - 100, align: 'right' },
  );

  // ترقيم الصفحات على كل الصفحات
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    pageFooter(
      doc,
      `${company.name} · ${report.reportNo} · صفحة ${i + 1} من ${range.count}`,
    );
  }

  return docToBuffer(doc);
}

/** ملف Excel كامل بكل تفاصيل التقرير، بما فيها القوائم الطويلة. */
export async function renderReportXlsx(report: ReportDto): Promise<Buffer> {
  const p = report.payload;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VERO';
  wb.created = new Date(report.createdAt);

  const styleHeader = (ws: ExcelJS.Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C4A' } };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 22;
    ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
  };

  // الملخّص
  const sum = wb.addWorksheet('الملخص');
  sum.views = [{ rightToLeft: true }];
  sum.columns = [
    { header: 'البند', key: 'k', width: 32 },
    { header: 'القيمة', key: 'v', width: 34 },
  ];
  styleHeader(sum);
  const summaryRows: [string, string | number][] = [
    ['اسم الشركة', p.company.name],
    ['رقم التقرير', report.reportNo],
    ['نوع التقرير', KIND_AR[p.kind] ?? p.kind],
    ['من', p.periodStart],
    ['إلى', p.periodEnd],
    ['عدد الأيام', p.days],
    ['تاريخ الإصدار', fmtDateTime(report.createdAt)],
    ['العقد', p.sla.contractName ?? '—'],
    ['نقاط الخدمة', p.sla.servicePoints],
    ['الزيارات المطلوبة يوميًا لكل نقطة', p.sla.requiredVisitsPerDay],
    ['إجمالي الزيارات المطلوبة', p.sla.requiredVisits],
    ['المنفَّذ (Verified)', p.sla.verified],
    ['تحتاج مراجعة (Suspicious)', p.sla.suspicious],
    ['محاولات غير صالحة (Invalid)', p.sla.invalidAttempts],
    ['غير المنفَّذ', p.sla.missed],
    ['نسبة الالتزام %', p.sla.complianceRate],
    ['جلسات العمل', p.routes.sessions],
    ['إجمالي مسافة السير (كم)', p.routes.totalDistanceKm],
    ['رمز التحقق', report.verifyToken],
  ];
  for (const [k, v] of summaryRows) sum.addRow({ k, v });

  const dimSheet = (name: string, keyHeader: string, list: typeof p.byVehicle) => {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { header: keyHeader, key: 'label', width: 30 },
      { header: 'المطلوب', key: 'required', width: 12 },
      { header: 'موثّقة', key: 'verified', width: 12 },
      { header: 'مشبوهة', key: 'suspicious', width: 12 },
      { header: 'غير منفَّذ', key: 'missed', width: 12 },
      { header: 'النسبة %', key: 'ratio', width: 12 },
    ];
    styleHeader(ws);
    for (const r of list) {
      ws.addRow({
        label: r.label,
        required: r.required,
        verified: r.verified,
        suspicious: r.suspicious,
        missed: r.missed,
        ratio: r.ratio,
      });
    }
  };

  dimSheet('الأيام', 'اليوم', p.byDay);
  dimSheet('السيارات', 'السيارة', p.byVehicle);
  dimSheet('العمال', 'العامل', p.byWorker);
  dimSheet('القطاعات', 'القطاع', p.bySector);

  const missed = wb.addWorksheet('نقاط لم تُخدَم');
  missed.columns = [
    { header: 'رقم الحاوية', key: 'publicId', width: 18 },
    { header: 'الوصف', key: 'name', width: 30 },
    { header: 'القطاع', key: 'sector', width: 20 },
  ];
  styleHeader(missed);
  for (const b of p.exceptions.binsNeverServiced) {
    missed.addRow({ publicId: b.publicId, name: b.name ?? '', sector: b.sector ?? '' });
  }

  const susp = wb.addWorksheet('زيارات تحتاج مراجعة');
  susp.columns = [
    { header: 'الحاوية', key: 'bin', width: 16 },
    { header: 'الوقت', key: 'at', width: 20 },
    { header: 'العامل', key: 'worker', width: 24 },
    { header: 'المسافة (م)', key: 'distance', width: 14 },
    { header: 'النطاق (م)', key: 'radius', width: 14 },
    { header: 'السبب', key: 'reasons', width: 40 },
  ];
  styleHeader(susp);
  for (const s of p.exceptions.suspiciousScans) {
    susp.addRow({
      bin: s.binPublicId,
      at: fmtDateTime(s.scannedAt),
      worker: s.workerName ?? '',
      distance: s.distanceM,
      radius: s.radiusM,
      reasons: translateReasons(s.reasons),
    });
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/** صفحة تحقق عامة بسيطة (HTML) — لا تعرض بيانات تشغيلية. */
export function renderVerifyHtml(v: {
  reportNo: string;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  complianceRate: number;
  issuedAt: string;
}): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
    );
  return `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>تحقق من تقرير VERO — ${esc(v.reportNo)}</title>
<style>
  :root{--p:#0F4C4A;--a:#1FA97A;--t:#111827;--m:#6B7280;--l:#E5E7EB}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,'Segoe UI',Tahoma,sans-serif;background:#F5F7F7;color:var(--t);
       display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .card{background:#fff;border:1px solid var(--l);border-radius:16px;max-width:460px;width:100%;
        box-shadow:0 8px 28px rgba(15,76,74,.08);overflow:hidden}
  .head{background:var(--p);color:#fff;padding:20px 22px}
  .head h1{margin:0;font-size:19px;letter-spacing:.5px}
  .head p{margin:4px 0 0;font-size:12px;color:#CFE8E2}
  .body{padding:20px 22px}
  .badge{display:inline-flex;align-items:center;gap:8px;background:#E7F7F0;color:#0B7A55;
         border:1px solid #B7E6D3;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}
  td{padding:10px 4px;border-bottom:1px solid var(--l)}
  td:first-child{color:var(--m);width:44%}
  td:last-child{font-weight:600}
  .rate{font-size:30px;font-weight:800;color:var(--a);text-align:center;margin:18px 0 4px}
  .note{font-size:11px;color:var(--m);margin-top:16px;line-height:1.7}
</style></head><body>
<div class="card">
  <div class="head"><h1>VERO</h1><p>كل زيارة لها إثبات · Every Visit Has a Proof</p></div>
  <div class="body">
    <span class="badge">✔ تقرير موثّق — Verified Report</span>
    <div class="rate">${v.complianceRate}%</div>
    <div style="text-align:center;color:var(--m);font-size:12px">نسبة تنفيذ العقد</div>
    <table>
      <tr><td>رقم التقرير</td><td>${esc(v.reportNo)}</td></tr>
      <tr><td>الشركة</td><td>${esc(v.companyName)}</td></tr>
      <tr><td>الفترة</td><td>${esc(v.periodStart)} → ${esc(v.periodEnd)}</td></tr>
      <tr><td>تاريخ الإصدار</td><td>${esc(fmtDateTime(v.issuedAt))}</td></tr>
    </table>
    <p class="note">هذه الصفحة تؤكد أن التقرير صادر فعليًا عن نظام VERO الخاص بالشركة المذكورة.
    لا تُعرض هنا أي بيانات تشغيلية (حاويات، عمال، مواقع) حفاظًا على الخصوصية.</p>
  </div>
</div></body></html>`;
}

export { ar };
