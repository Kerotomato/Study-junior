"use server";

import { redirect } from "next/navigation";
import { childEmail } from "@/lib/auth";
import { fail, str } from "@/lib/flash";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ZKAI_DEFAULT_POINTS, ZKAI_SUBJECTS } from "@/lib/zkai";

const DEFAULT_SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];

/** 親が家族を作成して登録する */
export async function signUp(form: FormData) {
  const name = str(form, "name");
  const familyName = str(form, "family_name");
  const email = str(form, "email");
  const password = str(form, "password");
  if (!name || !familyName || !email) fail("/signup", "すべての項目を入力してください");
  if (password.length < 8) fail("/signup", "パスワードは8文字以上にしてください");

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) fail("/signup", "登録できませんでした。メールアドレスが使われていないか確認してください");
  const userId = created.user.id;

  const { data: family, error: familyError } = await admin.from("families").insert({ name: familyName }).select("id").single();
  if (familyError || !family) {
    await admin.auth.admin.deleteUser(userId);
    fail("/signup", "登録できませんでした");
  }
  const setup = await Promise.all([
    admin.from("users").insert({ id: userId, family_id: family.id, role: "parent", name }),
    admin.from("rules").insert({ family_id: family.id }),
    admin.from("subjects").insert(DEFAULT_SUBJECTS.map((s) => ({ family_id: family.id, name: s }))),
    admin
      .from("zkai_point_rules")
      .insert(ZKAI_SUBJECTS.map((subject) => ({ family_id: family.id, subject, points: ZKAI_DEFAULT_POINTS[subject] }))),
  ]);
  if (setup.some((r) => r.error)) {
    await admin.from("families").delete().eq("id", family.id);
    await admin.auth.admin.deleteUser(userId);
    fail("/signup", "登録できませんでした");
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/parent/family");
}

/** 親はメールアドレス、子どもはログインIDでログインする */
export async function signIn(form: FormData) {
  const id = str(form, "id");
  const password = str(form, "password");
  if (!id || !password) fail("/login", "IDとパスワードを入力してください");
  const email = id.includes("@") ? id : childEmail(id);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) fail("/login", "IDまたはパスワードが違います");
  // 役割を見て、最初の画面へ直接移る（「/」を経由すると、もう1回画面の読み込みとリダイレクトが起きるため）
  const { data: profile } = await supabase.from("users").select("role").eq("id", data.user.id).maybeSingle();
  redirect(profile?.role === "parent" ? "/parent" : profile?.role === "child" ? "/child" : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
