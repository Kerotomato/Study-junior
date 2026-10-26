"use server";

import { childEmail, LOGIN_ID_PATTERN, requireParent } from "@/lib/auth";
import { done, fail, str } from "@/lib/flash";
import { createAdminClient } from "@/lib/supabase/admin";

const BACK = "/parent/family";

async function createMember(
  familyId: string,
  role: "parent" | "child",
  name: string,
  email: string,
  password: string,
  loginId: string | null,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    fail(BACK, role === "child" ? "そのログインIDは使われています" : "そのメールアドレスは使われています");
  }
  const { error: insertError } = await admin
    .from("users")
    .insert({ id: data.user.id, family_id: familyId, role, name, login_id: loginId });
  if (insertError) {
    await admin.auth.admin.deleteUser(data.user.id);
    fail(BACK, "追加できませんでした");
  }
}

/** 子どもを追加する。子どもはログインIDとパスワードでログインする */
export async function addChild(form: FormData) {
  const me = await requireParent();
  const name = str(form, "name");
  const loginId = str(form, "login_id").toLowerCase();
  const password = str(form, "password");
  if (!name) fail(BACK, "名前を入力してください");
  if (!LOGIN_ID_PATTERN.test(loginId)) fail(BACK, "ログインIDは半角英数字・_・- の3〜20文字にしてください");
  if (password.length < 8) fail(BACK, "パスワードは8文字以上にしてください");
  await createMember(me.family_id, "child", name, childEmail(loginId), password, loginId);
  done(BACK, `${name}さんを追加しました（ログインID：${loginId}）`);
}

/** もう1人の親を追加する */
export async function addParent(form: FormData) {
  const me = await requireParent();
  const name = str(form, "name");
  const email = str(form, "email");
  const password = str(form, "password");
  if (!name || !email.includes("@")) fail(BACK, "名前とメールアドレスを入力してください");
  if (password.length < 8) fail(BACK, "パスワードは8文字以上にしてください");
  await createMember(me.family_id, "parent", name, email, password, null);
  done(BACK, `${name}さんを追加しました`);
}

export async function addSubject(form: FormData) {
  const me = await requireParent();
  const name = str(form, "name");
  if (!name) fail(BACK, "科目名を入力してください");
  const { error } = await createAdminClient().from("subjects").insert({ family_id: me.family_id, name });
  if (error) throw error;
  done(BACK, `科目「${name}」を追加しました`);
}
