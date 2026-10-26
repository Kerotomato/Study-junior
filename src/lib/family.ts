import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./types";

export async function familyMembers(client: SupabaseClient, familyId: string): Promise<Profile[]> {
  const { data, error } = await client
    .from("users")
    .select("id, family_id, role, name, login_id")
    .eq("family_id", familyId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function familyChildren(client: SupabaseClient, familyId: string): Promise<Profile[]> {
  return (await familyMembers(client, familyId)).filter((m) => m.role === "child");
}
