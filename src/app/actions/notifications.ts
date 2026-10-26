"use server";

import { requireProfile } from "@/lib/auth";
import { done } from "@/lib/flash";
import { createAdminClient } from "@/lib/supabase/admin";

export async function markAllRead() {
  const me = await requireProfile();
  const { error } = await createAdminClient().from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
  if (error) throw error;
  done("/child/notifications", "すべて既読にしました");
}
