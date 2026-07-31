/** مناطق ومدن المملكة العربية السعودية — تُستخدم لبذر قاعدة البيانات. */
export interface SeedRegion {
  slug: string;
  nameAr: string;
  nameEn: string;
}

export interface SeedCity {
  slug: string;
  nameAr: string;
  nameEn: string;
  regionSlug: string;
  lat: number;
  lng: number;
  isPopular?: boolean;
}

export const REGIONS: SeedRegion[] = [
  { slug: 'riyadh', nameAr: 'منطقة الرياض', nameEn: 'Riyadh Region' },
  { slug: 'makkah', nameAr: 'منطقة مكة المكرمة', nameEn: 'Makkah Region' },
  { slug: 'madinah', nameAr: 'منطقة المدينة المنورة', nameEn: 'Madinah Region' },
  { slug: 'eastern', nameAr: 'المنطقة الشرقية', nameEn: 'Eastern Province' },
  { slug: 'qassim', nameAr: 'منطقة القصيم', nameEn: 'Qassim Region' },
  { slug: 'asir', nameAr: 'منطقة عسير', nameEn: 'Asir Region' },
  { slug: 'tabuk', nameAr: 'منطقة تبوك', nameEn: 'Tabuk Region' },
  { slug: 'hail', nameAr: 'منطقة حائل', nameEn: 'Hail Region' },
  { slug: 'northern-borders', nameAr: 'منطقة الحدود الشمالية', nameEn: 'Northern Borders' },
  { slug: 'jazan', nameAr: 'منطقة جازان', nameEn: 'Jazan Region' },
  { slug: 'najran', nameAr: 'منطقة نجران', nameEn: 'Najran Region' },
  { slug: 'baha', nameAr: 'منطقة الباحة', nameEn: 'Al Baha Region' },
  { slug: 'jouf', nameAr: 'منطقة الجوف', nameEn: 'Al Jouf Region' },
];

