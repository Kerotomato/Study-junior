import { Flash, type SearchParams } from "@/components/Flash";
import { NotificationList } from "@/components/NotificationList";
import { requireChild, requireUserId } from "@/lib/auth";
import { recentNotifications } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const [supabase, userId] = await Promise.all([createClient(), requireUserId()]);
  const [, notifications] = await Promise.all([requireChild(), recentNotifications(supabase, userId)]);
  return (
    <>
      <Flash searchParams={searchParams} />
      <NotificationList notifications={notifications} />
    </>
  );
}
