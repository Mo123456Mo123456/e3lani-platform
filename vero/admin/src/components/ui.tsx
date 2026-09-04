'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';

/** رسالة خطأ صريحة. لا نستبدل الفشل ببيانات وهمية أبدًا. */
export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const api = error instanceof ApiError ? error : null;
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className="alert error">
      <span>⚠</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{message}</div>
        {api?.code === 'NETWORK' && (
          <div className="hint" style={{ marginTop: 4, color: 'inherit', opacity: 0.85 }}>
            تأكد من تشغيل خدمة VERO API وأن العنوان في <code>NEXT_PUBLIC_API_URL</code> صحيح.
          </div>
        )}
        {api?.code === 'FORBIDDEN' && (
          <div className="hint" style={{ marginTop: 4, color: 'inherit', opacity: 0.85 }}>
            صلاحيتك الحالية لا تسمح بهذا الإجراء.
          </div>
        )}
        {api?.details?.issues != null && (
          <ul style={{ margin: '6px 0 0', paddingInlineStart: 18, fontSize: 12 }}>
            {(api.details.issues as { path: string; message: string }[]).map((i, n) => (
              <li key={n}>
                {i.path}: {i.message}
              </li>
            ))}
          </ul>
        )}
        {onRetry && (
          <button className="btn sm" style={{ marginTop: 9 }} onClick={onRetry}>
            إعادة المحاولة
          </button>
        )}
      </div>
    </div>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 38 }} />
      ))}
    </div>
  );
}

export function Empty({ icon = '📭', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="icon">{icon}</div>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = '',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: '' | 'ok' | 'warn' | 'bad' | 'primary';
}) {
  return (
    <div className={`stat ${tone}`}>
      <div className="label">{label}</div>
      <div className="value num">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <div style={{ flex: 1 }} />
          <button className="btn ghost sm" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className={required ? 'req' : ''}>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; text: string }> = {
    VERIFIED: { cls: 'ok', text: 'موثّقة' },
    SUSPICIOUS: { cls: 'warn', text: 'تحتاج مراجعة' },
    INVALID: { cls: 'bad', text: 'غير صالحة' },
    ACTIVE: { cls: 'ok', text: 'فعّالة' },
    DISABLED: { cls: 'muted', text: 'معطّلة' },
    INACTIVE: { cls: 'muted', text: 'موقوفة' },
    MAINTENANCE: { cls: 'warn', text: 'صيانة' },
    REVOKED: { cls: 'bad', text: 'ملغى' },
    PENDING: { cls: 'warn', text: 'بانتظار المراجعة' },
    ACCEPTED: { cls: 'ok', text: 'مقبولة' },
    REJECTED: { cls: 'bad', text: 'مرفوضة' },
    NONE: { cls: 'muted', text: '—' },
    READY: { cls: 'ok', text: 'جاهزة' },
    FAILED: { cls: 'bad', text: 'فشلت' },
  };
  const s = map[status] ?? { cls: 'muted', text: status };
  return <span className={`pill ${s.cls}`}>{s.text}</span>;
}

export const ROLE_AR: Record<string, string> = {
  ADMIN: 'مدير',
  SUPERVISOR: 'مشرف',
  VIEWER: 'مراقب',
};

export const REASON_AR: Record<string, string> = {
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

export const ATTENTION_AR: Record<string, string> = {
  BIN_NOT_SERVICED: 'لم تتم خدمتها',
  SCAN_OUT_OF_RANGE: 'مسح خارج النطاق',
  SUSPICIOUS_SCAN: 'زيارة مشبوهة',
  VEHICLE_OFFLINE: 'سيارة غير متصلة',
  INVALID_TOKEN_ATTEMPT: 'رمز غير صالح',
  BIN_MISSING_QR: 'بلا رمز QR',
  BIN_DISABLED: 'حاوية معطّلة',
};

/** تنسيق تاريخ ووقت بتقويم ميلادي وأرقام لاتينية (أوضح في الجداول). */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return 'لم يتصل بعد';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'الآن';
  if (min < 60) return `قبل ${min} دقيقة`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  return `قبل ${Math.floor(hours / 24)} يوم`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} كيلوبايت`;
  return `${(n / 1024 / 1024).toFixed(2)} ميجابايت`;
}

/** hook بسيط لجلب البيانات مع حالات التحميل والخطأ وإعادة المحاولة. */
export function useData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; error: unknown; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) {
          setError(e);
          setData(null); // لا نُبقي بيانات قديمة تُوهم بالنجاح
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}
