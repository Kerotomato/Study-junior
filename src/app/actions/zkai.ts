"use server";

import { addLedger, notify } from "@/lib/awards";
import { requireChild, requireChildOfFamily, requireParent } from "@/lib/auth";
import { todayJst, zkaiMonthLabel } from "@/lib/dates";
import { done, fail, int, isNonNegInt, str } from "@/lib/flash";
import { formatPoints } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ZkaiCheck, ZkaiItem } from "@/lib/types";
import { ZKAI_GRADES, ZKAI_POINT_STEP, ZKAI_SUBJECTS, type ZkaiSubject, isZkaiSubject, yearStartOfGrade, zkaiYearStart } from "@/lib/zkai";
import { childCurrentGrade, zkaiPointsForFamily } from "@/lib/zkaiData";

/**
 * 子どもがマスのチェックを付け外しする。どの学年・どの月のマスもいつでもチェックできる。
 * 付けると設定されたポイントを獲得し、外すとそのとき獲得したポイントを取り消す。
 * マスは6教科（subject）か、親が追加した教材（item_id）のどちらか。
 */
export async function toggleZkaiCheck(form: FormData) {
  const me = await requireChild();
  const grade = int(form, "grade");
  const month = int(form, "month");
  const subject = str(form, "subject") || null;
  const itemId = str(form, "item_id") || null;
  const back = `/child/zkai?grade=${grade}`;
  if (grade === null || !(ZKAI_GRADES as readonly number[]).includes(grade)) fail("/child/zkai", "学年が正しくありません");
  if (month === null || month < 1 || month > 12) fail(back, "月が正しくありません");
  if ((subject === null) === (itemId === null)) fail(back, "教科か教材を選んでください");
  if (subject !== null && !isZkaiSubject(subject)) fail(back, "教科が正しくありません");

  const admin = createAdminClient();
  let rowLabel: string;
  let points: number;
  if (itemId) {
    const { data: item } = await admin
      .from("zkai_items")
      .select("*")
      .eq("id", itemId)
      .eq("child_id", me.id)
      .maybeSingle();
    if (!item) fail(back, "教材が見つかりません");
    rowLabel = (item as ZkaiItem).name;
    points = (item as ZkaiItem).points;
  } else {
    rowLabel = subject!;
    points = (await zkaiPointsForFamily(admin, me.family_id))[subject as ZkaiSubject];
  }
  const label = `${grade}年 ${zkaiMonthLabel(month)} ${rowLabel}`;

  let query = admin.from("zkai_checks").select("*").eq("child_id", me.id).eq("grade", grade).eq("month", month).is("revoked_at", null);
  query = itemId ? query.eq("item_id", itemId) : query.eq("subject", subject!);
  const { data: active } = await query.maybeSingle();

  if (active) {
    // チェックを外す：付けたときのポイントを取り消す。2回押されても取り消しは1回だけ
    const check = active as ZkaiCheck;
    const { data: removed, error } = await admin
      .from("zkai_checks")
      .update({ revoked_at: new Date().toISOString(), revoked_by: me.id })
      .eq("id", check.id)
      .is("revoked_at", null)
      .select("id");
    if (error) throw error;
    if (removed?.length && check.points > 0) {
      await addLedger(admin, { child_id: me.id, amount: -check.points, kind: "zkai", ref_id: `${check.id}:revoke`, note: `${label} チェックを外した` });
    }
    done(back, `${label}のチェックを外しました（-${formatPoints(check.points)}）`);
  }

  // チェックを付ける。学年が未設定なら、選んだ学年を今年度の学年として記録する
  const today = todayJst();
  const current = await childCurrentGrade(admin, me.id, today);
  const yearStart = current === null ? zkaiYearStart(today) : yearStartOfGrade(grade, current, today);
  // 同じマスの有効なチェックは一意インデックスで1つだけ
  const { data: created, error } = await admin
    .from("zkai_checks")
    .insert({ child_id: me.id, grade, year_start: yearStart, month, subject, item_id: itemId, points })
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") done(back, `${label}はもうチェック済みです`);
  if (error || !created) throw error ?? new Error("insert failed");
  if (points > 0) {
    await addLedger(admin, { child_id: me.id, amount: points, kind: "zkai", ref_id: created.id, note: label });
  }
  done(back, `${label} ✅（+${formatPoints(points)}）`);
}

