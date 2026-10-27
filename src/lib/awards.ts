import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { weekEnd, weekStart } from "./dates";
import { formatHours } from "./format";
import { applyPages, streakMilestones } from "./points";
import type { LedgerKind, Material, Notification, Rules } from "./types";

/**
 * 台帳に1行追加する。(child_id, kind, ref_id) が既にあれば何もしない。
 * 追加できたら true（同じボーナスの二重付与を防ぐ）。
 */
export async function addLedger(
  admin: SupabaseClient,
  entry: { child_id: string; amount: number; kind: LedgerKind; ref_id: string; note?: string },
): Promise<boolean> {
  const { data, error } = await admin
    .from("point_ledger")
    .upsert({ ...entry, note: entry.note ?? null }, { onConflict: "child_id,kind,ref_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function notify(admin: SupabaseClient, userId: string, type: Notification["type"], message: string) {
  const { error } = await admin.from("notifications").insert({ user_id: userId, type, message });
  if (error) throw error;
}

/** 家族の親全員に通知する（exceptId の親は除く） */
export async function notifyParents(
  admin: SupabaseClient,
  familyId: string,
  type: Notification["type"],
  message: string,
  exceptId?: string,
) {
  const { data, error } = await admin.from("users").select("id").eq("family_id", familyId).eq("role", "parent");
  if (error) throw error;
  const rows = (data ?? []).filter((p) => p.id !== exceptId).map((p) => ({ user_id: p.id, type, message }));
  if (rows.length === 0) return;
  const { error: insertError } = await admin.from("notifications").insert(rows);
  if (insertError) throw insertError;
}

export async function getRules(admin: SupabaseClient, familyId: string): Promise<Rules> {
  const { data, error } = await admin.from("rules").select("*").eq("family_id", familyId).single();
  if (error) throw error;
  return data as Rules;
}

export async function balanceOf(client: SupabaseClient, childId: string): Promise<number> {
  const { data, error } = await client.from("point_ledger").select("amount").eq("child_id", childId);
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + (r.amount as number), 0);
}

/** 完了していない交換の請求を差し引いた、まだ請求できるポイント */
export async function availablePoints(client: SupabaseClient, childId: string): Promise<number> {
  const balance = await balanceOf(client, childId);
  const { data, error } = await client.from("exchange_requests").select("points").eq("child_id", childId).eq("status", "pending");
  if (error) throw error;
  return balance - (data ?? []).reduce((s, r) => s + (r.points as number), 0);
}

/** 記録が増えた日について、連続記録ボーナスと週の目標達成ボーナスを判定する */
export async function checkStudyBonuses(admin: SupabaseClient, childId: string, date: string, rules: Rules) {
  const { data: logs, error } = await admin
    .from("study_logs")
    .select("study_date, minutes")
    .eq("child_id", childId)
    .is("deleted_at", null);
  if (error) throw error;
  const rows = (logs ?? []) as { study_date: string; minutes: number }[];

  if (rules.streak_points > 0) {
    for (const day of streakMilestones(rows.map((r) => r.study_date), date, rules.streak_days)) {
      const added = await addLedger(admin, {
        child_id: childId,
        amount: rules.streak_points,
        kind: "streak",
        ref_id: day,
        note: `${rules.streak_days}日連続記録`,
      });
      if (added) {
        await notify(admin, childId, "bonus", `${rules.streak_days}日連続で記録しました！ +${rules.streak_points}pt`);
      }
    }
  }

  const start = weekStart(date);
  const end = weekEnd(date);
  const weekMinutes = rows
    .filter((r) => r.study_date >= start && r.study_date <= end)
    .reduce((sum, r) => sum + r.minutes, 0);
  if (rules.weekly_points > 0 && weekMinutes >= rules.weekly_minutes) {
    const added = await addLedger(admin, {
      child_id: childId,
      amount: rules.weekly_points,
      kind: "weekly",
      ref_id: start,
      note: `週${formatHours(rules.weekly_minutes)}達成`,
    });
    if (added) {
      await notify(admin, childId, "bonus", `今週の目標（${formatHours(rules.weekly_minutes)}）を達成！ +${rules.weekly_points}pt`);
    }
  }
}

/** 教材のページ進捗を更新し、最終ページに到達したら1周ボーナスを付与する */
export async function advanceMaterial(admin: SupabaseClient, childId: string, materialId: string, pagesTo: number) {
  const { data, error } = await admin
    .from("materials")
    .select("*")
    .eq("id", materialId)
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  const material = data as Material;
  const progress = applyPages(material, pagesTo);
  if (progress.currentPage === material.current_page) return;

  const laps = progress.completedLap ? material.laps + 1 : material.laps;
  const { error: updateError } = await admin
    .from("materials")
    .update({ current_page: progress.currentPage, laps })
    .eq("id", material.id);
  if (updateError) throw updateError;

  if (progress.completedLap && material.lap_points > 0) {
    const added = await addLedger(admin, {
      child_id: childId,
      amount: material.lap_points,
      kind: "lap",
      ref_id: `${material.id}:${laps}`,
      note: `${material.name} ${laps}周目完了`,
    });
    if (added) {
      await notify(admin, childId, "bonus", `「${material.name}」を${laps}周終えました！ +${material.lap_points}pt`);
    }
  }
}
