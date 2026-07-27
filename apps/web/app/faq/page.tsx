import type { Metadata } from 'next';
import Link from 'next/link';
import { DEFAULT_SA_PRICING } from '@e3lani/types';

export const metadata: Metadata = {
  title: 'الأسئلة الشائعة | إعلاني',
  description: 'إجابات سريعة عن النشر، المراجعة، الدفع، والتواصل في إعلاني.',
  alternates: { canonical: '/faq' },
};

const publishPrice = DEFAULT_SA_PRICING.AD_PUBLISH_30D;

const faqs = [
  ['ما هو إعلاني؟', 'إعلاني | E3lani منصة للإعلانات المرئية. يتصفح المستخدمون صورًا وفيديوهات ويتواصلون مباشرة مع المعلن عبر متجر أو واتساب أو هاتف.'],
  ['كم سعر الإعلان؟', `الإعلان العادي ${publishPrice.amount} ${publishPrice.currency} لمدة 30 يومًا، وتظهر خيارات الدفع بعد قبول الإعلان في المراجعة.`],
  ['هل يوجد بيع أو شحن داخل التطبيق؟', 'لا. إعلاني ليس متجرًا إلكترونيًا ولا يدير سلة أو توصيلًا أو عمولة مبيعات.'],
  ['متى أدفع؟', 'المراجعة مجانية. الدفع يظهر فقط بعد قبول الإعلان الحالي.'],
  ['ما أنواع الوسائط المدعومة؟', 'صورة أو فيديو قصير، مع دعم JPG وPNG وWebP وMP4 وMOV حسب قيود المنصة.'],
  ['كيف أتواصل مع معلن؟', 'من صفحة الإعلان يمكنك زيارة رابط المتجر أو فتح واتساب أو الاتصال إذا وفر المعلن وسيلة التواصل.'],
];

export default function FaqPage() {
  return (
    <main className="container stack">
      <section className="panel stack">
        <span className="badge">إعلاني | E3lani</span>
        <h1 style={{ margin: 0 }}>الأسئلة الشائعة</h1>
        <p className="muted" style={{ margin: 0 }}>
          منصة الإعلانات المرئية لكل شيء
        </p>
      </section>
      <div className="grid-2">
        {faqs.map(([question, answer]) => (
          <article key={question} className="panel stack">
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{question}</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.8 }}>
              {answer}
            </p>
          </article>
        ))}
      </div>
      <Link className="btn btn-primary" href="/ads/new" style={{ width: 'fit-content' }}>
        أنشئ إعلانًا
      </Link>
    </main>
  );
}
