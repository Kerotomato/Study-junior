import { Flash, type SearchParams } from "@/components/Flash";
import { StudyLogList } from "@/components/StudyLogList";
import { requireChild, requireUserId } from "@/lib/auth";
import { addDays, todayJst } from "@/lib/dates";
import { childMaterials, familySubjects } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { StudyLog } from "@/lib/types";

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const [supabase, userId] = await Promise.all([createClient(), requireUserId()]);
  const [, subjects, materials, { data: logs }] = await Promise.all([
    requireChild(),
    familySubjects(supabase),
    childMaterials(supabase, userId),
    supabase
      .from("study_logs")
      .select("*")
      .eq("child_id", userId)
      .gte("study_date", addDays(todayJst(), -60))
      .order("study_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card">
        <h2 className="h2">勉強の記録（60日分）</h2>
        <p className="mb-3 text-xs text-stone-500">ポイントの動き（獲得・取り消し・交換）は「交換」画面で見られます。</p>
        <StudyLogList logs={(logs ?? []) as StudyLog[]} subjects={subjects} materials={materials} mode="child" />
      </section>
    </>
  );
}
