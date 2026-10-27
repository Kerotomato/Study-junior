import { Flash, type SearchParams } from "@/components/Flash";
import { NotificationList } from "@/components/NotificationList";
import { requireChild } from "@/lib/auth";
import { recentNotifications } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireChild();
  const notifications = await recentNotifications(await createClient(), me.id);
  return (
    <>
      <Flash searchParams={searchParams} />
      <NotificationList notifications={notifications} />
    </>
  );
}
