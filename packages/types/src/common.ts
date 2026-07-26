export type Locale = 'ar' | 'en';

export type PlatformChannel = 'ios' | 'android' | 'web';

export type MediaKind = 'image' | 'video';

export type Uuid = string;

export interface LocalizedText {
  ar: string;
  en: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface OffsetPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
