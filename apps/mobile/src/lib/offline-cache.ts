import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AdDto, TickerLogoDto } from '@e3lani/types';

/** أقصى عدد إعلانات تُحفظ محليًا لكل تبويب. */
const MAX_CACHED_ADS = 20;
/** بعد هذه المدة تُعتبر النسخة المحلية قديمة ولا تُعرض. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const feedKey = (tab: string) => `e3lani.cache.feed.${tab}`;
const TICKER_KEY = 'e3lani.cache.ticker';

interface CacheEnvelope<T> {
  savedAt: number;
  data: T;
}

async function write<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = { savedAt: Date.now(), data };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // التخزين المحلي ليس حرجًا — تجاهل الفشل بصمت
  }
}

async function read<T>(key: string): Promise<{ data: T; savedAt: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope?.savedAt || Date.now() - envelope.savedAt > MAX_AGE_MS) return null;
    return { data: envelope.data, savedAt: envelope.savedAt };
  } catch {
    return null;
  }
}

/**
 * نسخة محلية من الموجز.
 *
 * الهدف: عند ضعف الشبكة أو انقطاعها يرى المستخدم إعلانات حقيقية رآها سابقًا
 * بدل شاشة فارغة — مع إشعار صريح بأنه يتصفح نسخة محفوظة.
 */
export const offlineCache = {
  async saveFeed(tab: string, items: AdDto[]): Promise<void> {
    if (!items.length) return;
    await write(feedKey(tab), items.slice(0, MAX_CACHED_ADS));
  },

  async readFeed(tab: string): Promise<{ items: AdDto[]; savedAt: number } | null> {
    const cached = await read<AdDto[]>(feedKey(tab));
    if (!cached?.data?.length) return null;
    return { items: cached.data, savedAt: cached.savedAt };
  },

  async saveTicker(logos: TickerLogoDto[]): Promise<void> {
    await write(TICKER_KEY, logos);
  },

  async readTicker(): Promise<TickerLogoDto[]> {
    const cached = await read<TickerLogoDto[]>(TICKER_KEY);
    return cached?.data ?? [];
  },

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const ours = keys.filter((key) => key.startsWith('e3lani.cache.'));
      if (ours.length) await AsyncStorage.multiRemove(ours);
    } catch {
      // تجاهل
    }
  },
};

/** صياغة عربية مختصرة لعمر النسخة المحفوظة. */
export function cacheAgeLabel(savedAt: number): string {
  const minutes = Math.max(1, Math.round((Date.now() - savedAt) / 60_000));
  if (minutes < 60) return `محفوظة قبل ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  return `محفوظة قبل ${hours} ساعة`;
}
