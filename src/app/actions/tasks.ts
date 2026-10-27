"use server";

import { advanceMaterial } from "@/lib/awards";
import { requireChild, requireChildOfFamily, requireProfile } from "@/lib/auth";
import { todayJst } from "@/lib/dates";
import { backPath, done, fail, int, isNonNegInt, str } from "@/lib/flash";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Task } from "@/lib/types";

/** 今日のタスクを作る。子どもは自分に、親は子どもに追加する */
export async function createTask(form: FormData) {
  const me = await requireProfile();
  const back = backPath(form, me.role === "child" ? "/child" : "/parent");
  const childId = me.role === "child" ? me.id : (await requireChildOfFamily(me, str(form, "child_id"))).id;
  const title = str(form, "title") || null;
  const subjectId = str(form, "subject_id") || null;
  const materialId = str(form, "material_id") || null;
  const pagesFrom = materialId ? int(form, "pages_from") : null;
  const pagesTo = materialId ? int(form, "pages_to") : null;
  // 名前は任意。名前・教材・科目のどれか1つがあれば作れる（表示名は taskLabel が作る）
  if (!title && !materialId && !subjectId) fail(back, "名前・教材・科目のどれかを入力してください");
  if (pagesFrom !== null && !isNonNegInt(pagesFrom)) fail(back, "ページ数は0以上の数字で入力してください");
  if (pagesTo !== null && !isNonNegInt(pagesTo)) fail(back, "ページ数は0以上の数字で入力してください");
  if (pagesFrom !== null && pagesTo !== null && pagesFrom > pagesTo) fail(back, "ページの範囲が逆です");

  const admin = createAdminClient();
  if (subjectId) {
    const { data } = await admin.from("subjects").select("id").eq("id", subjectId).eq("family_id", me.family_id).maybeSingle();
    if (!data) fail(back, "科目が見つかりません");
  }
  if (materialId) {
    const { data } = await admin.from("materials").select("id").eq("id", materialId).eq("child_id", childId).maybeSingle();
    if (!data) fail(back, "教材が見つかりません");
  }
  const { error } = await admin.from("tasks").insert({
    child_id: childId,
    date: todayJst(),
    title,
    subject_id: subjectId,
    material_id: materialId,
    pages_from: pagesFrom,
    pages_to: pagesTo,
    created_by: me.id,
  });
  if (error) throw error;
  done(back, "タスクを追加しました");
}

async function loadOwnTask(childId: string, taskId: string): Promise<Task | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("tasks").select("*").eq("id", taskId).eq("child_id", childId).maybeSingle();
  return data as Task | null;
}

/** チェックで完了。教材と紐づいたタスクはページ進捗も更新する */
export async function completeTask(form: FormData) {
  const me = await requireChild();
  const task = await loadOwnTask(me.id, str(form, "task_id"));
  if (!task) fail("/child", "タスクが見つかりません");
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("tasks")
    .update({ done: true, done_at: new Date().toISOString() })
    .eq("id", task.id)
    .eq("done", false)
    .select("id");
  if (error) throw error;
  if (updated?.length && task.material_id && task.pages_to !== null) {
    await advanceMaterial(admin, me.id, task.material_id, task.pages_to);
  }
  done("/child", "タスク完了！");
}

/** 前日までの未完了タスクを今日に持ち越す */
export async function carryOverTask(form: FormData) {
  const me = await requireChild();
  const task = await loadOwnTask(me.id, str(form, "task_id"));
  if (!task || task.done) fail("/child", "タスクが見つかりません");
  const { error } = await createAdminClient().from("tasks").update({ date: todayJst() }).eq("id", task.id);
  if (error) throw error;
  done("/child", "今日に持ち越しました");
}

/** 前日までの未完了タスクを持ち越さずに消す */
export async function dropTask(form: FormData) {
  const me = await requireChild();
  const task = await loadOwnTask(me.id, str(form, "task_id"));
  if (!task || task.done) fail("/child", "タスクが見つかりません");
  const { error } = await createAdminClient().from("tasks").delete().eq("id", task.id);
  if (error) throw error;
  done("/child", "タスクを消しました");
}