export const CITIES: SeedCity[] = [
  { slug: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionSlug: 'riyadh', lat: 24.7136, lng: 46.6753, isPopular: true },
  { slug: 'diriyah', nameAr: 'الدرعية', nameEn: 'Diriyah', regionSlug: 'riyadh', lat: 24.7333, lng: 46.5725 },
  { slug: 'kharj', nameAr: 'الخرج', nameEn: 'Al Kharj', regionSlug: 'riyadh', lat: 24.1483, lng: 47.3053 },
  { slug: 'majmaah', nameAr: 'المجمعة', nameEn: 'Al Majmaah', regionSlug: 'riyadh', lat: 25.9039, lng: 45.3453 },
  { slug: 'dawadmi', nameAr: 'الدوادمي', nameEn: 'Dawadmi', regionSlug: 'riyadh', lat: 24.5075, lng: 44.3922 },
  { slug: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah', regionSlug: 'makkah', lat: 21.4858, lng: 39.1925, isPopular: true },
  { slug: 'makkah', nameAr: 'مكة المكرمة', nameEn: 'Makkah', regionSlug: 'makkah', lat: 21.3891, lng: 39.8579, isPopular: true },
  { slug: 'taif', nameAr: 'الطائف', nameEn: 'Taif', regionSlug: 'makkah', lat: 21.2703, lng: 40.4158, isPopular: true },
  { slug: 'rabigh', nameAr: 'رابغ', nameEn: 'Rabigh', regionSlug: 'makkah', lat: 22.7986, lng: 39.0349 },
  { slug: 'qunfudhah', nameAr: 'القنفذة', nameEn: 'Al Qunfudhah', regionSlug: 'makkah', lat: 19.1264, lng: 41.0789 },
  { slug: 'madinah', nameAr: 'المدينة المنورة', nameEn: 'Madinah', regionSlug: 'madinah', lat: 24.5247, lng: 39.5692, isPopular: true },
  { slug: 'yanbu', nameAr: 'ينبع', nameEn: 'Yanbu', regionSlug: 'madinah', lat: 24.0895, lng: 38.0618 },
  { slug: 'alula', nameAr: 'العلا', nameEn: 'AlUla', regionSlug: 'madinah', lat: 26.6167, lng: 37.9167 },
  { slug: 'dammam', nameAr: 'الدمام', nameEn: 'Dammam', regionSlug: 'eastern', lat: 26.4207, lng: 50.0888, isPopular: true },
  { slug: 'khobar', nameAr: 'الخبر', nameEn: 'Khobar', regionSlug: 'eastern', lat: 26.2794, lng: 50.208, isPopular: true },
  { slug: 'dhahran', nameAr: 'الظهران', nameEn: 'Dhahran', regionSlug: 'eastern', lat: 26.2361, lng: 50.0393 },
  { slug: 'jubail', nameAr: 'الجبيل', nameEn: 'Jubail', regionSlug: 'eastern', lat: 27.0046, lng: 49.6583 },
  { slug: 'ahsa', nameAr: 'الأحساء', nameEn: 'Al Ahsa', regionSlug: 'eastern', lat: 25.3833, lng: 49.5867, isPopular: true },
  { slug: 'qatif', nameAr: 'القطيف', nameEn: 'Qatif', regionSlug: 'eastern', lat: 26.5196, lng: 50.0115 },
  { slug: 'hafr-albatin', nameAr: 'حفر الباطن', nameEn: 'Hafar Al Batin', regionSlug: 'eastern', lat: 28.4342, lng: 45.9636 },
  { slug: 'buraidah', nameAr: 'بريدة', nameEn: 'Buraidah', regionSlug: 'qassim', lat: 26.3597, lng: 43.9818, isPopular: true },
  { slug: 'unaizah', nameAr: 'عنيزة', nameEn: 'Unaizah', regionSlug: 'qassim', lat: 26.0843, lng: 43.9935 },
  { slug: 'rass', nameAr: 'الرس', nameEn: 'Ar Rass', regionSlug: 'qassim', lat: 25.8667, lng: 43.5 },
  { slug: 'abha', nameAr: 'أبها', nameEn: 'Abha', regionSlug: 'asir', lat: 18.2164, lng: 42.5053, isPopular: true },
  { slug: 'khamis-mushait', nameAr: 'خميس مشيط', nameEn: 'Khamis Mushait', regionSlug: 'asir', lat: 18.3, lng: 42.7333 },
  { slug: 'bisha', nameAr: 'بيشة', nameEn: 'Bisha', regionSlug: 'asir', lat: 19.9833, lng: 42.6 },
  { slug: 'tabuk', nameAr: 'تبوك', nameEn: 'Tabuk', regionSlug: 'tabuk', lat: 28.3838, lng: 36.5662, isPopular: true },
  { slug: 'duba', nameAr: 'ضباء', nameEn: 'Duba', regionSlug: 'tabuk', lat: 27.3493, lng: 35.6961 },
  { slug: 'hail', nameAr: 'حائل', nameEn: 'Hail', regionSlug: 'hail', lat: 27.5114, lng: 41.7208, isPopular: true },
  { slug: 'arar', nameAr: 'عرعر', nameEn: 'Arar', regionSlug: 'northern-borders', lat: 30.9753, lng: 41.0381 },
  { slug: 'rafha', nameAr: 'رفحاء', nameEn: 'Rafha', regionSlug: 'northern-borders', lat: 29.6202, lng: 43.4991 },
  { slug: 'jazan', nameAr: 'جازان', nameEn: 'Jazan', regionSlug: 'jazan', lat: 16.8894, lng: 42.5706, isPopular: true },
  { slug: 'sabya', nameAr: 'صبيا', nameEn: 'Sabya', regionSlug: 'jazan', lat: 17.1494, lng: 42.6256 },
  { slug: 'najran', nameAr: 'نجران', nameEn: 'Najran', regionSlug: 'najran', lat: 17.4917, lng: 44.1322, isPopular: true },
  { slug: 'baha', nameAr: 'الباحة', nameEn: 'Al Baha', regionSlug: 'baha', lat: 20.0129, lng: 41.4677 },
  { slug: 'sakaka', nameAr: 'سكاكا', nameEn: 'Sakaka', regionSlug: 'jouf', lat: 29.9697, lng: 40.2064 },
  { slug: 'qurayyat', nameAr: 'القريات', nameEn: 'Qurayyat', regionSlug: 'jouf', lat: 31.3319, lng: 37.3428 },
];
