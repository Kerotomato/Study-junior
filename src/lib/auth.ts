import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/**
 * ログイン中のユーザーの id。JWT の署名を確かめてから使う（getClaims）。
 * Supabase の JWT 署名鍵が非対称（ES256 など）ならサーバー内で確かめるので通信しない。
 * 旧来の共有鍵（HS256）のプロジェクトでは Supabase Auth に1回問い合わせる。
 * どちらの場合も、1回のリクエストの中では1回だけ（レイアウトとページで共有）。
 */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});

/** ユーザー・家族・役割（親／子）。1回のリクエストの中では1回だけ取得する */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, family_id, role, name, login_id")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  return userId;
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
