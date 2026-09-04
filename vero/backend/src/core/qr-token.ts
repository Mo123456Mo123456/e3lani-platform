import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * رمز QR للحاوية:
 *
 *   vero1.<publicId>.<nonce>.<hmac>
 *
 * - `publicId`  رقم الحاوية المطبوع (VR-000248) — لتشخيص الملصق بالعين.
 * - `nonce`     قيمة عشوائية 16 بايت (base64url) — لا يمكن استنتاج الرمز من رقم الحاوية.
 * - `hmac`      HMAC-SHA256 على `v1|publicId|nonce` بمفتاح QR_SIGNING_KEY، مقتطع إلى 128 بت.
 *
 * أثر ذلك: لا يستطيع أحد تصنيع ملصق صالح لحاوية جديدة أو تخمين رمز حاوية أخرى
 * دون معرفة مفتاح التوقيع الخاص بنسخة الشركة.
 */

export const QR_PREFIX = 'vero1';

export function newNonce(): string {
  return randomBytes(16).toString('base64url');
}

function signature(publicId: string, nonce: string): string {
  return createHmac('sha256', env.qrSigningKey)
    .update(`${QR_PREFIX}|${publicId.toUpperCase()}|${nonce}`)
    .digest('base64url')
    .slice(0, 22); // 22 حرف base64url ≈ 132 بت
}

export function buildQrToken(publicId: string, nonce: string): string {
  return `${QR_PREFIX}.${publicId.toUpperCase()}.${nonce}.${signature(publicId, nonce)}`;
}

export interface ParsedQrToken {
  publicId: string;
  nonce: string;
}

export type QrParseFailure =
  | 'MALFORMED'
  | 'UNKNOWN_PREFIX'
  | 'BAD_SIGNATURE';

export type QrParseResult =
  | { ok: true; value: ParsedQrToken }
  | { ok: false; reason: QrParseFailure };

export function parseQrToken(raw: string): QrParseResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'MALFORMED' };
  const trimmed = raw.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'MALFORMED' };
  const [prefix, publicId, nonce, sig] = parts as [string, string, string, string];
  if (prefix !== QR_PREFIX) return { ok: false, reason: 'UNKNOWN_PREFIX' };
  if (!publicId || !nonce || !sig) return { ok: false, reason: 'MALFORMED' };

  const expected = signature(publicId, nonce);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'BAD_SIGNATURE' };
  }
  return { ok: true, value: { publicId: publicId.toUpperCase(), nonce } };
}
