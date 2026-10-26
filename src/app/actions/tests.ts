"use server";

import { addLedger, notify } from "@/lib/awards";
import { requireChild, requireChildOfFamily, requireParent } from "@/lib/auth";
import { done, fail, int, isNonNegInt, str } from "@/lib/flash";
import { meetsTestGoal } from "@/lib/points";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TestGoal } from "@/lib/types";

/** 本人がテスト結果を入力し、目標を満たせば自動でポイントを付与する */
export async function submitTestResult(form: FormData) {
  const me = await requireChild();
  const back = "/child/tests";
  const admin = createAdminClient();
  const { data } = await admin.from("test_goals").select("*").eq("id", str(form, "goal_id")).eq("child_id", me.id).maybeSingle();
  if (!data) fail(back, "目標が見つかりません");
  const goal = data as TestGoal;
  if (goal.achieved_at) fail(back, "この目標はもう達成しています");

  const score = int(form, "score");
  if (goal.condition_type === "min_score" && !isNonNegInt(score)) fail(back, "点数を入力してください");
  const result = { score: goal.condition_type === "min_score" ? score : null, passed: false };
  result.passed = goal.condition_type === "min_score" ? meetsTestGoal(goal, result) : str(form, "passed") === "yes";

  const { error } = await admin.from("test_results").insert({ child_id: me.id, goal_id: goal.id, ...result });
  if (error) throw error;
  if (!result.passed) done(back, "結果を記録しました。次はがんばろう！");

  const { data: achieved } = await admin
    .from("test_goals")
    .update({ achieved_at: new Date().toISOString() })
    .eq("id", goal.id)
    .is("achieved_at", null)
    .select("id");
  if (achieved?.length && goal.points > 0) {
    const added = await addLedger(admin, { child_id: me.id, amount: goal.points, kind: "test", ref_id: goal.id, note: goal.name });
    if (added) await notify(admin, me.id, "bonus", `「${goal.name}」達成！ +${goal.points}pt`);
  }
  done(back, `目標達成！ +${goal.points}pt`);
}

/** 親がテスト目標を登録する（例：80点以上、英検合格） */
export async function createTestGoal(form: FormData) {
  const me = await requireParent();
  const back = "/parent/rules";
  const child = await requireChildOfFamily(me, str(form, "child_id"));
  const name = str(form, "name");
  const conditionType = str(form, "condition_type") === "pass" ? "pass" : "min_score";
  const minScore = int(form, "min_score");
  const points = int(form, "points");
  if (!name) fail(back, "目標の名前を入力してください");
  if (conditionType === "min_score" && !isNonNegInt(minScore)) fail(back, "目標の点数を入力してください");
  if (!isNonNegInt(points)) fail(back, "ポイントは0以上で入力してください");

  const { error } = await createAdminClient().from("test_goals").insert({
    child_id: child.id,
    name,
    condition_type: conditionType,
    min_score: conditionType === "min_score" ? minScore : null,
    points,
  });
  if (error) throw error;
  done(back, "テスト目標を追加しました");
}

/** 未達成のテスト目標を取り下げる */
export async function deleteTestGoal(form: FormData) {
  const me = await requireParent();
  const back = "/parent/rules";
  const admin = createAdminClient();
  const { data } = await admin.from("test_goals").select("child_id").eq("id", str(form, "goal_id")).maybeSingle();
  if (!data) fail(back, "目標が見つかりません");
  await requireChildOfFamily(me, data.child_id as string);
  const { error } = await admin.from("test_goals").delete().eq("id", str(form, "goal_id")).is("achieved_at", null);
  if (error) throw error;
  done(back, "テスト目標を取り下げました");
}
