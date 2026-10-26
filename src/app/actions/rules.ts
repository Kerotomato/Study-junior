"use server";

import { requireParent } from "@/lib/auth";
import { done, fail, int, isNonNegInt } from "@/lib/flash";
import { createAdminClient } from "@/lib/supabase/admin";

/** レート・ボーナスの設定を更新する（1pt＝1円固定） */
export async function updateRules(form: FormData) {
  const me = await requireParent();
  const back = "/parent/rules";
  const values = {
    weekday_rate: int(form, "weekday_rate"),
    holiday_rate: int(form, "holiday_rate"),
    streak_days: int(form, "streak_days"),
    streak_points: int(form, "streak_points"),
    weekly_points: int(form, "weekly_points"),
  };
  const weeklyHours = int(form, "weekly_hours");
  if (!Object.values(values).every(isNonNegInt) || !isNonNegInt(weeklyHours)) fail(back, "すべて0以上の整数で入力してください");
  if (values.streak_days! < 1) fail(back, "連続日数は1日以上にしてください");
  if (weeklyHours < 1) fail(back, "週の目標は1時間以上にしてください");

  const { error } = await createAdminClient()
    .from("rules")
    .update({ ...values, weekly_minutes: weeklyHours * 60, updated_at: new Date().toISOString() })
    .eq("family_id", me.family_id);
  if (error) throw error;
  done(back, "ルールを保存しました");
}
