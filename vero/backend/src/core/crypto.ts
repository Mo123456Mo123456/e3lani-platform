import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const SCRYPT_KEYLEN = 64;

// ───────────────────────── كلمات المرور ─────────────────────────

export async function hashPassword(
  password: string,
): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString('hex');
  const buf = await scrypt(password, salt, SCRYPT_KEYLEN);
  return { hash: buf.toString('hex'), salt };
}

export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  let expected: Buffer;
  try {
    expected = Buffer.from(hash, 'hex');
  } catch {
    return false;
  }
  const actual = await scrypt(password, salt, SCRYPT_KEYLEN);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// ───────────────────────── التجزئة والعشوائية ─────────────────────────

export const sha256Hex = (input: string | Buffer): string =>
  createHash('sha256').update(input).digest('hex');

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export const newUuid = (): string => randomUUID();

/** كود تفعيل من 8 خانات بأحرف/أرقام غير ملتبسة (بلا O/0/I/1) */
export function activationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[buf[i]! % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

function b64urlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function safeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ───────────────────────── JWT (HS256) ─────────────────────────

export interface JwtPayload {
  sub: string;
  cid: string;
  role: string;
  typ: 'access';
  iat: number;
  exp: number;
}

export function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  ttlSec: number = env.accessTokenTtlSec,
): string {
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = { ...payload, iat: now, exp: now + ttlSec };
  const header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims = b64urlEncode(JSON.stringify(body));
  const data = `${header}.${claims}`;
  const sig = createHmac('sha256', env.jwtSecret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyJwt(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AppError('INVALID_TOKEN', 'رمز الجلسة غير صالح');
  const [header, claims, sig] = parts as [string, string, string];
  const expected = createHmac('sha256', env.jwtSecret)
    .update(`${header}.${claims}`)
    .digest('base64url');
  if (!safeEqualStr(sig, expected)) {
    throw new AppError('INVALID_TOKEN', 'توقيع رمز الجلسة غير صالح');
  }
  let payload: JwtPayload;
  try {
    payload = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8')) as JwtPayload;
  } catch {
    throw new AppError('INVALID_TOKEN', 'محتوى رمز الجلسة غير صالح');
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    throw new AppError('INVALID_TOKEN', 'انتهت صلاحية الجلسة');
  }
  return payload;
}
