import Link from 'next/link';

const links = [
  { href: '/ads/review', label: 'مراجعة الإعلانات' },
  { href: '/users', label: 'المستخدمون' },
  { href: '/orders', label: 'الطلبات والمدفوعات' },
  { href: '/pricing', label: 'التسعير' },
  { href: '/providers', label: 'مزودو الدفع' },
  { href: '/audit', label: 'سجل التدقيق' },
];

export default function AdminHome() {
  return (
    <div className="shell">
      <aside className="side">
        <h1>إعلاني Admin</h1>
        <p>صلاحيات RBAC من الخادم — الواجهة لا تُخفي فقط.</p>
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </aside>
      <main className="content">
        <h2 style={{ marginTop: 0 }}>لوحة المتابعة</h2>
        <div className="cards">
          <div className="card">
            <strong>—</strong>
            <span>بانتظار المراجعة</span>
          </div>
          <div className="card">
            <strong>—</strong>
            <span>مدفوعات اليوم</span>
          </div>
          <div className="card">
            <strong>—</strong>
            <span>بلاغات مفتوحة</span>
          </div>
          <div className="card">
            <strong>Sandbox</strong>
            <span>وضع الدفع الحالي</span>
          </div>
        </div>
        <p style={{ marginTop: 24, color: '#777', lineHeight: 1.7 }}>
          المراجعة تسبق الدفع دائمًا. لا تُفعَّل الإعلانات عبر Redirect؛ فقط عبر Webhook موثّق أو تحقق خادمي.
        </p>
      </main>
    </div>
  );
}
