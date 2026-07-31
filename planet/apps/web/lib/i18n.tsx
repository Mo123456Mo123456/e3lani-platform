"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "ar" | "en";

const ar = {
  appName: "كوكب يولد أمامك",
  tagline: "عالمك، قرارك، أثر لا ينتهي.",
  nav: {
    home: "الرئيسية", explore: "استكشف", civilizations: "الحضارات", species: "المخلوقات",
    resources: "الموارد", tech: "التقنيات", alliances: "التحالفات", timeline: "الخط الزمني",
    profile: "لوحة المستخدم", notifications: "الإشعارات", admin: "الإدارة",
  },
  auth: {
    login: "تسجيل الدخول", register: "إنشاء حساب", logout: "تسجيل الخروج",
    email: "البريد الإلكتروني", password: "كلمة المرور", displayName: "الاسم المعروض",
    haveAccount: "لديك حساب؟", needAccount: "تحتاج حسابًا؟",
  },
  dashboard: {
    liveEvents: "سجل الأحداث المباشر", addElement: "أضف عنصرًا واحدًا إلى العالم",
    myImpact: "أثر مساهماتي", contributions: "مساهمات", effects: "تأثيرات ناتجة",
    civsAffected: "حضارات متأثرة", impactAge: "عمر الأثر", lastEvent: "آخر حدث",
    year: "السنة", era: "الحقبة", tick: "نبضة",
  },
  wizard: {
    title: "إضافة عنصر جديد", category: "اختر الفئة", describe: "صف فكرتك",
    describeHint: "اكتب وصفًا حرًا… مثال: شجرة عملاقة تمتص التلوث وتضيء في الليل",
    analyze: "تحليل بالذكاء الاصطناعي", analyzing: "يحلل…", traits: "الخصائص",
    risks: "المخاطر", benefits: "المزايا", pickRegion: "اختر منطقة البداية على الكوكب",
    preview: "تشغيل محاكاة أولية", confirm: "تأكيد الإضافة إلى العالم",
    success: "احتمالية النجاح", envImpact: "الأثر البيئي", ecoImpact: "الأثر الاقتصادي",
    horizons: "السيناريوهات المستقبلية", years: "سنة", likely: "الأكثر احتمالًا",
    best: "الأفضل", worst: "الأسوأ", uncertainty: "عدم اليقين",
    sandboxNotice: "وضع المعاينة: التحليل محلي (Sandbox) لغياب مفاتيح الذكاء الاصطناعي.",
    balanceAdjust: "اقتراح متوازن: سيتم تطبيق نسخة مخففة", balanceReject: "مرفوض: يخالف قوانين العالم",
    applied: "تمت الإضافة! تابع أثرها في سجل الأحداث.",
    back: "رجوع", next: "التالي", cancel: "إلغاء",
  },
  categories: {
    creature: "مخلوق", plant: "نبات", resource: "مورد", civilization: "حضارة",
    invention: "اختراع", natural_phenomenon: "ظاهرة طبيعية", disease: "مرض",
    culture: "ثقافة", world_law: "قانون عالمي", custom: "عنصر مخصص",
  },
  layers: {
    surface: "السطح", biome: "المناطق الحيوية", weather: "الطقس", civilization: "الحضارات",
    resource: "الموارد", conflict: "النزاعات", migration: "الهجرات", trade: "التجارة",
    pollution: "التلوث", temperature: "الحرارة", historical: "التاريخية",
  },
  region: {
    title: "بيانات المنطقة", biome: "المنطقة الحيوية", height: "الارتفاع", temp: "الحرارة",
    moisture: "الرطوبة", pollution: "التلوث", fertility: "الخصوبة", river: "نهر",
    civ: "الحضارة", city: "المدينة", resources: "الموارد", speciesHere: "مخلوقات",
    plantsHere: "نباتات", pickHere: "اختيار هذه المنطقة",
  },
  timelineBar: {
    title: "تاريخ العالم", play: "تشغيل", pause: "إيقاف", now: "الحاضر",
    compare: "مقارنة حقبتين", scrub: "اسحب لاستكشاف الماضي",
  },
  stats: {
    civs: "حضارات", cities: "مدن", species: "مخلوقات", plants: "نباتات",
    techs: "تقنيات", wars: "حروب نشطة", population: "سكان", pollution: "متوسط التلوث",
  },
  quality: {
    title: "جودة العرض", ultra: "فائقة", high: "عالية", medium: "متوسطة", power_saver: "توفير الطاقة",
  },
  common: {
    loading: "يُحمّل…", error: "خطأ", retry: "إعادة", offline: "الخادم غير متصل",
    localPreview: "وضع المعاينة المحلية — بيانات مولّدة بنفس المحرك داخل متصفحك",
    language: "English", search: "بحث", close: "إغلاق", noData: "لا بيانات بعد",
    viewAll: "عرض الكل", seeImpact: "عرض الأثر", connected: "متصل", disconnected: "غير متصل",
  },
  events: {
    RESOURCE_DISCOVERED: "اكتشاف مورد", RESOURCE_DEPLETED: "نفاد مورد", SPECIES_CREATED: "ظهور نوع",
    SPECIES_MUTATED: "طفرة نوع", SPECIES_EXTINCT: "انقراض نوع", PLANT_SPREAD: "انتشار نبات",
    CIVILIZATION_FOUNDED: "نشأة حضارة", CITY_CREATED: "بناء مدينة", CITY_FALLEN: "سقوط مدينة",
    TECHNOLOGY_DISCOVERED: "اكتشاف تقنية", WAR_STARTED: "اندلاع حرب", WAR_ENDED: "نهاية حرب",
    MIGRATION_STARTED: "هجرة جماعية", ALLIANCE_CREATED: "تحالف جديد", ALLIANCE_BROKEN: "انفراط تحالف",
    DISEASE_OUTBREAK: "تفشي مرض", CLIMATE_CHANGED: "تغير مناخي", VOLCANO_ERUPTED: "ثوران بركان",
    WILDFIRE_STARTED: "حريق غابات", FLOOD_OCCURRED: "فيضان", TRADE_ROUTE_CREATED: "طريق تجاري",
    CONTRIBUTION_APPLIED: "إضافة مستخدم", ERA_STARTED: "بداية حقبة",
  },
  profile: {
    title: "لوحة المستخدم", myContributions: "عناصري", impactScore: "مستوى التأثير",
    eventsCaused: "أحداث تسببت بها", joinedAt: "انضم", role: "الدور",
  },
  pages: {
    explore: "استكشاف العالم", civilizations: "حضارات الكوكب", species: "مخلوقات الكوكب",
    resources: "موارد الكوكب", tech: "شجرة التقنيات", timeline: "الخط الزمني الكامل",
    notifications: "الإشعارات",
  },
};

