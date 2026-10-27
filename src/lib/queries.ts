import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, jstMidnightIso, monthStart, todayJst, weekEnd, weekStart } from "./dates";
import { currentStreak } from "./points";
import type { LedgerEntry, Material, Notification, Rules, Subject } from "./types";

export interface ChildSummary {
  balance: number;
  /** 今月増えたポイント（交換での消費は含めない） */
  monthPoints: number;
  streak: number;
  todayMinutes: number;
  weekMinutes: number;
}

export async function childSummary(client: SupabaseClient, childId: string): Promise<ChildSummary> {
  const today = todayJst();
  const [{ data: ledger, error: ledgerError }, { data: logs, error: logsError }] = await Promise.all([
    client.from("point_ledger").select("amount, kind, created_at").eq("child_id", childId),
    client
      .from("study_logs")
      .select("study_date, minutes")
      .eq("child_id", childId)
      .is("deleted_at", null)
      .gte("study_date", addDays(today, -400)),
  ]);
  if (ledgerError) throw ledgerError;
  if (logsError) throw logsError;

  const entries = (ledger ?? []) as Pick<LedgerEntry, "amount" | "kind" | "created_at">[];
  const monthFrom = new Date(jstMidnightIso(monthStart(today))).getTime();
  const rows = (logs ?? []) as { study_date: string; minutes: number }[];
  const ws = weekStart(today);
  const we = weekEnd(today);
  return {
    balance: entries.reduce((s, e) => s + e.amount, 0),
    monthPoints: entries
      .filter((e) => e.kind !== "exchange" && new Date(e.created_at).getTime() >= monthFrom)
      .reduce((s, e) => s + e.amount, 0),
    streak: currentStreak(
      rows.map((r) => r.study_date),
      today,
    ),
    todayMinutes: rows.filter((r) => r.study_date === today).reduce((s, r) => s + r.minutes, 0),
    weekMinutes: rows.filter((r) => r.study_date >= ws && r.study_date <= we).reduce((s, r) => s + r.minutes, 0),
  };
}

export async function familyRules(client: SupabaseClient, familyId: string): Promise<Rules> {
  const { data, error } = await client.from("rules").select("*").eq("family_id", familyId).single();
  if (error) throw error;
  return data as Rules;
}

export async function familySubjects(client: SupabaseClient, familyId: string): Promise<Subject[]> {
  const { data, error } = await client.from("subjects").select("*").eq("family_id", familyId).order("created_at");
  if (error) throw error;
  return (data ?? []) as Subject[];
}

export async function childMaterials(client: SupabaseClient, childId: string): Promise<Material[]> {
  const { data, error } = await client.from("materials").select("*").eq("child_id", childId).order("created_at");
  if (error) throw error;
  return (data ?? []) as Material[];
}

export async function unreadCount(client: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function recentNotifications(client: SupabaseClient, userId: string): Promise<Notification[]> {
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Notification[];
}