/** 親がチェックを取り消す。理由は必須で、ポイントを取り消して本人に通知する（手入力記録の却下と同じ扱い） */
export async function revokeZkaiCheck(form: FormData) {
  const me = await requireParent();
  const admin = createAdminClient();
  const { data } = await admin.from("zkai_checks").select("*").eq("id", str(form, "check_id")).maybeSingle();
  if (!data) fail("/parent/zkai", "チェックが見つかりません");
  const check = data as ZkaiCheck;
  const child = await requireChildOfFamily(me, check.child_id);
  const back = `/parent/zkai?child=${child.id}&grade=${check.grade}`;
  const reason = str(form, "reason");
  if (!reason) fail(back, "取り消しの理由を入力してください");

  const { data: removed, error } = await admin
    .from("zkai_checks")
    .update({ revoked_at: new Date().toISOString(), revoked_by: me.id, revoke_reason: reason })
    .eq("id", check.id)
    .is("revoked_at", null)
    .select("id");
  if (error) throw error;
  if (!removed?.length) fail(back, "このチェックはすでに外されています");

  let rowLabel = check.subject ?? "";
  if (check.item_id) {
    const { data: item } = await admin.from("zkai_items").select("name").eq("id", check.item_id).maybeSingle();
    rowLabel = (item?.name as string | undefined) ?? "教材";
  }
  const label = `${check.grade}年 ${zkaiMonthLabel(check.month)} ${rowLabel}`;
  if (check.points > 0) {
    await addLedger(admin, { child_id: child.id, amount: -check.points, kind: "zkai", ref_id: `${check.id}:revoke`, note: `${label} 取り消し：${reason}` });
  }
  await notify(admin, child.id, "zkai_revoked", `Z会 ${label}のチェックが取り消され、${check.points}ptが取り消されました。理由：${reason}`);
  done(back, `${child.name}さんの${label}のチェックを取り消しました`);
}

/** 親が教科ごとの1回分のポイントを設定する（子どもは変更できない） */
export async function updateZkaiPoints(form: FormData) {
  const me = await requireParent();
  const back = "/parent/rules";
  const rows = ZKAI_SUBJECTS.map((subject) => ({ family_id: me.family_id, subject, points: int(form, `zkai_${subject}`) }));
  if (!rows.every((r) => isNonNegInt(r.points) && r.points % ZKAI_POINT_STEP === 0)) {
    fail(back, `Z会のポイントは0以上で、${ZKAI_POINT_STEP}pt単位で入力してください`);
  }
  const { error } = await createAdminClient().from("zkai_point_rules").upsert(rows, { onConflict: "family_id,subject" });
  if (error) throw error;
  done(back, "Z会のポイントを保存しました（これから付けるチェックから反映されます）");
}

/** 親が子どもの今の学年を設定する。毎年3月に自動で1つ上がる */
export async function setChildGrade(form: FormData) {
  const me = await requireParent();
  const child = await requireChildOfFamily(me, str(form, "child_id"));
  const back = "/parent/family";
  const grade = int(form, "grade");
  if (grade === null || !(ZKAI_GRADES as readonly number[]).includes(grade)) fail(back, "学年を選んでください");
  const { error } = await createAdminClient()
    .from("users")
    .update({ grade, grade_year_start: zkaiYearStart(todayJst()) })
    .eq("id", child.id);
  if (error) throw error;
  done(back, `${child.name}さんの学年を${grade}年にしました`);
}

function validItemPoints(points: number | null): points is number {
  return isNonNegInt(points) && points % ZKAI_POINT_STEP === 0;
}

/** 親が子どもの Z会チェックリストに教材の行を追加する（例：プラス 数学） */
export async function addZkaiItem(form: FormData) {
  const me = await requireParent();
  const child = await requireChildOfFamily(me, str(form, "child_id"));
  const back = `/parent/zkai?child=${child.id}`;
  const name = str(form, "name");
  const points = int(form, "points");
  if (!name) fail(back, "教材の名前を入力してください");
  if (name.length > 30) fail(back, "教材の名前は30文字までです");
  if (!validItemPoints(points)) fail(back, `ポイントは0以上で、${ZKAI_POINT_STEP}pt単位で入力してください`);
  const { error } = await createAdminClient().from("zkai_items").insert({ child_id: child.id, name, points });
  if (error) throw error;
  done(back, `「${name}」をチェックリストに追加しました`);
}

/** 追加した教材の1回分のポイントを変える（これから付けるチェックから反映） */
export async function updateZkaiItemPoints(form: FormData) {
  const me = await requireParent();
  const admin = createAdminClient();
  const { data } = await admin.from("zkai_items").select("*").eq("id", str(form, "item_id")).maybeSingle();
  if (!data) fail("/parent/zkai", "教材が見つかりません");
  const item = data as ZkaiItem;
  const child = await requireChildOfFamily(me, item.child_id);
  const back = `/parent/zkai?child=${child.id}`;
  const points = int(form, "points");
  if (!validItemPoints(points)) fail(back, `ポイントは0以上で、${ZKAI_POINT_STEP}pt単位で入力してください`);
  const { error } = await admin.from("zkai_items").update({ points }).eq("id", item.id);
  if (error) throw error;
  done(back, `「${item.name}」のポイントを${formatPoints(points)}にしました`);
}

/** 追加した教材を表から外す。付け済みのチェックとポイントは残る */
export async function archiveZkaiItem(form: FormData) {
  const me = await requireParent();
  const admin = createAdminClient();
  const { data } = await admin.from("zkai_items").select("*").eq("id", str(form, "item_id")).maybeSingle();
  if (!data) fail("/parent/zkai", "教材が見つかりません");
  const item = data as ZkaiItem;
  const child = await requireChildOfFamily(me, item.child_id);
  const { error } = await admin
    .from("zkai_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", item.id)
    .is("archived_at", null);
  if (error) throw error;
  done(`/parent/zkai?child=${child.id}`, `「${item.name}」を表から外しました（付けたチェックのポイントはそのまま）`);
}
