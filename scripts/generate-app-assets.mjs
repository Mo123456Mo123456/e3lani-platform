/**
 * يولّد أصول التطبيق من شعار «إعلاني» المتجهي.
 *
 *   node scripts/generate-app-assets.mjs
 *
 * المخرجات في apps/mobile/assets و apps/web/public — كلها مشتقّة من مصدر واحد،
 * فأي تعديل على الشعار ينعكس على كل المقاسات بأمر واحد.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRIMARY = '#FFC400';
const INK = '#111111';

/** علامة الشعار وحدها (بلا خلفية) — تُرسم داخل مربع 48×48. */
const MARK = `
  <path d="M14 19.5c0-1.4 1.1-2.5 2.5-2.5h9.8c.9 0 1.7.5 2.2 1.2l4.4 7c.5.8.5 1.8 0 2.6l-4.4 7c-.5.7-1.3 1.2-2.2 1.2h-9.8c-1.4 0-2.5-1.1-2.5-2.5v-14z"
        fill="${INK}" opacity="0.92"/>
  <circle cx="20.5" cy="26.5" r="2.6" fill="${PRIMARY}"/>
`;

/**
 * @param {object} options
 * @param {number} options.size      مقاس الصورة النهائية
 * @param {number} options.rx        استدارة الزوايا (٠ للأيقونات التي يقصّها النظام)
 * @param {boolean} options.transparent  خلفية شفافة (للأيقونة التكيّفية)
 * @param {number} options.inset     نسبة المساحة الآمنة حول العلامة
 */
function buildSvg({ size, rx = 0, transparent = false, inset = 0 }) {
  const box = 48;
  const scale = 1 - inset * 2;
  const offset = (box * inset).toFixed(3);

  const background = transparent
    ? ''
    : `<rect width="${box}" height="${box}" rx="${rx}" fill="${PRIMARY}"/>`;

  // عند الشفافية نجعل الدائرة الداخلية بلون العلامة كي تبقى مرئية على أي خلفية
  const mark = transparent ? MARK.replace(`fill="${PRIMARY}"`, `fill="${PRIMARY}"`) : MARK;

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${box} ${box}">
      ${background}
      <g transform="translate(${offset} ${offset}) scale(${scale})">${mark}</g>
    </svg>`,
  );
}

const TARGETS = [
  {
    file: 'apps/mobile/assets/icon.png',
    label: 'أيقونة iOS (يقصّ النظام الزوايا)',
    svg: { size: 1024, rx: 0, inset: 0.12 },
  },
  {
    file: 'apps/mobile/assets/adaptive-icon.png',
    label: 'أيقونة أندرويد التكيّفية (المقدّمة فقط)',
    // أندرويد يقصّ حتى ٣٣٪ من الحواف، لذا نُبقي العلامة داخل منطقة آمنة واسعة
    svg: { size: 1024, transparent: true, inset: 0.26 },
  },
  {
    file: 'apps/mobile/assets/splash-icon.png',
    label: 'أيقونة شاشة البداية (على الخلفية الصفراء)',
    svg: { size: 512, transparent: true, inset: 0.08 },
  },
  {
    file: 'apps/mobile/assets/notification-icon.png',
    label: 'أيقونة الإشعارات',
    svg: { size: 96, transparent: true, inset: 0.12 },
  },
  {
    file: 'apps/mobile/assets/favicon.png',
    label: 'أيقونة الويب داخل التطبيق',
    svg: { size: 64, rx: 18, inset: 0.1 },
  },
  {
    file: 'apps/web/public/icon-192.png',
    label: 'أيقونة الموقع 192',
    svg: { size: 192, rx: 44, inset: 0.1 },
  },
  {
    file: 'apps/web/public/icon-512.png',
    label: 'أيقونة الموقع 512',
    svg: { size: 512, rx: 118, inset: 0.1 },
  },
  {
    file: 'apps/web/public/apple-touch-icon.png',
    label: 'أيقونة أجهزة آبل للموقع',
    svg: { size: 180, rx: 0, inset: 0.12 },
  },
];

async function main() {
  console.log('▶ توليد أصول «إعلاني» من الشعار المتجهي…\n');

  for (const target of TARGETS) {
    const path = resolve(root, target.file);
    await mkdir(dirname(path), { recursive: true });
    const png = await sharp(buildSvg(target.svg)).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(path, png);
    console.log(`  ✓ ${target.file}  (${target.svg.size}px) — ${target.label}`);
  }

  console.log('\n✅ اكتمل التوليد. أعد تشغيل Expo لتظهر الأيقونات الجديدة.');
}

main().catch((error) => {
  console.error('❌ فشل التوليد:', error);
  process.exit(1);
});
