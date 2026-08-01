'use client';

import { API_URL } from './api';

const DEVICE_KEY = 'e3lani.device';

export function deviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

let buffer: any[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** يجمع أحداث الظهور والتفاعل ويرسلها دفعة واحدة لتقليل الطلبات. */
export function track(adId: string, type: string, extra: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  buffer.push({ adId, type, occurredAt: new Date().toISOString(), source: 'ORGANIC', ...extra });
  if (buffer.length >= 20) {
    void flush();
    return;
  }
  if (!timer) timer = setTimeout(() => void flush(), 4000);
}

export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!buffer.length) return;
  const events = buffer.slice(0, 50);
  buffer = buffer.slice(50);

  const body = JSON.stringify({ deviceId: deviceId(), events });
  const url = `${API_URL}/events`;

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    return;
  }
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(
    () => undefined,
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flush());
}
