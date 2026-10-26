"use server";

import { advanceMaterial, addLedger, checkStudyBonuses, getRules, notify } from "@/lib/awards";
import { requireChild, requireChildOfFamily, requireParent } from "@/lib/auth";
import { isValidDate, toJstDate, todayJst } from "@/lib/dates";
import { done, fail, int, isNonNegInt, str } from "@/lib/flash";
import { formatHours } from "@/lib/format";
import { MAX_DAILY_MINUTES, fitsDailyLimit, studyPoints } from "@/lib/points";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StudyLog } from "@/lib/types";

/** 勉強記録を保存し、その場でポイントを加算する（親の承認は不要） */
export async function saveStudyLog(form: FormData) {
  const me = await requireChild();
  const back = "/child/record";
  const method = str(form, "method") === "timer" ? "timer" : "manual";
  const minutes = int(form, "minutes");
  const subjectId = str(form, "subject_id");
  const materialId = str(form, "material_id") || null;
  const pagesTo = int(form, "pages_to");

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

  const admin = createAdminClient();
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

  const { data: sameDay, error: sameDayError } = await admin
    .from("study_logs")
    .select("minutes")
    .eq("child_id", me.id)
    .eq("study_date", date)
    .is("deleted_at", null);
  if (sameDayError) throw sameDayError;
  const existing = (sameDay ?? []).reduce((s, r) => s + (r.minutes as number), 0);
  if (!fitsDailyLimit(existing, minutes)) {
    fail(back, `1日の記録は${formatHours(MAX_DAILY_MINUTES)}までです（この日はあと${formatHours(Math.max(0, MAX_DAILY_MINUTES - existing))}）`);
  }

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
    })
    .select("id")
    .single();
  if (error || !log) throw error ?? new Error("insert failed");

  await addLedger(admin, { child_id: me.id, amount: points, kind: "study", ref_id: log.id, note: `${formatHours(minutes)}` });
  if (materialId && pagesTo !== null) await advanceMaterial(admin, me.id, materialId, pagesTo);
  await checkStudyBonuses(admin, me.id, date, rules);

  done(back, `${formatHours(minutes)}を記録しました（+${points}pt）`);
}

/** 親が不審な記録を削除する。理由は必須、ポイントは取り消して本人に通知する */
export async function deleteStudyLog(form: FormData) {
  const me = await requireParent();
  const logId = str(form, "log_id");
  const reason = str(form, "reason");
  const admin = createAdminClient();

  const { data } = await admin.from("study_logs").select("*").eq("id", logId).maybeSingle();
  if (!data) fail("/parent", "記録が見つかりません");
  const log = data as StudyLog;
  const child = await requireChildOfFamily(me, log.child_id);
  const back = `/parent/children/${child.id}`;
  if (!reason) fail(back, "削除の理由を入力してください");

  // 物理削除せず「削除済み」として残す。同時に2回押されても1回だけ処理する
  const { data: updated, error } = await admin
    .from("study_logs")
    .update({ deleted_at: new Date().toISOString(), delete_reason: reason, deleted_by: me.id })
    .eq("id", log.id)
    .is("deleted_at", null)
    .select("id");
  if (error) throw error;
  if (!updated?.length) fail(back, "この記録はすでに削除されています");

  if (log.points > 0) {
    await addLedger(admin, { child_id: child.id, amount: -log.points, kind: "revoke", ref_id: log.id, note: reason });
  }
  await notify(
    admin,
    child.id,
    "log_deleted",
    `${log.study_date} の記録（${formatHours(log.minutes)}）が削除され、${log.points}ptが取り消されました。理由：${reason}`,
  );
  done(back, "記録を削除しました");
}
