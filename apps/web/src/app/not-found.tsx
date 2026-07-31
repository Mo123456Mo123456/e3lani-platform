import Link from 'next/link';
import { Logo } from '@e3lani/ui';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <Logo size={44} />
        <h1 className="text-2xl font-extrabold">الصفحة غير موجودة</h1>
        <p className="text-ink-muted">ربما حُذف الإعلان أو انتهت مدته.</p>
        <Link
          href="/"
          className="rounded-lg bg-primary px-6 py-3 font-bold text-ink hover:bg-primary-dark"
        >
          العودة للرئيسية
        </Link>
      </div>
    </main>
  );
}
