import { Flash, type SearchParams } from "@/components/Flash";
import { StudyLogList } from "@/components/StudyLogList";
import { requireChild } from "@/lib/auth";
import { addDays, todayJst } from "@/lib/dates";
import { childMaterials, familySubjects } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { StudyLog } from "@/lib/types";

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireChild();
  const supabase = await createClient();
  const [subjects, materials, { data: logs }] = await Promise.all([
    familySubjects(supabase, me.family_id),
    childMaterials(supabase, me.id),
    supabase
      .from("study_logs")
      .select("*")
      .eq("child_id", me.id)
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
