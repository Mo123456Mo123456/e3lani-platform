import type {
  AccountType, AdStatus, ContactMethod, ImpressionSource, MediaStatus, MediaType,
  PaymentStatus, ReachScope, TickerStatus, UserStatus,
} from './enums';

export interface CityDto {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  regionId: string;
  regionNameAr?: string;
  regionNameEn?: string;
  lat: number;
  lng: number;
  isPopular: boolean;
}

export interface CategoryDto {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  adsCount?: number;
  children?: CategoryDto[];
}

export interface MediaDto {
  id: string;
  type: MediaType;
  status: MediaStatus;
  url: string | null;
  thumbnailUrl: string | null;
  posterUrl?: string | null;
  width: number | null;
  height: number | null;
  /** نسبة العرض إلى الارتفاع لعرض الوسائط دون تشويه */
  aspectRatio: number | null;
  durationMs: number | null;
  blurhash: string | null;
  variants?: { name: string; url: string; width?: number; height?: number }[];
}

export interface PublicAccountDto {
  id: string;
  name: string;
  accountType: AccountType;
  avatarUrl: string | null;
  cityId: string | null;
  cityNameAr?: string | null;
  cityNameEn?: string | null;
  isVerified: boolean;
  business?: {
    displayName: string | null;
    bio: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    storeUrl: string | null;
    websiteUrl: string | null;
    whatsapp: string | null;
    contactPhone: string | null;
    socials: Record<string, string> | null;
  } | null;
  stats?: { activeAds: number; posts: number; totalViews: number };
}

export interface AdDto {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  status: AdStatus;
  reachScope: ReachScope;
  contactMethod: ContactMethod;
  /** لا تُرسل قيمة التواصل إلا للإعلانات النشطة أو لصاحب الإعلان */
  contactValue: string | null;
  city: Pick<CityDto, 'id' | 'nameAr' | 'nameEn'> | null;
  category: Pick<CategoryDto, 'id' | 'slug' | 'nameAr' | 'nameEn'> | null;
  subcategory: Pick<CategoryDto, 'id' | 'slug' | 'nameAr' | 'nameEn'> | null;
  media: MediaDto[];
  owner: PublicAccountDto;
  isHighlighted: boolean;
  isTopOfCategory: boolean;
  isPromoted: boolean;
  impressionSource: ImpressionSource;
  viewsCount: number;
  savesCount: number;
  sharesCount: number;
  isSaved: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  shareUrl: string;
}

export interface PostDto {
  id: string;
  caption: string;
  media: MediaDto[];
  owner: PublicAccountDto;
  isSaved: boolean;
  createdAt: string;
  shareUrl: string;
}

export interface TickerLogoDto {
  id: string;
  businessName: string;
  logoUrl: string;
  /** الشريط غير قابل للنقر إطلاقًا — لا يوجد أي رابط في هذا الكائن عمدًا. */
  sortWeight: number;
}

export interface PaginatedDto<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionUserDto {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  accountType: AccountType;
  status: UserStatus;
  avatarUrl: string | null;
  cityId: string | null;
  isVerified: boolean;
  profileComplete: boolean;
  locale: 'ar' | 'en';
}

export interface AdAnalyticsDto {
  adId: string;
  range: { from: string; to: string };
  impressions: number;
  uniqueReach: number;
  videoViews: number;
  averageWatchMs: number;
  completionRate: number;
  clicks: { whatsapp: number; call: number; store: number; link: number; total: number };
  saves: number;
  shares: number;
  bySource: Record<ImpressionSource, number>;
  topCities: { cityId: string; nameAr: string; nameEn: string; impressions: number }[];
  bestDay: { date: string; impressions: number } | null;
  bestHour: { hour: number; impressions: number } | null;
  daily: { date: string; impressions: number; clicks: number; videoViews: number }[];
}

export interface PricingItemDto {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  amountHalalas: number;
  amountSar: number;
  durationDays: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface PaymentDto {
  id: string;
  amountHalalas: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerRef: string | null;
  checkoutUrl: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface TickerRequestDto {
  id: string;
  businessName: string;
  status: TickerStatus;
  logoUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}
