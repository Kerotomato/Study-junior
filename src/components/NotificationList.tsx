import { markAllRead } from "@/app/actions/notifications";
import { formatJstDateTime } from "@/lib/dates";
import type { Notification } from "@/lib/types";

const ICON: Record<Notification["type"], string> = {
  log_deleted: "🗑️",
  log_rejected: "↩️",
  exchange_requested: "🙋",
  exchange_given: "💴",
  exchange_completed: "✅",
  exchange_cancelled: "↩️",
  exchange_approved: "✅",
  exchange_rejected: "↩️",
  bonus: "🎉",
  zkai_revoked: "↩️",
};

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const hasUnread = notifications.some((n) => !n.read);
  return (
    <section className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="h2 mb-0">通知</h2>
        {hasUnread && (
          <form action={markAllRead}>
            <button className="btn-sub">すべて既読にする</button>
          </form>
        )}
      </div>
      {notifications.length === 0 && <p className="text-sm text-stone-500">通知はありません</p>}
      <ul className="divide-y divide-stone-100">
        {notifications.map((n) => (
          <li key={n.id} className={`flex gap-3 py-3 text-sm ${n.read ? "text-stone-500" : "font-bold"}`}>
            <span aria-hidden>{ICON[n.type]}</span>
            <span className="flex-1">
              {n.message}
              <span className="block text-xs font-normal text-stone-400">{formatJstDateTime(n.created_at)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
