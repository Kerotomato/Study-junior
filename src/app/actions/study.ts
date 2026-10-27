"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { advanceMaterial, addLedger, checkStudyBonuses, getRules, notify } from "@/lib/awards";
import { requireChild, requireChildOfFamily, requireParent } from "@/lib/auth";
import { isValidDate, toJstDate, todayJst } from "@/lib/dates";
import { done, fail, int, isNonNegInt, str } from "@/lib/flash";
import { formatHours } from "@/lib/format";
import { MAX_DAILY_MINUTES, fitsDailyLimit, recalcStudyPoints, studyPoints } from "@/lib/points";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, StudyLog } from "@/lib/types";

const MEMO_MAX = 500;

/** 科目は家族のもの、教材は本人のものか確認する */
async function checkRefs(admin: SupabaseClient, me: Profile, subjectId: string, materialId: string | null, back: string) {
  const { data: subject } = await admin
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("family_id", me.family_id)
    .maybeSingle();
  if (!subject) fail(back, "科目が見つかりません");
  if (materialId) {
    const { data: material } = await admin
      .from("materials")
      .select("id")
      .eq("id", materialId)
      .eq("child_id", me.id)
      .maybeSingle();
    if (!material) fail(back, "教材が見つかりません");
  }
}

/** その日の記録合計（取り消し済みと、編集中の記録自身を除く） */
async function dayMinutes(admin: SupabaseClient, childId: string, date: string, excludeLogId?: string): Promise<number> {
  let query = admin.from("study_logs").select("minutes").eq("child_id", childId).eq("study_date", date).is("deleted_at", null);
  if (excludeLogId) query = query.neq("id", excludeLogId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reduce((s, r) => s + (r.minutes as number), 0);
}

function dailyLimitMessage(existing: number): string {
  return `1日の記録は${formatHours(MAX_DAILY_MINUTES)}までです（この日はあと${formatHours(Math.max(0, MAX_DAILY_MINUTES - existing))}）`;
}

/** 勉強記録を保存し、その場でポイントを加算する（親の承認は不要） */
export async function saveStudyLog(form: FormData) {
  const me = await requireChild();
  const back = "/child/record";
  const method = str(form, "method") === "timer" ? "timer" : "manual";
  const minutes = int(form, "minutes");
  const subjectId = str(form, "subject_id");
  const materialId = str(form, "material_id") || null;
  const pagesTo = int(form, "pages_to");
  const memo = str(form, "memo") || null;

  let date: string;
  let startedAt: string | null = null;
  if (method === "timer") {
    const started = new Date(str(form, "started_at"));
    if (Number.isNaN(started.getTime())) fail(back, "タイマーの開始時刻が不正です");
    startedAt = started.toISOString();
    date = toJstDate(started);
  } else {
    date = str(form, "date");
    if (!isValidDate(date)) fail(back, "日付を入力してください");
  }
  if (date > todayJst()) fail(back, "未来の日付は記録できません");
  if (minutes === null || !Number.isInteger(minutes) || minutes < 1) fail(back, "勉強時間は1分以上で入力してください");
  if (!subjectId) fail(back, "科目を選んでください");
  if (pagesTo !== null && !isNonNegInt(pagesTo)) fail(back, "ページ数は0以上の数字で入力してください");
  if (memo && memo.length > MEMO_MAX) fail(back, `メモは${MEMO_MAX}文字までです`);

  const admin = createAdminClient();
  await checkRefs(admin, me, subjectId, materialId, back);
  const existing = await dayMinutes(admin, me.id, date);
  if (!fitsDailyLimit(existing, minutes)) fail(back, dailyLimitMessage(existing));

  const rules = await getRules(admin, me.family_id);
  const points = studyPoints(minutes, date, rules);
  const { data: log, error } = await admin
    .from("study_logs")
    .insert({
      child_id: me.id,
      subject_id: subjectId,
      material_id: materialId,
      study_date: date,
      started_at: startedAt,
      minutes,
      method,
      pages_to: materialId ? pagesTo : null,
      points,
      memo,
    })
    .select("id")
    .single();
  if (error || !log) throw error ?? new Error("insert failed");

  await addLedger(admin, { child_id: me.id, amount: points, kind: "study", ref_id: log.id, note: `${formatHours(minutes)}` });
  if (materialId && pagesTo !== null) await advanceMaterial(admin, me.id, materialId, pagesTo);
  await checkStudyBonuses(admin, me.id, date, rules);

  done(back, `${formatHours(minutes)}を記録しました（+${points}pt）`);
}

/**
 * 本人が記録を後から編集する（時間・教材・科目・メモ）。
 * 時間を変えたら保存時のレートでポイントを再計算し、差分を台帳に「記録の修正」として残す。
 * タイマー記録の時間を変えた場合は手入力扱いになり、親が却下できるようになる。
 */
export async function updateStudyLog(form: FormData) {
  const me = await requireChild();
  const back = "/child/history";
  const minutes = int(form, "minutes");
  const subjectId = str(form, "subject_id");
  const materialId = str(form, "material_id") || null;
  const pagesTo = int(form, "pages_to");
  const memo = str(form, "memo") || null;
  if (minutes === null || !Number.isInteger(minutes) || minutes < 1) fail(back, "勉強時間は1分以上で入力してください");
  if (!subjectId) fail(back, "科目を選んでください");
  if (pagesTo !== null && !isNonNegInt(pagesTo)) fail(back, "ページ数は0以上の数字で入力してください");
  if (memo && memo.length > MEMO_MAX) fail(back, `メモは${MEMO_MAX}文字までです`);

  const admin = createAdminClient();
  const { data } = await admin.from("study_logs").select("*").eq("id", str(form, "log_id")).eq("child_id", me.id).maybeSingle();
  if (!data) fail(back, "記録が見つかりません");
  const log = data as StudyLog;
  if (log.deleted_at) fail(back, "取り消された記録は編集できません");
  await checkRefs(admin, me, subjectId, materialId, back);

  const minutesChanged = minutes !== log.minutes;
  if (minutesChanged) {
    const existing = await dayMinutes(admin, me.id, log.study_date, log.id);
    if (!fitsDailyLimit(existing, minutes)) fail(back, dailyLimitMessage(existing));
  }
  const points = minutesChanged ? recalcStudyPoints(log, minutes) : log.points;
  const editedAt = new Date().toISOString();

  // 親の削除・却下と同時に起きても、取り消し済みの記録は書き換えない
  const { data: updated, error } = await admin
    .from("study_logs")
    .update({
      minutes,
      subject_id: subjectId,
      material_id: materialId,
      pages_to: materialId ? pagesTo : null,
      memo,
      points,
      method: minutesChanged ? "manual" : log.method,
      edited_at: editedAt,
    })
    .eq("id", log.id)
    .is("deleted_at", null)
    .eq("points", log.points)
    .select("id");
  if (error) throw error;
  if (!updated?.length) fail(back, "記録が変更されています。もう一度やり直してください");

  const diff = points - log.points;
  if (diff !== 0) {
    await addLedger(admin, {
      child_id: me.id,
      amount: diff,
      kind: "adjust",
      ref_id: `${log.id}:${editedAt}`,
      note: `${formatHours(log.minutes)}→${formatHours(minutes)}`,
    });
  }
  if (materialId && pagesTo !== null) await advanceMaterial(admin, me.id, materialId, pagesTo);
  if (minutes > log.minutes) await checkStudyBonuses(admin, me.id, log.study_date, await getRules(admin, me.family_id));

  done(back, diff === 0 ? "記録を編集しました" : `記録を編集しました（${diff > 0 ? "+" : ""}${diff}pt）`);
}

/** 記録を取り消す（削除・却下で共通）。物理削除せず履歴に残し、ポイントを取り消して本人に通知する */
async function removeStudyLog(form: FormData, removedAs: "deleted" | "rejected") {
  const me = await requireParent();
  const reason = str(form, "reason");
  const admin = createAdminClient();

  const { data } = await admin.from("study_logs").select("*").eq("id", str(form, "log_id")).maybeSingle();
  if (!data) fail("/parent", "記録が見つかりません");
  const log = data as StudyLog;
  const child = await requireChildOfFamily(me, log.child_id);
  const back = `/parent/children/${child.id}`;
  const verb = removedAs === "rejected" ? "却下" : "削除";
  if (!reason) fail(back, `${verb}の理由を入力してください`);
  if (removedAs === "rejected" && log.method !== "manual") fail(back, "却下できるのは手入力の記録だけです");

  // 同時に2回押されても、本人の編集と重なっても、取り消すのは最新のポイント1回分だけ
  const { data: updated, error } = await admin
    .from("study_logs")
    .update({ deleted_at: new Date().toISOString(), delete_reason: reason, deleted_by: me.id, removed_as: removedAs })
    .eq("id", log.id)
    .is("deleted_at", null)
    .eq("points", log.points)
    .select("id");
  if (error) throw error;
  if (!updated?.length) fail(back, "この記録はすでに取り消されたか、変更されています");

  if (log.points !== 0) {
    await addLedger(admin, { child_id: child.id, amount: -log.points, kind: "revoke", ref_id: log.id, note: `${verb}：${reason}` });
  }
  await notify(
    admin,
    child.id,
    removedAs === "rejected" ? "log_rejected" : "log_deleted",
    `${log.study_date} の記録（${formatHours(log.minutes)}）が${verb}され、${log.points}ptが取り消されました。理由：${reason}`,
  );
  done(back, `記録を${verb}しました`);
}

/** 親が不審な記録を削除する。理由は必須 */
export async function deleteStudyLog(form: FormData) {
  await removeStudyLog(form, "deleted");
}

/** 親が手入力の記録を却下する。理由は必須 */
export async function rejectStudyLog(form: FormData) {
  await removeStudyLog(form, "rejected");
}
