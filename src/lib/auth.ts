import "server-only";
import { redirect } from "next/navigation";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users")
    .select("id, family_id, role, name, login_id")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireChild(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "child") redirect("/parent");
  return profile;
}

export async function requireParent(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "parent") redirect("/child");
  return profile;
}

/** 親が操作する子どもが同じ家族か確認して返す */
export async function requireChildOfFamily(parent: Profile, childId: string): Promise<Profile> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, family_id, role, name, login_id")
    .eq("id", childId)
    .eq("family_id", parent.family_id)
    .eq("role", "child")
    .maybeSingle();
  if (!data) redirect("/parent");
  return data as Profile;
}

/** 子どものログインIDを Supabase Auth 用の内部メールアドレスに変換する */
export function childEmail(loginId: string): string {
  const domain = process.env.CHILD_EMAIL_DOMAIN || "children.study-junior.invalid";
  return `${loginId.toLowerCase()}@${domain}`;
}

export const LOGIN_ID_PATTERN = /^[a-z0-9_-]{3,20}$/;
