import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './api';

const DEVICE_KEY = 'e3lani.device';
let cachedDeviceId: string | null = null;
let buffer: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function deviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  let stored = await AsyncStorage.getItem(DEVICE_KEY);
  if (!stored) {
    stored = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(DEVICE_KEY, stored);
  }
  cachedDeviceId = stored;
  return stored;
}

/** يجمع أحداث الظهور والمشاهدة والنقر ويرسلها دفعة واحدة. */
export function track(
  adId: string,
  type: string,
  extra: Record<string, unknown> = {},
): void {
  buffer.push({ adId, type, occurredAt: new Date().toISOString(), source: 'ORGANIC', ...extra });
  if (buffer.length >= 20) {
    void flushEvents();
    return;
  }
  if (!timer) timer = setTimeout(() => void flushEvents(), 5000);
}

export async function flushEvents(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!buffer.length) return;
  const events = buffer.splice(0, 50);
  try {
    await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: await deviceId(), events }),
    });
  } catch {
    // الأحداث غير حرجة — نتجاهل الفشل بصمت
  }
}
