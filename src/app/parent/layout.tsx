import { AppShell } from "@/components/AppShell";
import { requireParent, requireUserId } from "@/lib/auth";
import { unreadCount } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const [supabase, userId] = await Promise.all([createClient(), requireUserId()]);
  const [me, { count: toGive }, unread] = await Promise.all([
    requireParent(),
    // まだ「渡した」にチェックしていない交換（RLS で自分の家族の子どもの分だけ数える）
    supabase.from("exchange_requests").select("id", { count: "exact", head: true }).eq("status", "pending").is("given_at", null),
    unreadCount(supabase, userId),
  ]);
  const links = [
    { href: "/parent", label: "子ども一覧" },
    { href: "/parent/exchanges", label: "ポイント交換", badge: toGive ?? 0 },
    { href: "/parent/zkai", label: "Z会" },
    { href: "/parent/notifications", label: "通知", badge: unread },
    { href: "/parent/rules", label: "ルール設定" },
    { href: "/parent/family", label: "家族・アカウント" },
  ];
  return (
    <AppShell name={me.name} links={links}>
      {children}
    </AppShell>
  );
}
