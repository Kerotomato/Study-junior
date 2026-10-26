import { LedgerList } from "@/components/LedgerList";
import { StudyLogList } from "@/components/StudyLogList";
import { requireChild } from "@/lib/auth";
import { addDays, todayJst } from "@/lib/dates";
import { childMaterials, familySubjects } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { LedgerEntry, StudyLog } from "@/lib/types";

export default async function HistoryPage() {
  const me = await requireChild();
  const supabase = await createClient();
  const [subjects, materials, { data: logs }, { data: ledger }] = await Promise.all([
    familySubjects(supabase, me.family_id),
    childMaterials(supabase, me.id),
    supabase
      .from("study_logs")
      .select("*")
      .eq("child_id", me.id)
      .gte("study_date", addDays(todayJst(), -60))
      .order("study_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("point_ledger").select("*").eq("child_id", me.id).order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <>
      <section className="card mb-4">
        <h2 className="h2">勉強の記録（60日分）</h2>
        <StudyLogList logs={(logs ?? []) as StudyLog[]} subjects={subjects} materials={materials} />
      </section>
      <section className="card">
        <h2 className="h2">ポイントの動き</h2>
        <LedgerList entries={(ledger ?? []) as LedgerEntry[]} />
      </section>
    </>
  );
}
