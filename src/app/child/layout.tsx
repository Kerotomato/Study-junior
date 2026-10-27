import { AppShell } from "@/components/AppShell";
import { requireChild } from "@/lib/auth";
import { unreadCount } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const me = await requireChild();
  const unread = await unreadCount(await createClient(), me.id);
  const links = [
    { href: "/child", label: "ホーム" },
    { href: "/child/record", label: "記録" },
    { href: "/child/history", label: "履歴" },
    { href: "/child/materials", label: "教材" },
    { href: "/child/tests", label: "テスト" },
    { href: "/child/zkai", label: "Z会" },
    { href: "/child/exchange", label: "交換" },
    { href: "/child/notifications", label: "通知", badge: unread },
  ];
  return (
    <AppShell name={me.name} links={links}>
      {children}
    </AppShell>
  );
}
