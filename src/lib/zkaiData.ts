import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayJst } from "./dates";
import type { UserClient } from "./supabase/server";
import type { ChildGrade, ZkaiCheck, ZkaiItem } from "./types";
import { ZKAI_DEFAULT_POINTS, ZKAI_SUBJECTS, currentZkaiGrade, type ZkaiSubject } from "./zkai";

export async function childGrade(client: SupabaseClient, childId: string): Promise<ChildGrade> {
  const { data, error } = await client.from("users").select("id, grade, grade_year_start").eq("id", childId).maybeSingle();
  if (error) throw error;
  return (data as ChildGrade | null) ?? { id: childId, grade: null, grade_year_start: null };
}

/** いまの学年（未設定なら null）。表の学年は1〜3年 */
export async function childCurrentGrade(client: SupabaseClient, childId: string, today = todayJst()): Promise<number | null> {
  const g = await childGrade(client, childId);
  return currentZkaiGrade(g.grade, g.grade_year_start, today);
}

/** 子どものZ会チェック（取り消し済みも含む。新しい順） */
export async function zkaiChecks(client: SupabaseClient, childId: string): Promise<ZkaiCheck[]> {
  const { data, error } = await client
    .from("zkai_checks")
    .select("*")
    .eq("child_id", childId)
    .order("checked_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ZkaiCheck[];
}

function toZkaiPoints(rows: { subject: string; points: number }[]): Record<ZkaiSubject, number> {
  const points = { ...ZKAI_DEFAULT_POINTS };
  for (const row of rows) {
    if ((ZKAI_SUBJECTS as readonly string[]).includes(row.subject)) points[row.subject as ZkaiSubject] = row.points;
  }
  return points;
}

/** 教科ごとの1回分のポイント（画面用）。RLS で自分の家族の分だけが返る。未設定の教科は初期値 */
export async function zkaiPoints(client: UserClient): Promise<Record<ZkaiSubject, number>> {
  const { data, error } = await client.from("zkai_point_rules").select("subject, points");
  if (error) throw error;
  return toZkaiPoints(data ?? []);
}

/** 教科ごとの1回分のポイント（サーバーアクション用。RLS を通らないので家族で絞る） */
export async function zkaiPointsForFamily(admin: SupabaseClient, familyId: string): Promise<Record<ZkaiSubject, number>> {
  const { data, error } = await admin.from("zkai_point_rules").select("subject, points").eq("family_id", familyId);
  if (error) throw error;
  return toZkaiPoints(data ?? []);
}

/** 親が追加した教材（表から外したものも含む。登録順） */
export async function zkaiItems(client: SupabaseClient, childId: string): Promise<ZkaiItem[]> {
  const { data, error } = await client.from("zkai_items").select("*").eq("child_id", childId).order("created_at");
  if (error) throw error;
  return (data ?? []) as ZkaiItem[];
}
