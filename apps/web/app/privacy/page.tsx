import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية | إعلاني',
  description: 'ملخص كيفية تعامل إعلاني مع بيانات الحساب والإعلانات والتحليلات.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <main className="container stack">
      <section className="panel stack">
        <span className="badge">Privacy draft</span>
        <h1 style={{ margin: 0 }}>سياسة الخصوصية</h1>
        <p className="muted" style={{ margin: 0 }}>
          مسودة مناسبة للتشغيل وتحتاج مراجعة قانونية قبل الإنتاج.
        </p>
      </section>
      <section className="panel stack">
        <h2>البيانات التي نستخدمها</h2>
        <p className="muted">
          قد نعالج رقم الهاتف، بيانات الملف الشخصي، بيانات الإعلان، وسجلات الاستخدام الأساسية اللازمة للتشغيل والأمان والتحليلات.
        </p>
        <h2>الغرض من المعالجة</h2>
        <p className="muted">
          نستخدم البيانات لإنشاء الحسابات، مراجعة الإعلانات، تشغيل الدفع، عرض الإعلانات، إرسال التنبيهات، وتحسين تجربة التصفح.
        </p>
        <h2>التحليلات</h2>
        <p className="muted">
          نقيس الانطباعات والمشاهدات والنقرات والمشاركات بطريقة تراعي الخصوصية وتدعم تقارير المعلنين دون بيع بيانات المستخدمين.
        </p>
        <h2>التحكم والحذف</h2>
        <p className="muted">
          يمكن للمستخدم طلب تحديث بياناته أو حذف حسابه وفق الإجراءات المتاحة وسياسات الاحتفاظ المطلوبة للتشغيل والامتثال.
        </p>
      </section>
    </main>
  );
}
