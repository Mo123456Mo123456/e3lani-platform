import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'الشروط والأحكام | إعلاني',
  description: 'الشروط الأساسية لاستخدام منصة إعلاني.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <main className="container stack">
      <section className="panel stack">
        <span className="badge">Legal review draft</span>
        <h1 style={{ margin: 0 }}>الشروط والأحكام</h1>
        <p className="muted" style={{ margin: 0 }}>
          هذه صياغة تشغيلية أولية وتحتاج مراجعة قانونية قبل الإطلاق النهائي.
        </p>
      </section>
      <section className="panel stack">
        <h2>استخدام المنصة</h2>
        <p className="muted">
          إعلاني منصة إعلانات مرئية فقط. لا توفر المنصة سلة شراء أو دفع منتجات أو توصيل أو عمولة بيع، ويكون التواصل التجاري خارج المنصة مباشرة بين المستخدم والمعلن.
        </p>
        <h2>حسابات المعلنين</h2>
        <p className="muted">
          يجب تقديم بيانات صحيحة، والحفاظ على أمان الحساب، والالتزام بسياسات المحتوى والأنظمة المعمول بها في السعودية.
        </p>
        <h2>الإعلانات والدفع</h2>
        <p className="muted">
          تخضع الإعلانات للمراجعة قبل النشر. يظهر الدفع بعد قبول الإعلان فقط، وقد تتطلب الإضافات مثل التمديد أو إعادة النشر أو الإبراز طلبًا أو دفعًا منفصلًا.
        </p>
        <h2>الإزالة والتعليق</h2>
        <p className="muted">
          يحق لإعلاني إزالة المحتوى المخالف أو تعليق الحسابات عند وجود مخالفة للسياسات أو خطر على المستخدمين أو المنصة.
        </p>
      </section>
    </main>
  );
}
