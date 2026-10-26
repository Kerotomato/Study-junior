"use server";

import { requireChild, requireChildOfFamily, requireParent, requireProfile } from "@/lib/auth";
import { backPath, done, fail, int, isNonNegInt, str } from "@/lib/flash";
import { createAdminClient } from "@/lib/supabase/admin";

/** 教材を登録する（名前・科目・総ページ数）。子どもは自分に、親は子どもに登録する */
export async function createMaterial(form: FormData) {
  const me = await requireProfile();
  const back = backPath(form, me.role === "child" ? "/child/materials" : "/parent");
  const childId = me.role === "child" ? me.id : (await requireChildOfFamily(me, str(form, "child_id"))).id;
  const name = str(form, "name");
  const subjectId = str(form, "subject_id") || null;
  const totalPages = int(form, "total_pages");
  if (!name) fail(back, "教材の名前を入力してください");
  if (!isNonNegInt(totalPages) || totalPages < 1) fail(back, "総ページ数は1以上で入力してください");

  const admin = createAdminClient();
  if (subjectId) {
    const { data } = await admin.from("subjects").select("id").eq("id", subjectId).eq("family_id", me.family_id).maybeSingle();
    if (!data) fail(back, "科目が見つかりません");
  }
  const { error } = await admin.from("materials").insert({ child_id: childId, subject_id: subjectId, name, total_pages: totalPages });
  if (error) throw error;
  done(back, `「${name}」を登録しました`);
}

/** 1周完了した教材の2周目を始める */
export async function startNextLap(form: FormData) {
  const me = await requireChild();
  const back = "/child/materials";
  const admin = createAdminClient();
  const { data } = await admin
    .from("materials")
    .select("id, laps, current_page, total_pages")
    .eq("id", str(form, "material_id"))
    .eq("child_id", me.id)
    .maybeSingle();
  if (!data) fail(back, "教材が見つかりません");
  if (data.current_page < data.total_pages) fail(back, "まだ最終ページまで終わっていません");
  const { error } = await admin.from("materials").update({ current_page: 0 }).eq("id", data.id);
  if (error) throw error;
  done(back, `${(data.laps as number) + 1}周目スタート！`);
}

/** 教材ごとの1周ボーナスを親が設定する */
export async function updateLapPoints(form: FormData) {
  const me = await requireParent();
  const child = await requireChildOfFamily(me, str(form, "child_id"));
  const back = `/parent/children/${child.id}`;
  const lapPoints = int(form, "lap_points");
  if (!isNonNegInt(lapPoints)) fail(back, "ポイントは0以上で入力してください");
  const { error } = await createAdminClient()
    .from("materials")
    .update({ lap_points: lapPoints })
    .eq("id", str(form, "material_id"))
    .eq("child_id", child.id);
  if (error) throw error;
  done(back, "1周ボーナスを更新しました");
}
