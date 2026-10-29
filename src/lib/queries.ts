import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, jstMidnightIso, monthStart, todayJst, weekEnd, weekStart } from "./dates";
import type { UserClient } from "./supabase/server";
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

type SummaryLedgerRow = Pick<LedgerEntry, "amount" | "kind" | "created_at"> & { child_id: string };
type SummaryLogRow = { child_id: string; study_date: string; minutes: number };

function summarize(
  balance: number,
  monthLedger: SummaryLedgerRow[],
  logs: SummaryLogRow[],
  today: string,
): ChildSummary {
  const ws = weekStart(today);
  const we = weekEnd(today);
  return {
    balance,
    monthPoints: monthLedger.filter((e) => e.kind !== "exchange").reduce((s, e) => s + e.amount, 0),
    streak: currentStreak(
      logs.map((r) => r.study_date),
      today,
    ),
    todayMinutes: logs.filter((r) => r.study_date === today).reduce((s, r) => s + r.minutes, 0),
    weekMinutes: logs.filter((r) => r.study_date >= ws && r.study_date <= we).reduce((s, r) => s + r.minutes, 0),
  };
}

/**
 * 子どもの集計（残高・今月のポイント・連続日数・今日／今週の勉強時間）。
 * 残高は集計ビュー（point_balances）で DB 側で合計し、台帳は今月の分だけ読む。
 * childId が null なら RLS で見られる子ども全員分（親の一覧用）。
 */
async function loadSummaries(client: SupabaseClient, childId: string | null): Promise<Map<string, ChildSummary>> {
  const today = todayJst();
  let balancesQ = client.from("point_balances").select("child_id, balance");
  let ledgerQ = client
    .from("point_ledger")
    .select("child_id, amount, kind, created_at")
    .gte("created_at", jstMidnightIso(monthStart(today)));
  let logsQ = client
    .from("study_logs")
    .select("child_id, study_date, minutes")
    .is("deleted_at", null)
    .gte("study_date", addDays(today, -400));
  if (childId) {
    balancesQ = balancesQ.eq("child_id", childId);
    ledgerQ = ledgerQ.eq("child_id", childId);
    logsQ = logsQ.eq("child_id", childId);
  }
  const [balances, ledger, logs] = await Promise.all([balancesQ, ledgerQ, logsQ]);
  if (balances.error) throw balances.error;
  if (ledger.error) throw ledger.error;
  if (logs.error) throw logs.error;

  const ids = new Set<string>(childId ? [childId] : []);
  for (const r of [...(balances.data ?? []), ...(ledger.data ?? []), ...(logs.data ?? [])]) ids.add(r.child_id as string);
  const result = new Map<string, ChildSummary>();
  for (const id of ids) {
    const balance = (balances.data ?? []).find((b) => b.child_id === id)?.balance ?? 0;
    result.set(
      id,
      summarize(
        balance as number,
        ((ledger.data ?? []) as SummaryLedgerRow[]).filter((r) => r.child_id === id),
        ((logs.data ?? []) as SummaryLogRow[]).filter((r) => r.child_id === id),
        today,
      ),
    );
  }
  return result;
}

export const EMPTY_SUMMARY: ChildSummary = { balance: 0, monthPoints: 0, streak: 0, todayMinutes: 0, weekMinutes: 0 };

export async function childSummary(client: SupabaseClient, childId: string): Promise<ChildSummary> {
  return (await loadSummaries(client, childId)).get(childId) ?? EMPTY_SUMMARY;
}

/** RLS で見られる子ども全員分の集計を、子どもの人数に関係なく3回の問い合わせで取る（親の一覧用） */
export async function visibleChildSummaries(client: UserClient): Promise<Map<string, ChildSummary>> {
  return loadSummaries(client, null);
}

/** 家族のルール。RLS で自分の家族の1行だけが返る */
export async function familyRules(client: UserClient): Promise<Rules> {
  const { data, error } = await client.from("rules").select("*").single();
  if (error) throw error;
  return data as Rules;
}

/** 家族の科目。RLS で自分の家族の分だけが返る */
export async function familySubjects(client: UserClient): Promise<Subject[]> {
  const { data, error } = await client.from("subjects").select("*").order("created_at");
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
