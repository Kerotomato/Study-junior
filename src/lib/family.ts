import "server-only";
import { cache } from "react";
import type { UserClient } from "./supabase/server";
import type { Profile } from "./types";

/** 家族のメンバー。RLS で自分の家族だけが返る（1回のリクエストの中では1回だけ取得） */
export const familyMembers = cache(async (client: UserClient): Promise<Profile[]> => {
  const { data, error } = await client.from("users").select("id, family_id, role, name, login_id").order("created_at");
  if (error) throw error;
  return (data ?? []) as Profile[];
});

export async function familyChildren(client: UserClient): Promise<Profile[]> {
  return (await familyMembers(client)).filter((m) => m.role === "child");
}
