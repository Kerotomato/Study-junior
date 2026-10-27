import { AppShell } from "@/components/AppShell";
import { requireParent } from "@/lib/auth";
import { familyChildren } from "@/lib/family";
import { unreadCount } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const me = await requireParent();
  const supabase = await createClient();
  const kids = await familyChildren(supabase, me.family_id);
  const [{ count: toGive }, unread] = await Promise.all([
    // まだ「渡した」にチェックしていない交換
    supabase
      .from("exchange_requests")
      .select("id", { count: "exact", head: true })
      .in(
        "child_id",
        kids.map((k) => k.id),
      )
      .eq("status", "pending")
      .is("given_at", null),
    unreadCount(supabase, me.id),
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
