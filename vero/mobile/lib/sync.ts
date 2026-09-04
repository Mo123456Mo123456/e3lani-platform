import * as Network from 'expo-network';
import { api, ApiError, type ScanResult, type SyncResult } from './api';
import {
  addHistory,
  markScanFailed,
  pendingPointCount,
  pendingPoints,
  pendingScanCount,
  pendingScans,
  removePoints,
  removeScan,
} from './db';

/**
 * محرّك المزامنة.
 *
 * القاعدة: الخادم هو الحكم. الجهاز لا يحذف عملية محليًا إلا بعد أن يؤكّد الخادم
 * أنه استقبلها (accepted) أو أنها مسجّلة أصلًا (duplicate) أو أنها مرفوضة نهائيًا
 * (rejected لسبب لا يتغيّر بإعادة المحاولة، مثل رمز QR غير صالح).
 * أخطاء الشبكة لا تحذف شيئًا — تُعاد المحاولة لاحقًا.
 */

export interface SyncSummary {
  ran: boolean;
  scansSent: number;
  accepted: number;
  duplicates: number;
  rejected: number;
  pointsSent: number;
  pendingScans: number;
  pendingPoints: number;
  error?: string;
}

let running = false;

export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    // تعذّر معرفة الحالة: نحاول الإرسال ونترك الشبكة تحكم
    return true;
  }
}

/** أسباب لا فائدة من إعادة المحاولة معها — تُحذف من الطابور بعد تسجيلها في السجل. */
const PERMANENT = new Set([
  'TOKEN_MALFORMED',
  'TOKEN_BAD_SIGNATURE',
  'BIN_NOT_FOUND',
  'BIN_DISABLED',
  'TOKEN_REVOKED',
  'INVALID_LOCATION',
]);

export async function syncNow(sessionId?: string | null): Promise<SyncSummary> {
  if (running) {
    return {
      ran: false,
      scansSent: 0,
      accepted: 0,
      duplicates: 0,
      rejected: 0,
      pointsSent: 0,
      pendingScans: await pendingScanCount(),
      pendingPoints: await pendingPointCount(),
    };
  }
  running = true;

  const summary: SyncSummary = {
    ran: true,
    scansSent: 0,
    accepted: 0,
    duplicates: 0,
    rejected: 0,
    pointsSent: 0,
    pendingScans: 0,
    pendingPoints: 0,
  };

  try {
    if (!(await isOnline())) {
      summary.ran = false;
      return summary;
    }

    // ── عمليات المسح ──
    const scans = await pendingScans(100);
    if (scans.length > 0) {
      const items = scans.map((s) => ({
        clientUuid: s.client_uuid,
        token: s.token,
        lat: s.lat,
        lon: s.lon,
        accuracyM: s.accuracy_m,
        scannedAt: s.scanned_at,
        offline: true,
        sessionId: s.session_id,
      }));

      try {
        const res = await api<SyncResult>('/v1/sync/scans', {
          method: 'POST',
          body: { items },
          timeoutMs: 45_000,
        });
        summary.scansSent = items.length;
        summary.accepted = res.summary.accepted;
        summary.duplicates = res.summary.duplicates;
        summary.rejected = res.summary.rejected;

        const byUuid = new Map(scans.map((s) => [s.client_uuid, s]));
        for (const r of res.results) {
          const local = byUuid.get(r.clientUuid);
          await recordHistory(r, local?.bin_label ?? null);

          const permanentReject =
            r.outcome === 'rejected' && r.reasons.some((x) => PERMANENT.has(x));
          if (r.outcome === 'accepted' || r.outcome === 'duplicate' || permanentReject) {
            await removeScan(r.clientUuid);
          } else {
            await markScanFailed(r.clientUuid, r.message);
          }
        }
      } catch (err) {
        const e = err as ApiError;
        summary.error = e.message;
        if (!e.isNetwork) {
          // خطأ من الخادم (مصادقة/تحقق): نسجّله على العناصر ولا نحذفها
          for (const s of scans) await markScanFailed(s.client_uuid, e.message);
        }
      }
    }

    // ── نقاط المسار ──
    if (sessionId) {
      const points = await pendingPoints(sessionId, 400);
      if (points.length > 0) {
        try {
          await api('/v1/sync/route-points', {
            method: 'POST',
            body: {
              sessionId,
              points: points.map((p) => ({
                clientUuid: p.client_uuid,
                lat: p.lat,
                lon: p.lon,
                recordedAt: p.recorded_at,
                speedMps: p.speed_mps,
                accuracyM: p.accuracy_m,
              })),
            },
            timeoutMs: 45_000,
          });
          await removePoints(points.map((p) => p.client_uuid));
          summary.pointsSent = points.length;
        } catch (err) {
          const e = err as ApiError;
          // جلسة غير موجودة على الخادم: النقاط لا قيمة لها، نحذفها لتفادي طابور عالق
          if (e.status === 404) {
            await removePoints(points.map((p) => p.client_uuid));
          } else if (!summary.error) {
            summary.error = e.message;
          }
        }
      }
    }

    return summary;
  } finally {
    summary.pendingScans = await pendingScanCount();
    summary.pendingPoints = await pendingPointCount();
    running = false;
  }
}

async function recordHistory(r: ScanResult, fallbackLabel: string | null): Promise<void> {
  await addHistory({
    client_uuid: r.clientUuid,
    bin_label: r.bin?.publicId ?? fallbackLabel,
    status: r.status,
    counted: r.counted ? 1 : 0,
    distance_m: r.distanceM,
    message: r.message,
    service_day: r.serviceDay,
    synced_at: new Date().toISOString(),
  });
}

/** يسجّل نتيجة مسح مباشر (متصل) في السجل المحلي. */
export async function recordDirectScan(r: ScanResult): Promise<void> {
  await recordHistory(r, null);
}

/** مزامنة دورية خفيفة تعمل ما دام التطبيق مفتوحًا. */
export function startAutoSync(
  getSessionId: () => string | null,
  onResult: (s: SyncSummary) => void,
  intervalMs = 45_000,
): () => void {
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const pending = (await pendingScanCount()) + (await pendingPointCount());
      if (pending > 0) {
        const s = await syncNow(getSessionId());
        if (!stopped && s.ran) onResult(s);
      }
    } catch {
      /* المزامنة الدورية لا يجوز أن تُسقط الواجهة */
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
