export type AppLocale = 'ar' | 'en';

export type MessageKey =
  | 'brand.name'
  | 'brand.tagline'
  | 'nav.home'
  | 'nav.categories'
  | 'nav.add'
  | 'nav.saved'
  | 'nav.account'
  | 'feed.forYou'
  | 'feed.nearby'
  | 'feed.latest'
  | 'feed.visitStore'
  | 'feed.contact'
  | 'categories.title'
  | 'categories.exploreMore'
  | 'create.next'
  | 'create.stepMedia'
  | 'create.stepTitle'
  | 'create.stepCategory'
  | 'create.stepCity'
  | 'create.stepContact'
  | 'create.stepPreview'
  | 'account.overview'
  | 'account.views'
  | 'account.clicks'
  | 'account.saves'
  | 'account.shares'
  | 'payment.awaitingApproval'
  | 'payment.noProvider';

const ar: Record<MessageKey, string> = {
  'brand.name': 'إعلاني',
  'brand.tagline': 'منصة الإعلانات المرئية لكل شيء',
  'nav.home': 'الرئيسية',
  'nav.categories': 'الأقسام',
  'nav.add': 'أضف إعلان',
  'nav.saved': 'المحفوظات',
  'nav.account': 'حسابي',
  'feed.forYou': 'لك',
  'feed.nearby': 'قريب منك',
  'feed.latest': 'الأحدث',
  'feed.visitStore': 'زيارة المتجر',
  'feed.contact': 'تواصل',
  'categories.title': 'الأقسام',
  'categories.exploreMore': 'استكشف المزيد',
  'create.next': 'التالي',
  'create.stepMedia': 'صور أو فيديو',
  'create.stepTitle': 'عنوان الإعلان',
  'create.stepCategory': 'القسم',
  'create.stepCity': 'المدينة',
  'create.stepContact': 'وسائل التواصل',
  'create.stepPreview': 'معاينة الإعلان',
  'account.overview': 'نظرة عامة',
  'account.views': 'المشاهدات',
  'account.clicks': 'النقرات',
  'account.saves': 'الحفظ',
  'account.shares': 'المشاركات',
  'payment.awaitingApproval': 'الدفع يظهر بعد قبول المراجعة فقط',
  'payment.noProvider': 'لا يوجد مزود دفع متاح حاليًا لهذه الدولة/العملة',
};

const en: Record<MessageKey, string> = {
  'brand.name': 'E3lani',
  'brand.tagline': 'The Visual Advertising Platform for Everything',
  'nav.home': 'Home',
  'nav.categories': 'Categories',
  'nav.add': 'Add Ad',
  'nav.saved': 'Saved',
  'nav.account': 'Account',
  'feed.forYou': 'For You',
  'feed.nearby': 'Near You',
  'feed.latest': 'Latest',
  'feed.visitStore': 'Visit Store',
  'feed.contact': 'Contact',
  'categories.title': 'Categories',
  'categories.exploreMore': 'Explore more',
  'create.next': 'Next',
  'create.stepMedia': 'Photos or Video',
  'create.stepTitle': 'Ad title',
  'create.stepCategory': 'Category',
  'create.stepCity': 'City',
  'create.stepContact': 'Contact methods',
  'create.stepPreview': 'Preview ad',
  'account.overview': 'Overview',
  'account.views': 'Views',
  'account.clicks': 'Clicks',
  'account.saves': 'Saves',
  'account.shares': 'Shares',
  'payment.awaitingApproval': 'Payment is available only after review approval',
  'payment.noProvider': 'No payment provider is available for this country/currency',
};

const catalogs = { ar, en } as const;

export function t(locale: AppLocale, key: MessageKey): string {
  return catalogs[locale][key];
}

export function getCatalog(locale: AppLocale): Record<MessageKey, string> {
  return catalogs[locale];
}
