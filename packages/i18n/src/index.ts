export type AppLocale = 'ar' | 'en';

export type MessageKey =
  | 'brand.name'
  | 'brand.tagline'
  | 'nav.home'
  | 'nav.categories'
  | 'nav.add'
  | 'nav.saved'
  | 'nav.account'
  | 'nav.search'
  | 'nav.notifications'
  | 'common.back'
  | 'common.retry'
  | 'common.loading'
  | 'common.error'
  | 'common.share'
  | 'common.all'
  | 'feed.forYou'
  | 'feed.nearby'
  | 'feed.latest'
  | 'feed.visitStore'
  | 'feed.contact'
  | 'feed.search'
  | 'feed.emptyTitle'
  | 'feed.emptyBody'
  | 'feed.offlineTitle'
  | 'feed.offlineBody'
  | 'feed.details'
  | 'categories.title'
  | 'categories.exploreMore'
  | 'search.title'
  | 'search.placeholder'
  | 'search.filters'
  | 'search.city'
  | 'search.category'
  | 'search.kind'
  | 'search.kindAll'
  | 'search.kindImage'
  | 'search.kindVideo'
  | 'search.sort'
  | 'search.sortLatest'
  | 'search.sortViews'
  | 'search.sortFeatured'
  | 'search.verified'
  | 'search.featured'
  | 'search.results'
  | 'notifications.title'
  | 'notifications.markAllRead'
  | 'notifications.empty'
  | 'notifications.unread'
  | 'create.next'
  | 'create.stepMedia'
  | 'create.stepTitle'
  | 'create.stepCategory'
  | 'create.stepCity'
  | 'create.stepContact'
  | 'create.stepPreview'
  | 'create.title'
  | 'create.pickMedia'
  | 'create.mediaHint'
  | 'create.submitReview'
  | 'create.mediaRequired'
  | 'create.uploadPreparing'
  | 'create.uploading'
  | 'create.processing'
  | 'create.ready'
  | 'create.reviewPrice'
  | 'account.overview'
  | 'account.views'
  | 'account.clicks'
  | 'account.saves'
  | 'account.shares'
  | 'account.title'
  | 'account.loginPrompt'
  | 'account.logout'
  | 'account.myAds'
  | 'account.noAds'
  | 'account.pause'
  | 'account.resume'
  | 'account.extend'
  | 'account.republish'
  | 'account.actionDone'
  | 'ad.title'
  | 'ad.openBrand'
  | 'ad.notFound'
  | 'brand.title'
  | 'brand.verified'
  | 'brand.ads'
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
  'nav.search': 'بحث',
  'nav.notifications': 'الإشعارات',
  'common.back': 'رجوع',
  'common.retry': 'إعادة المحاولة',
  'common.loading': 'جار التحميل...',
  'common.error': 'حدث خطأ',
  'common.share': 'مشاركة',
  'common.all': 'الكل',
  'feed.forYou': 'لك',
  'feed.nearby': 'قريب منك',
  'feed.latest': 'الأحدث',
  'feed.visitStore': 'زيارة المتجر',
  'feed.contact': 'تواصل',
  'feed.search': 'بحث وفلاتر',
  'feed.emptyTitle': 'لا توجد إعلانات نشطة بعد',
  'feed.emptyBody': 'اسحب للتحديث أو جرّب بحثًا وفلاتر أخرى.',
  'feed.offlineTitle': 'تعذر تحميل الخلاصة',
  'feed.offlineBody': 'تحقق من اتصال الإنترنت ثم أعد المحاولة.',
  'feed.details': 'التفاصيل',
  'categories.title': 'الأقسام',
  'categories.exploreMore': 'استكشف المزيد',
  'search.title': 'بحث وفلاتر',
  'search.placeholder': 'ابحث عن إعلان أو متجر',
  'search.filters': 'الفلاتر',
  'search.city': 'المدينة',
  'search.category': 'القسم',
  'search.kind': 'نوع الوسائط',
  'search.kindAll': 'كل الوسائط',
  'search.kindImage': 'صور',
  'search.kindVideo': 'فيديو',
  'search.sort': 'الترتيب',
  'search.sortLatest': 'الأحدث',
  'search.sortViews': 'الأكثر مشاهدة',
  'search.sortFeatured': 'المميز',
  'search.verified': 'موثّق',
  'search.featured': 'مميز',
  'search.results': 'النتائج',
  'notifications.title': 'الإشعارات',
  'notifications.markAllRead': 'تعليم الكل كمقروء',
  'notifications.empty': 'لا توجد إشعارات حتى الآن.',
  'notifications.unread': 'غير مقروء',
  'create.next': 'التالي',
  'create.stepMedia': 'صور أو فيديو',
  'create.stepTitle': 'عنوان الإعلان',
  'create.stepCategory': 'القسم',
  'create.stepCity': 'المدينة',
  'create.stepContact': 'وسائل التواصل',
  'create.stepPreview': 'معاينة الإعلان',
  'create.title': 'إنشاء إعلان',
  'create.pickMedia': 'صور أو فيديو',
  'create.mediaHint': 'MP4/MOV حتى 60 ثانية و200MB',
  'create.submitReview': 'إرسال للمراجعة',
  'create.mediaRequired': 'الوسائط مطلوبة',
  'create.uploadPreparing': 'تجهيز الرفع',
  'create.uploading': 'جار رفع الوسائط',
  'create.processing': 'معالجة الوسائط',
  'create.ready': 'الوسائط جاهزة',
  'create.reviewPrice': 'المراجعة مجانية. الدفع 59 ر.س بعد القبول فقط.',
  'account.overview': 'نظرة عامة',
  'account.views': 'المشاهدات',
  'account.clicks': 'النقرات',
  'account.saves': 'الحفظ',
  'account.shares': 'المشاركات',
  'account.title': 'حسابي',
  'account.loginPrompt': 'سجّل الدخول',
  'account.logout': 'خروج',
  'account.myAds': 'إعلاناتي',
  'account.noAds': 'لا توجد إعلانات.',
  'account.pause': 'إيقاف مؤقت',
  'account.resume': 'استئناف',
  'account.extend': 'تمديد 15 يوم',
  'account.republish': 'إعادة نشر',
  'account.actionDone': 'تم تنفيذ الإجراء',
  'ad.title': 'تفاصيل الإعلان',
  'ad.openBrand': 'صفحة المعلن',
  'ad.notFound': 'تعذر العثور على الإعلان.',
  'brand.title': 'صفحة المعلن',
  'brand.verified': 'موثّق',
  'brand.ads': 'إعلانات المعلن',
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
  'nav.search': 'Search',
  'nav.notifications': 'Notifications',
  'common.back': 'Back',
  'common.retry': 'Retry',
  'common.loading': 'Loading...',
  'common.error': 'Something went wrong',
  'common.share': 'Share',
  'common.all': 'All',
  'feed.forYou': 'For You',
  'feed.nearby': 'Near You',
  'feed.latest': 'Latest',
  'feed.visitStore': 'Visit Store',
  'feed.contact': 'Contact',
  'feed.search': 'Search & filters',
  'feed.emptyTitle': 'No active ads yet',
  'feed.emptyBody': 'Pull to refresh or try different search filters.',
  'feed.offlineTitle': 'Could not load the feed',
  'feed.offlineBody': 'Check your internet connection, then try again.',
  'feed.details': 'Details',
  'categories.title': 'Categories',
  'categories.exploreMore': 'Explore more',
  'search.title': 'Search & filters',
  'search.placeholder': 'Search ads or stores',
  'search.filters': 'Filters',
  'search.city': 'City',
  'search.category': 'Category',
  'search.kind': 'Media type',
  'search.kindAll': 'All media',
  'search.kindImage': 'Images',
  'search.kindVideo': 'Video',
  'search.sort': 'Sort',
  'search.sortLatest': 'Latest',
  'search.sortViews': 'Most viewed',
  'search.sortFeatured': 'Featured',
  'search.verified': 'Verified',
  'search.featured': 'Featured',
  'search.results': 'Results',
  'notifications.title': 'Notifications',
  'notifications.markAllRead': 'Mark all as read',
  'notifications.empty': 'No notifications yet.',
  'notifications.unread': 'Unread',
  'create.next': 'Next',
  'create.stepMedia': 'Photos or Video',
  'create.stepTitle': 'Ad title',
  'create.stepCategory': 'Category',
  'create.stepCity': 'City',
  'create.stepContact': 'Contact methods',
  'create.stepPreview': 'Preview ad',
  'create.title': 'Create Ad',
  'create.pickMedia': 'Photos or Video',
  'create.mediaHint': 'MP4/MOV up to 60 seconds and 200MB',
  'create.submitReview': 'Submit for review',
  'create.mediaRequired': 'Media is required',
  'create.uploadPreparing': 'Preparing upload',
  'create.uploading': 'Uploading media',
  'create.processing': 'Processing media',
  'create.ready': 'Media is ready',
  'create.reviewPrice': 'Review is free. Pay SAR 59 only after approval.',
  'account.overview': 'Overview',
  'account.views': 'Views',
  'account.clicks': 'Clicks',
  'account.saves': 'Saves',
  'account.shares': 'Shares',
  'account.title': 'Account',
  'account.loginPrompt': 'Sign in',
  'account.logout': 'Logout',
  'account.myAds': 'My Ads',
  'account.noAds': 'No ads yet.',
  'account.pause': 'Pause',
  'account.resume': 'Resume',
  'account.extend': 'Extend 15 days',
  'account.republish': 'Republish',
  'account.actionDone': 'Action completed',
  'ad.title': 'Ad details',
  'ad.openBrand': 'Advertiser page',
  'ad.notFound': 'Ad could not be found.',
  'brand.title': 'Advertiser page',
  'brand.verified': 'Verified',
  'brand.ads': 'Advertiser ads',
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
