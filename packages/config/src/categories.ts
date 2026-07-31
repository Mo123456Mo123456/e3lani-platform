/**
 * أقسام المنصة الافتراضية — تُبذر في قاعدة البيانات وتُدار بعد ذلك من لوحة الإدارة.
 * Default catalogue; fully manageable from the admin dashboard afterwards.
 */
export interface SeedCategory {
  slug: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  children: { slug: string; nameAr: string; nameEn: string }[];
}

const c = (slug: string, nameAr: string, nameEn: string) => ({ slug, nameAr, nameEn });

export const CATEGORIES: SeedCategory[] = [
  {
    slug: 'cars', nameAr: 'السيارات', nameEn: 'Cars', icon: 'car',
    children: [
      c('cars-used', 'سيارات مستعملة', 'Used cars'),
      c('cars-new', 'سيارات جديدة', 'New cars'),
      c('cars-classic', 'سيارات كلاسيكية', 'Classic cars'),
      c('cars-parts', 'قطع غيار', 'Spare parts'),
      c('cars-plates', 'لوحات مميزة', 'Distinct plates'),
      c('cars-services', 'خدمات سيارات', 'Car services'),
    ],
  },
  {
    slug: 'real-estate', nameAr: 'العقارات', nameEn: 'Real estate', icon: 'building',
    children: [
      c('re-apartments', 'شقق', 'Apartments'),
      c('re-villas', 'فلل', 'Villas'),
      c('re-land', 'أراضٍ', 'Land'),
      c('re-commercial', 'محلات ومكاتب', 'Shops & offices'),
      c('re-rest-houses', 'استراحات ومخيمات', 'Rest houses & camps'),
      c('re-buildings', 'عمائر', 'Buildings'),
    ],
  },
  {
    slug: 'electronics', nameAr: 'الإلكترونيات', nameEn: 'Electronics', icon: 'device',
    children: [
      c('el-phones', 'جوالات', 'Mobile phones'),
      c('el-computers', 'حاسبات ولابتوب', 'Computers & laptops'),
      c('el-tv', 'شاشات وتلفزيونات', 'TVs & displays'),
      c('el-cameras', 'كاميرات', 'Cameras'),
      c('el-accessories', 'إكسسوارات', 'Accessories'),
      c('el-home-appliances', 'أجهزة منزلية', 'Home appliances'),
    ],
  },
  {
    slug: 'furniture', nameAr: 'الأثاث', nameEn: 'Furniture', icon: 'sofa',
    children: [
      c('fu-living', 'مجالس وكنب', 'Majlis & sofas'),
      c('fu-bedrooms', 'غرف نوم', 'Bedrooms'),
      c('fu-dining', 'طاولات طعام', 'Dining'),
      c('fu-office', 'أثاث مكتبي', 'Office furniture'),
      c('fu-outdoor', 'أثاث خارجي', 'Outdoor furniture'),
      c('fu-decor', 'ديكور', 'Decor'),
    ],
  },
  {
    slug: 'fashion', nameAr: 'الأزياء', nameEn: 'Fashion', icon: 'shirt',
    children: [
      c('fa-men', 'أزياء رجالية', 'Men'),
      c('fa-women', 'أزياء نسائية', 'Women'),
      c('fa-kids', 'أزياء أطفال', 'Kids'),
      c('fa-abaya', 'عبايات', 'Abayas'),
      c('fa-shoes-bags', 'أحذية وحقائب', 'Shoes & bags'),
      c('fa-watches', 'ساعات ومجوهرات', 'Watches & jewellery'),
    ],
  },
  {
    slug: 'services', nameAr: 'الخدمات', nameEn: 'Services', icon: 'tools',
    children: [
      c('sv-maintenance', 'صيانة', 'Maintenance'),
      c('sv-cleaning', 'نظافة', 'Cleaning'),
      c('sv-moving', 'نقل عفش', 'Moving'),
      c('sv-design', 'تصميم وتسويق', 'Design & marketing'),
      c('sv-photography', 'تصوير', 'Photography'),
      c('sv-legal', 'خدمات قانونية ومحاسبية', 'Legal & accounting'),
    ],
  },
  {
    slug: 'jobs', nameAr: 'الوظائف', nameEn: 'Jobs', icon: 'briefcase',
    children: [
      c('jo-fulltime', 'دوام كامل', 'Full time'),
      c('jo-parttime', 'دوام جزئي', 'Part time'),
      c('jo-remote', 'عن بعد', 'Remote'),
      c('jo-freelance', 'عمل حر', 'Freelance'),
      c('jo-seeking', 'باحث عن عمل', 'Job seekers'),
    ],
  },
  {
    slug: 'equipment', nameAr: 'المعدات', nameEn: 'Equipment', icon: 'truck',
    children: [
      c('eq-heavy', 'معدات ثقيلة', 'Heavy equipment'),
      c('eq-agri', 'معدات زراعية', 'Agricultural equipment'),
      c('eq-industrial', 'معدات صناعية', 'Industrial equipment'),
      c('eq-restaurant', 'معدات مطاعم', 'Restaurant equipment'),
      c('eq-tools', 'عدد وأدوات', 'Tools'),
    ],
  },
  {
    slug: 'animals', nameAr: 'الحيوانات المسموح بها', nameEn: 'Permitted animals', icon: 'paw',
    children: [
      c('an-livestock', 'مواشي', 'Livestock'),
      c('an-camels', 'إبل', 'Camels'),
      c('an-horses', 'خيول', 'Horses'),
      c('an-birds', 'طيور', 'Birds'),
      c('an-fish', 'أسماك زينة', 'Ornamental fish'),
      c('an-supplies', 'مستلزمات', 'Supplies'),
    ],
  },
  {
    slug: 'games', nameAr: 'الألعاب', nameEn: 'Games', icon: 'gamepad',
    children: [
      c('ga-consoles', 'أجهزة ألعاب', 'Consoles'),
      c('ga-video-games', 'ألعاب فيديو', 'Video games'),
      c('ga-accounts', 'حسابات وشحن', 'Accounts & top-ups'),
      c('ga-toys', 'ألعاب أطفال', 'Toys'),
      c('ga-outdoor', 'ألعاب خارجية', 'Outdoor games'),
    ],
  },
  {
    slug: 'rentals', nameAr: 'التأجير', nameEn: 'Rentals', icon: 'key',
    children: [
      c('re-cars-rent', 'تأجير سيارات', 'Car rental'),
      c('re-equipment-rent', 'تأجير معدات', 'Equipment rental'),
      c('re-events-rent', 'تأجير مستلزمات مناسبات', 'Event supplies rental'),
      c('re-chalets', 'شاليهات واستراحات', 'Chalets & rest houses'),
      c('re-cameras-rent', 'تأجير كاميرات', 'Camera rental'),
    ],
  },
  {
    slug: 'home-products', nameAr: 'المنتجات المنزلية', nameEn: 'Home products', icon: 'home',
    children: [
      c('hp-kitchen', 'أدوات مطبخ', 'Kitchenware'),
      c('hp-textile', 'مفروشات', 'Textiles'),
      c('hp-cleaning', 'منظفات', 'Cleaning supplies'),
      c('hp-garden', 'حديقة', 'Garden'),
      c('hp-storage', 'تنظيم وتخزين', 'Storage & organisation'),
    ],
  },
  {
    slug: 'productive-families', nameAr: 'الأسر المنتجة', nameEn: 'Productive families', icon: 'heart-hands',
    children: [
      c('pf-food', 'مأكولات', 'Food'),
      c('pf-sweets', 'حلويات', 'Sweets'),
      c('pf-crafts', 'حرف يدوية', 'Handicrafts'),
      c('pf-perfumes', 'عطور وبخور', 'Perfumes & incense'),
      c('pf-gifts', 'هدايا وتغليف', 'Gifts & packaging'),
    ],
  },
  {
    slug: 'tickets', nameAr: 'التذاكر', nameEn: 'Tickets', icon: 'ticket',
    children: [
      c('ti-events', 'فعاليات', 'Events'),
      c('ti-sports', 'رياضة', 'Sports'),
      c('ti-concerts', 'حفلات', 'Concerts'),
      c('ti-travel', 'سفر', 'Travel'),
      c('ti-parks', 'مدن ترفيهية', 'Theme parks'),
    ],
  },
  {
    slug: 'health-beauty', nameAr: 'الصحة والجمال', nameEn: 'Health & beauty', icon: 'sparkles',
    children: [
      c('hb-skincare', 'العناية بالبشرة', 'Skincare'),
      c('hb-haircare', 'العناية بالشعر', 'Haircare'),
      c('hb-makeup', 'مكياج', 'Makeup'),
      c('hb-fitness', 'لياقة ورياضة', 'Fitness'),
      c('hb-clinics', 'عيادات ومراكز', 'Clinics & centres'),
    ],
  },
  {
    slug: 'education', nameAr: 'التعليم', nameEn: 'Education', icon: 'graduation',
    children: [
      c('ed-courses', 'دورات', 'Courses'),
      c('ed-tutoring', 'دروس خصوصية', 'Private tutoring'),
      c('ed-languages', 'لغات', 'Languages'),
      c('ed-books', 'كتب ومناهج', 'Books & curricula'),
      c('ed-training', 'تدريب مهني', 'Professional training'),
    ],
  },
  {
    slug: 'travel', nameAr: 'السفر', nameEn: 'Travel', icon: 'plane',
    children: [
      c('tr-packages', 'برامج سياحية', 'Travel packages'),
      c('tr-hotels', 'فنادق وشقق', 'Hotels & apartments'),
      c('tr-flights', 'حجوزات طيران', 'Flight bookings'),
      c('tr-visas', 'تأشيرات', 'Visas'),
      c('tr-transport', 'نقل ومواصلات', 'Transport'),
    ],
  },
  {
    slug: 'restaurants', nameAr: 'المطاعم', nameEn: 'Restaurants', icon: 'utensils',
    children: [
      c('rs-restaurants', 'مطاعم', 'Restaurants'),
      c('rs-cafes', 'كافيهات', 'Cafés'),
      c('rs-catering', 'تموين وضيافة', 'Catering'),
      c('rs-trucks', 'عربات طعام', 'Food trucks'),
      c('rs-offers', 'عروض', 'Offers'),
    ],
  },
  {
    slug: 'brands', nameAr: 'البراندات', nameEn: 'Brands', icon: 'badge',
    children: [
      c('br-local', 'براندات محلية', 'Local brands'),
      c('br-global', 'براندات عالمية', 'Global brands'),
      c('br-launches', 'إطلاقات جديدة', 'New launches'),
      c('br-collabs', 'تعاونات', 'Collaborations'),
    ],
  },
  {
    slug: 'exchange-donation', nameAr: 'التبادل والتبرع', nameEn: 'Exchange & donation', icon: 'recycle',
    children: [
      c('ex-exchange', 'تبادل', 'Exchange'),
      c('ex-donation', 'تبرع', 'Donation'),
      c('ex-free', 'مجاني', 'Free'),
      c('ex-charity', 'أعمال خيرية', 'Charity work'),
    ],
  },
  {
    slug: 'other', nameAr: 'أخرى', nameEn: 'Other', icon: 'dots',
    children: [
      c('ot-misc', 'متنوع', 'Miscellaneous'),
      c('ot-lost-found', 'مفقودات', 'Lost & found'),
      c('ot-announcements', 'إعلانات عامة', 'General announcements'),
    ],
  },
];
