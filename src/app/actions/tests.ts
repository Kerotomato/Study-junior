"use server";

import { addLedger, getRules, notify } from "@/lib/awards";
import { requireChild, requireChildOfFamily, requireProfile } from "@/lib/auth";
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

/**
 * 子どもがテスト目標を作る（例：80点以上、英検合格）。
 * 達成ポイントは子どもが決めず、親がルールで決めた額を作成時に目標へ記録する。
 */
export async function createTestGoal(form: FormData) {
  const me = await requireChild();
  const back = "/child/tests";
  const name = str(form, "name");
  const conditionType = str(form, "condition_type") === "pass" ? "pass" : "min_score";
  const minScore = int(form, "min_score");
  if (!name) fail(back, "目標の名前を入力してください");
  if (conditionType === "min_score" && !isNonNegInt(minScore)) fail(back, "目標の点数を入力してください");

  const admin = createAdminClient();
  const rules = await getRules(admin, me.family_id);
  const { error } = await admin.from("test_goals").insert({
    child_id: me.id,
    name,
    condition_type: conditionType,
    min_score: conditionType === "min_score" ? minScore : null,
    points: rules.test_points,
    created_by: me.id,
  });
  if (error) throw error;
  done(back, "テスト目標を追加しました");
}

/** 未達成のテスト目標を取り下げる（本人、または同じ家族の親） */
export async function deleteTestGoal(form: FormData) {
  const me = await requireProfile();
  const admin = createAdminClient();
  const { data } = await admin.from("test_goals").select("child_id").eq("id", str(form, "goal_id")).maybeSingle();
  const back = me.role === "child" ? "/child/tests" : `/parent/children/${data?.child_id ?? ""}`;
  if (!data) fail(me.role === "child" ? back : "/parent", "目標が見つかりません");
  if (me.role === "child") {
    if (data.child_id !== me.id) fail(back, "目標が見つかりません");
  } else {
    await requireChildOfFamily(me, data.child_id as string);
  }
  const { data: deleted, error } = await admin
    .from("test_goals")
    .delete()
    .eq("id", str(form, "goal_id"))
    .is("achieved_at", null)
    .select("id");
  if (error) throw error;
  if (!deleted?.length) fail(back, "達成済みの目標は取り下げられません");
  done(back, "テスト目標を取り下げました");
}
