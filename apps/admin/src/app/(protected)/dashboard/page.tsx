"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

type Metrics = {
  users: number;
  activePlanets: number;
  pendingContributions: number;
  eventsToday: number;
};

const fallback: Metrics = { users: 24819, activePlanets: 7, pendingContributions: 18, eventsToday: 1842 };

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(fallback);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    adminApi<Metrics>("/admin/metrics").then(setMetrics).catch(() => setOffline(true));
  }, []);

  const cards = [
    ["المستخدمون", metrics.users.toLocaleString("ar"), "+12.8%", "cyan", "◎"],
    ["الكواكب النشطة", metrics.activePlanets, "2 مستقرة", "green", "◉"],
    ["بانتظار المراجعة", metrics.pendingContributions, "تحتاج قرارًا", "gold", "◇"],
    ["أحداث اليوم", metrics.eventsToday.toLocaleString("ar"), "+4.2%", "purple", "⌁"],
  ];

  return (
    <main className="admin-content">
      <header className="page-heading">
        <div><span>ADMIN / OVERVIEW</span><h1>نظرة عامة على النظام</h1><p>مراقبة فورية للعالم والبنية التشغيلية</p></div>
        <button>تنزيل التقرير ↓</button>
      </header>
      {offline && <div className="offline-banner"><i /> تعذر الوصول إلى API — تُعرض آخر لقطة توضيحية</div>}
      <section className="metrics-grid">
        {cards.map(([label, value, trend, color, icon]) => (
          <article className={`admin-panel metric-card metric-${color}`} key={String(label)}>
            <div><span>{icon}</span><small>{label}</small></div>
            <strong>{value}</strong><p>{trend}</p><i />
          </article>
        ))}
      </section>
      <section className="dashboard-panels">
        <article className="admin-panel simulation-panel">
          <div className="section-title"><div><span>LIVE SIMULATION</span><h2>حالة المحاكاة K-07</h2></div><b><i /> تعمل</b></div>
          <div className="simulation-core"><div className="mini-planet">◉</div><div className="orbit-line" /></div>
          <div className="sim-stats">
            <div><span>الدورة الحالية</span><strong>8,420</strong></div>
            <div><span>زمن الدورة</span><strong>250ms</strong></div>
            <div><span>صحة المحرك</span><strong>99.98%</strong></div>
          </div>
        </article>
        <article className="admin-panel activity-panel">
          <div className="section-title"><div><span>SYSTEM PULSE</span><h2>النشاط اللحظي</h2></div></div>
          {[["22:07","محرك المحاكاة","تم إكمال الدورة 8,420","green"],["22:05","مراجعة المحتوى","مساهمة جديدة بانتظار القرار","gold"],["21:58","بوابة الأحداث","نشر 32 حدثًا للعملاء","cyan"],["21:51","نظام الحماية","فحص الصلاحيات مكتمل","purple"]].map(([time, source, message, color]) => (
            <div className="activity-row" key={`${time}-${source}`}><time>{time}</time><i className={`dot-${color}`} /><div><strong>{source}</strong><p>{message}</p></div></div>
          ))}
        </article>
      </section>
    </main>
  );
}
