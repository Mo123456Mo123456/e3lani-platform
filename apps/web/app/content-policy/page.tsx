import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'سياسة المحتوى | إعلاني',
  description: 'قواعد نشر الإعلانات المرئية على إعلاني.',
  alternates: { canonical: '/content-policy' },
};

const rules = [
  'يجب أن يكون الإعلان واضحًا وصادقًا وغير مضلل.',
  'يمنع المحتوى غير النظامي أو الخطير أو المخالف للأنظمة المحلية.',
  'إعلاني لا يدعم مزادات أو بيع منتجات داخل المنصة أو وعود توصيل داخلية.',
  'يجب أن يحتوي الإعلان على وسيلة تواصل واحدة على الأقل: متجر، واتساب، أو هاتف.',
  'يمنع المحتوى الذي ينتهك حقوق الملكية الفكرية أو يستخدم صورًا أو علامات دون إذن.',
  'قد تؤدي التعديلات بعد القبول إلى إعادة المراجعة قبل النشر.',
];

export default function ContentPolicyPage() {
  return (
    <main className="container stack">
      <section className="panel stack">
        <span className="badge">مسودات قانونية / Legal drafts pending counsel review</span>
        <h1 style={{ margin: 0 }}>سياسة المحتوى</h1>
        <p className="muted" style={{ margin: 0 }}>
          قواعد مختصرة للحفاظ على منصة إعلانات مرئية آمنة وواضحة. هذه مسودة قانونية بانتظار
          مراجعة مستشار قانوني، وليست سياسة نهائية أو نصيحة قانونية. This is a legal draft
          pending counsel review, not a final policy or legal advice.
        </p>
      </section>
      <section className="panel stack">
        {rules.map((rule) => (
          <p key={rule} style={{ margin: 0 }}>
            <strong>•</strong> <span className="muted">{rule}</span>
          </p>
        ))}
      </section>
    </main>
  );
}
