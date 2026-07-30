export type Locale = "ar" | "en";

export const dictionaries = {
  ar: {
    title: "كوكب يولد أمامك",
    tagline: "عالمك، قرارك، أثر لا ينتهي.",
    events: "سجل الأحداث",
    contribution: "أضف أثراً",
    planet: "الكوكب الحي",
    timeline: "الخط الزمني",
    quality: "جودة العرض",
    stepWrite: "1. اكتب الفكرة",
    stepBalance: "2. الموازنة والمعاينة",
    stepConfirm: "3. التأكيد",
    submit: "إنشاء معاينة",
    authRequired: "تحتاج إلى رمز دخول من /auth/login لإرسال المساهمة.",
    notEnabled: "غير مفعّل",
    apiDown: "تعذر الاتصال بالخادم؛ اعمل تشغيل API لبيانات العالم الحية."
  },
  en: {
    title: "Planet Born Before You",
    tagline: "Your world, your decision, an endless trace.",
    events: "Event log",
    contribution: "Add an impact",
    planet: "Living planet",
    timeline: "Timeline",
    quality: "Quality",
    stepWrite: "1. Write the idea",
    stepBalance: "2. Balance and preview",
    stepConfirm: "3. Confirm",
    submit: "Create preview",
    authRequired: "A token from /auth/login is required to submit contributions.",
    notEnabled: "Not enabled",
    apiDown: "Could not reach the API; start it for live world data."
  }
} as const;
