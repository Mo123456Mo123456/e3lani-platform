import { notFound } from "next/navigation";

const policies = {
  privacy: {
    ar: {
      title: "سياسة الخصوصية",
      paragraphs: [
        "نجمع بيانات الحساب اللازمة لتشغيل المنصة: الاسم، رقم الجوال، المدينة، ونوع الحساب. لا نبيع البيانات الشخصية.",
        "نستخدم بيانات الاستخدام والأحداث لتأمين الحساب، تحسين ترتيب الإعلانات، وتقديم إحصاءات مجمعة للمعلن.",
        "يمكن لصاحب الحساب طلب تصحيح بياناته أو حذف حسابه. قد نحتفظ بالسجلات المطلوبة نظاميًا وسجلات منع الاحتيال لمدة محدودة.",
      ],
    },
    en: {
      title: "Privacy Policy",
      paragraphs: [
        "We collect account data required to operate the platform: name, mobile number, city, and account type. We do not sell personal data.",
        "Usage events help secure accounts, improve ad ranking, and provide aggregated advertiser analytics.",
        "Account owners may request correction or deletion. Legally required and fraud-prevention records may be retained for a limited period.",
      ],
    },
  },
  terms: {
    ar: {
      title: "شروط الاستخدام",
      paragraphs: [
        "إعلاني منصة عرض إعلانات مرئية وليست طرفًا في البيع أو الشراء أو التوصيل أو التحصيل بين المستخدمين.",
        "يلتزم المعلن بصحة المحتوى وامتلاكه حقوق الوسائط والروابط، وبالأنظمة السعودية وقائمة المنتجات المسموح بها.",
        "يجوز إيقاف أو إزالة المحتوى عند ثبوت بلاغ أو مخالفة، مع إتاحة الاعتراض وفق الإجراءات المعتمدة.",
      ],
    },
    en: {
      title: "Terms of Use",
      paragraphs: [
        "E3lani displays visual advertisements and is not a party to sales, purchases, delivery, or collection between users.",
        "Advertisers must provide accurate content, hold media rights, and comply with Saudi law and allowed-item policies.",
        "Content may be paused or removed after a substantiated report, with an appeal process available.",
      ],
    },
  },
  safety: {
    ar: {
      title: "السلامة والإبلاغ",
      paragraphs: [
        "لا ترسل دفعات أو بيانات حساسة قبل التحقق من هوية المعلن والجهة الخارجية التي تنتقل إليها.",
        "استخدم زر الإبلاغ داخل الإعلان عند الاشتباه في احتيال، محتوى ممنوع، تضليل، أو تصنيف غير صحيح.",
        "تراجع الإدارة البلاغات بعد النشر، وتوثّق القرار والسبب، وتخطر صاحب الإعلان وتستقبل اعتراضه.",
      ],
    },
    en: {
      title: "Safety and reporting",
      paragraphs: [
        "Do not send funds or sensitive information before verifying the advertiser and any external destination.",
        "Use the in-ad report action for suspected fraud, prohibited content, misleading claims, or incorrect categorization.",
        "The team reviews post-publication reports, records reasons, notifies advertisers, and accepts appeals.",
      ],
    },
  },
} as const;

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en"; policy: string }>;
}) {
  const { locale, policy } = await params;
  if (!(policy in policies)) notFound();
  const content = policies[policy as keyof typeof policies][locale];
  return (
    <main className="mx-auto min-h-[70vh] max-w-3xl px-4 py-16">
      <article className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm sm:p-10">
        <h1 className="text-3xl font-black">{content.title}</h1>
        <div className="mt-7 space-y-5 leading-8 text-black/70">
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>
    </main>
  );
}
