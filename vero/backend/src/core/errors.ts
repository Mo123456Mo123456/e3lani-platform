export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SETUP_ALREADY_COMPLETED'
  | 'SETUP_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'DEVICE_REVOKED'
  | 'DEVICE_NOT_BOUND'
  | 'ACTIVATION_CODE_INVALID'
  | 'ACTIVATION_CODE_USED'
  | 'ACTIVATION_CODE_EXPIRED'
  | 'BIN_DISABLED'
  | 'OUT_OF_RANGE'
  | 'DUPLICATE_SCAN'
  | 'RATE_LIMITED'
  | 'DB_UNAVAILABLE'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SETUP_ALREADY_COMPLETED: 409,
  SETUP_REQUIRED: 428,
  INVALID_CREDENTIALS: 401,
  INVALID_TOKEN: 401,
  DEVICE_REVOKED: 403,
  DEVICE_NOT_BOUND: 403,
  ACTIVATION_CODE_INVALID: 400,
  ACTIVATION_CODE_USED: 409,
  ACTIVATION_CODE_EXPIRED: 410,
  BIN_DISABLED: 409,
  OUT_OF_RANGE: 422,
  DUPLICATE_SCAN: 200,
  RATE_LIMITED: 429,
  DB_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code] ?? 500;
    this.details = details;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, details: this.details ?? {} } };
  }
}

export const badRequest = (m: string, d?: Record<string, unknown>) =>
  new AppError('BAD_REQUEST', m, d);
export const notFound = (m: string, d?: Record<string, unknown>) => new AppError('NOT_FOUND', m, d);
export const conflict = (m: string, d?: Record<string, unknown>) => new AppError('CONFLICT', m, d);
export const forbidden = (m: string, d?: Record<string, unknown>) => new AppError('FORBIDDEN', m, d);
export const unauthorized = (m: string, d?: Record<string, unknown>) =>
  new AppError('UNAUTHORIZED', m, d);
