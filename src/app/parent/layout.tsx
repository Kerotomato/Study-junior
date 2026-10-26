import { AppShell } from "@/components/AppShell";
import { requireParent } from "@/lib/auth";
import { familyChildren } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const me = await requireParent();
  const supabase = await createClient();
  const kids = await familyChildren(supabase, me.family_id);
  const { count } = await supabase
    .from("exchange_requests")
    .select("id", { count: "exact", head: true })
    .in(
      "child_id",
      kids.map((k) => k.id),
    )
    .eq("status", "pending");
  const links = [
    { href: "/parent", label: "子ども一覧" },
    { href: "/parent/exchanges", label: "交換申請", badge: count ?? 0 },
    { href: "/parent/rules", label: "ルール設定" },
    { href: "/parent/family", label: "家族・アカウント" },
  ];
  return (
    <AppShell name={me.name} links={links}>
      {children}
    </AppShell>
  );
}
