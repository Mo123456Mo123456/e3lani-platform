import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { ar } from './arabic.js';

const here = dirname(fileURLToPath(import.meta.url));

/** مجلد الأصول يعمل في التطوير (src/) وبعد البناء (dist/) على السواء. */
function assetsDir(): string {
  const candidates = [
    join(here, '..', '..', 'assets'),
    join(here, '..', '..', '..', 'assets'),
    join(process.cwd(), 'assets'),
  ];
  for (const c of candidates) if (existsSync(join(c, 'fonts'))) return c;
  throw new Error('[VERO] تعذّر العثور على مجلد assets/fonts');
}

/**
 * خط واحد يغطي العربية واللاتينية والأرقام معًا.
 * ضروري لأن أسطر التقارير تخلط الاثنين (مثل «رقم الحاوية: VR-000248»)،
 * والخط العربي الخالي من اللاتينية يطبع مربعات فارغة مكانها.
 */
export const FONT_REGULAR = join(assetsDir(), 'fonts', 'IBMPlexSansArabic-Regular.ttf');
export const FONT_BOLD = join(assetsDir(), 'fonts', 'IBMPlexSansArabic-SemiBold.ttf');

export type Doc = PDFKit.PDFDocument;

export interface Brand {
  companyName: string;
  logoPath?: string | null;
}

export const COLORS = {
  primary: '#0F4C4A',
  primarySoft: '#E6F0EF',
  accent: '#1FA97A',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  text: '#111827',
  muted: '#6B7280',
  line: '#D1D5DB',
  bgSoft: '#F5F7F7',
  white: '#FFFFFF',
} as const;

export function createDoc(options: PDFKit.PDFDocumentOptions = {}): Doc {
  // bufferPages مطلوب لترقيم الصفحات بعد اكتمال المستند
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    autoFirstPage: true,
    bufferPages: true,
    ...options,
  });
  doc.registerFont('ar', FONT_REGULAR);
  doc.registerFont('ar-bold', FONT_BOLD);
  doc.font('ar');
  return doc;
}

export function docToBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export interface TextOpts {
  size?: number;
  bold?: boolean;
  color?: string;
  align?: 'right' | 'left' | 'center';
  width?: number;
}

/** يكتب نصًا عربيًا مُشكَّلًا ومُرتَّبًا بالاتجاه الصحيح. */
export function text(doc: Doc, value: string, x: number, y: number, opts: TextOpts = {}): void {
  doc
    .font(opts.bold ? 'ar-bold' : 'ar')
    .fontSize(opts.size ?? 10)
    .fillColor(opts.color ?? COLORS.text)
    .text(ar(value), x, y, {
      width: opts.width,
      align: opts.align ?? 'right',
      lineBreak: opts.width !== undefined,
    });
}

export function measure(doc: Doc, value: string, size: number, bold = false): number {
  return doc
    .font(bold ? 'ar-bold' : 'ar')
    .fontSize(size)
    .widthOfString(ar(value));
}

/** خط أفقي فاصل. */
export function rule(
  doc: Doc,
  x: number,
  y: number,
  width: number,
  color: string = COLORS.line,
): void {
  doc.save().strokeColor(color).lineWidth(0.7).moveTo(x, y).lineTo(x + width, y).stroke().restore();
}

export interface TableColumn {
  key: string;
  header: string;
  width: number;
  align?: 'right' | 'left' | 'center';
}

export interface TableOptions {
  x: number;
  y: number;
  columns: TableColumn[];
  rows: Record<string, string | number>[];
  headerFill?: string;
  zebra?: boolean;
  rowHeight?: number;
  fontSize?: number;
  onNewPage?: (doc: Doc) => number;
}

/**
 * جدول RTL: الأعمدة تُرتَّب من اليمين لليسار، ويتعامل مع كسر الصفحات تلقائيًا.
 * يُرجع إحداثي Y بعد نهاية الجدول.
 */
