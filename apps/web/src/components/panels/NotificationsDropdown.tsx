"use client";

/** Notifications dropdown in the top bar. */
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function NotificationsDropdown() {
  const { t } = useI18n();
  const open = useAppStore((s) => s.notifOpen);
  const setOpen = useAppStore((s) => s.setNotifOpen);
  const notifications = useAppStore((s) => s.notifications);
  const setNotifications = useAppStore((s) => s.setNotifications);

  if (!open) return null;

  const markRead = async (id: string) => {
    await api.markNotificationRead(id).catch(() => undefined);
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="notif-dropdown" onMouseLeave={() => setOpen(false)}>
      <h3>{t.nav.notifications}</h3>
      {notifications.length === 0 && <p className="feed-empty">{t.feed.empty}</p>}
      {notifications.slice(0, 20).map((n) => (
        <div key={n.id} className={`notif-item ${n.read ? "read" : ""}`}>
          <p className="notif-title">{n.title}</p>
          <p className="notif-body">{n.body}</p>
          {!n.read && <button onClick={() => void markRead(n.id)}>{t.dashboard.markRead}</button>}
        </div>
      ))}
    </div>
  );
}