export type Dictionary = typeof ar;

const en: Dictionary = {
  appName: "A Planet Is Born Before You",
  tagline: "Your world, your call, an endless trace.",
  nav: {
    home: "Home", explore: "Explore", civilizations: "Civilizations", species: "Species",
    resources: "Resources", tech: "Technologies", alliances: "Alliances", timeline: "Timeline",
    profile: "Dashboard", notifications: "Notifications", admin: "Admin",
  },
  auth: {
    login: "Sign in", register: "Create account", logout: "Sign out",
    email: "Email", password: "Password", displayName: "Display name",
    haveAccount: "Have an account?", needAccount: "Need an account?",
  },
  dashboard: {
    liveEvents: "Live event feed", addElement: "Add one element to the world",
    myImpact: "My impact", contributions: "Contributions", effects: "Resulting effects",
    civsAffected: "Civilizations affected", impactAge: "Impact age", lastEvent: "Latest event",
    year: "Year", era: "Era", tick: "Tick",
  },
  wizard: {
    title: "Add a new element", category: "Choose a category", describe: "Describe your idea",
    describeHint: "Free text… e.g. a giant tree that absorbs pollution and glows at night",
    analyze: "Analyze with AI", analyzing: "Analyzing…", traits: "Traits",
    risks: "Risks", benefits: "Benefits", pickRegion: "Pick a starting region on the planet",
    preview: "Run preview simulation", confirm: "Confirm & add to world",
    success: "Success probability", envImpact: "Environmental impact", ecoImpact: "Economic impact",
    horizons: "Future scenarios", years: "years", likely: "Most likely",
    best: "Best", worst: "Worst", uncertainty: "Uncertainty",
    sandboxNotice: "Sandbox mode: local analysis (no AI keys configured).",
    balanceAdjust: "Balanced suggestion: a nerfed version will be applied", balanceReject: "Rejected: breaks world rules",
    applied: "Added! Follow its impact in the event feed.",
    back: "Back", next: "Next", cancel: "Cancel",
  },
  categories: {
    creature: "Creature", plant: "Plant", resource: "Resource", civilization: "Civilization",
    invention: "Invention", natural_phenomenon: "Natural phenomenon", disease: "Disease",
    culture: "Culture", world_law: "World law", custom: "Custom element",
  },
  layers: {
    surface: "Surface", biome: "Biomes", weather: "Weather", civilization: "Civilizations",
    resource: "Resources", conflict: "Conflicts", migration: "Migrations", trade: "Trade",
    pollution: "Pollution", temperature: "Temperature", historical: "Historical",
  },
  region: {
    title: "Region data", biome: "Biome", height: "Elevation", temp: "Temperature",
    moisture: "Moisture", pollution: "Pollution", fertility: "Fertility", river: "River",
    civ: "Civilization", city: "City", resources: "Resources", speciesHere: "Species",
    plantsHere: "Plants", pickHere: "Pick this region",
  },
  timelineBar: {
    title: "World history", play: "Play", pause: "Pause", now: "Present",
    compare: "Compare eras", scrub: "Drag to explore the past",
  },
  stats: {
    civs: "Civilizations", cities: "Cities", species: "Species", plants: "Plants",
    techs: "Technologies", wars: "Active wars", population: "Population", pollution: "Avg pollution",
  },
  quality: {
    title: "Render quality", ultra: "Ultra", high: "High", medium: "Medium", power_saver: "Power saver",
  },
  common: {
    loading: "Loading…", error: "Error", retry: "Retry", offline: "Server unreachable",
    localPreview: "Local preview mode — generated in your browser by the same engine",
    language: "العربية", search: "Search", close: "Close", noData: "No data yet",
    viewAll: "View all", seeImpact: "See impact", connected: "Connected", disconnected: "Disconnected",
  },
  events: {
    RESOURCE_DISCOVERED: "Resource discovered", RESOURCE_DEPLETED: "Resource depleted", SPECIES_CREATED: "Species appeared",
    SPECIES_MUTATED: "Species mutated", SPECIES_EXTINCT: "Species extinct", PLANT_SPREAD: "Plant spread",
    CIVILIZATION_FOUNDED: "Civilization founded", CITY_CREATED: "City built", CITY_FALLEN: "City fallen",
    TECHNOLOGY_DISCOVERED: "Technology discovered", WAR_STARTED: "War started", WAR_ENDED: "War ended",
    MIGRATION_STARTED: "Mass migration", ALLIANCE_CREATED: "Alliance formed", ALLIANCE_BROKEN: "Alliance broken",
    DISEASE_OUTBREAK: "Disease outbreak", CLIMATE_CHANGED: "Climate shift", VOLCANO_ERUPTED: "Volcano erupted",
    WILDFIRE_STARTED: "Wildfire", FLOOD_OCCURRED: "Flood", TRADE_ROUTE_CREATED: "Trade route",
    CONTRIBUTION_APPLIED: "User addition", ERA_STARTED: "Era began",
  },
  profile: {
    title: "User dashboard", myContributions: "My elements", impactScore: "Impact score",
    eventsCaused: "Events caused", joinedAt: "Joined", role: "Role",
  },
  pages: {
    explore: "Explore the world", civilizations: "Planet civilizations", species: "Planet species",
    resources: "Planet resources", tech: "Technology tree", timeline: "Full timeline",
    notifications: "Notifications",
  },
};

const DICTS: Record<Locale, Dictionary> = { ar, en };

interface I18nCtx {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: Dictionary;
  setLocale: (l: Locale) => void;
}

const Ctx = createContext<I18nCtx>({ locale: "ar", dir: "rtl", t: ar, setLocale: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("planet-locale")) as Locale | null;
    if (saved === "ar" || saved === "en") setLocaleState(saved);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("planet-locale", l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo<I18nCtx>(
    () => ({ locale, dir: locale === "ar" ? "rtl" : "ltr", t: DICTS[locale], setLocale }),
    [locale, setLocale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  return useContext(Ctx);
}