export function table(doc: Doc, opts: TableOptions): number {
  const { x, columns, rows: dataRows } = opts;
  const rowHeight = opts.rowHeight ?? 20;
  const fontSize = opts.fontSize ?? 9;
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  let y = opts.y;

  const drawHeader = () => {
    doc
      .save()
      .rect(x, y, totalWidth, rowHeight)
      .fill(opts.headerFill ?? COLORS.primary)
      .restore();
    let cx = x + totalWidth;
    for (const col of columns) {
      cx -= col.width;
      doc
        .font('ar-bold')
        .fontSize(fontSize)
        .fillColor(COLORS.white)
        .text(ar(col.header), cx + 4, y + (rowHeight - fontSize) / 2 - 1, {
          width: col.width - 8,
          align: col.align ?? 'right',
          lineBreak: false,
        });
    }
    y += rowHeight;
  };

  drawHeader();

  const bottom = doc.page.height - doc.page.margins.bottom;
  let index = 0;
  for (const row of dataRows) {
    if (y + rowHeight > bottom) {
      doc.addPage();
      y = opts.onNewPage ? opts.onNewPage(doc) : doc.page.margins.top;
      drawHeader();
    }
    if (opts.zebra !== false && index % 2 === 1) {
      doc.save().rect(x, y, totalWidth, rowHeight).fill(COLORS.bgSoft).restore();
    }
    let cx = x + totalWidth;
    for (const col of columns) {
      cx -= col.width;
      doc
        .font('ar')
        .fontSize(fontSize)
        .fillColor(COLORS.text)
        .text(ar(String(row[col.key] ?? '')), cx + 4, y + (rowHeight - fontSize) / 2 - 1, {
          width: col.width - 8,
          align: col.align ?? 'right',
          lineBreak: false,
        });
    }
    rule(doc, x, y + rowHeight, totalWidth, COLORS.line);
    y += rowHeight;
    index++;
  }

  return y;
}

/** بطاقة إحصائية (رقم كبير + عنوان). */
export function statCard(
  doc: Doc,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  color: string = COLORS.primary,
): void {
  doc.save().roundedRect(x, y, width, height, 6).fill(COLORS.bgSoft).restore();
  doc.save().roundedRect(x, y, width, height, 6).lineWidth(0.8).stroke(COLORS.line).restore();
  doc
    .font('ar-bold')
    .fontSize(16)
    .fillColor(color)
    .text(ar(value), x + 6, y + 8, { width: width - 12, align: 'center', lineBreak: false });
  doc
    .font('ar')
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(ar(label), x + 4, y + height - 18, {
      width: width - 8,
      align: 'center',
      lineBreak: false,
    });
}

/** ترويسة الشركة أعلى الصفحة. يُرجع Y بعد الترويسة. */
export function brandHeader(
  doc: Doc,
  brand: Brand,
  title: string,
  subtitle?: string,
): number {
  const { left, right, top } = doc.page.margins;
  const width = doc.page.width - left - right;
  const startY = top;

  doc.save().rect(left, startY, width, 56).fill(COLORS.primary).restore();

  if (brand.logoPath && existsSync(brand.logoPath)) {
    try {
      doc.image(brand.logoPath, doc.page.width - right - 52, startY + 8, {
        fit: [40, 40],
        align: 'center',
        valign: 'center',
      });
    } catch {
      /* شعار غير قابل للقراءة — نتجاهله بدل إسقاط التقرير */
    }
  }

  doc
    .font('ar-bold')
    .fontSize(14)
    .fillColor(COLORS.white)
    .text(ar(brand.companyName), left + 8, startY + 10, {
      width: width - 70,
      align: 'right',
      lineBreak: false,
    });
  doc
    .font('ar')
    .fontSize(10)
    .fillColor('#CFE8E2')
    .text(ar(title), left + 8, startY + 30, {
      width: width - 70,
      align: 'right',
      lineBreak: false,
    });

  doc
    .font('ar-bold')
    .fontSize(11)
    .fillColor(COLORS.white)
    .text('VERO', left + 8, startY + 20, { width: 80, align: 'left', lineBreak: false });

  let y = startY + 66;
  if (subtitle) {
    text(doc, subtitle, left, y, { size: 9, color: COLORS.muted, width, align: 'right' });
    y += 16;
  }
  return y;
}

/** تذييل بالترقيم وعبارة المنتج. */
export function pageFooter(doc: Doc, note: string): void {
  const { left, right, bottom } = doc.page.margins;
  const width = doc.page.width - left - right;
  const y = doc.page.height - bottom + 8;
  rule(doc, left, y - 6, width);
  doc
    .font('ar')
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(ar(note), left, y, { width, align: 'right', lineBreak: false });
  doc
    .font('ar')
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text('VERO — Every Visit Has a Proof.', left, y, {
      width,
      align: 'left',
      lineBreak: false,
    });
}
