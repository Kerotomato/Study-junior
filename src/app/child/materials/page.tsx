import { startNextLap } from "@/app/actions/materials";
import { Flash, type SearchParams } from "@/components/Flash";
import { MaterialForm } from "@/components/MaterialForm";
import { ProgressBar } from "@/components/ProgressBar";
import { requireChild } from "@/lib/auth";
import { formatPoints } from "@/lib/format";
import { childMaterials, familySubjects } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function MaterialsPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireChild();
  const supabase = await createClient();
  const [subjects, materials] = await Promise.all([familySubjects(supabase, me.family_id), childMaterials(supabase, me.id)]);
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card mb-4 space-y-4">
        <h2 className="h2">教材と進捗</h2>
        {materials.length === 0 && <p className="text-sm text-stone-500">まだ教材がありません</p>}
        {materials.map((m) => (
          <div key={m.id} className="space-y-1">
            <ProgressBar material={m} />
            <p className="flex items-center justify-between text-xs text-stone-500">
              <span>
                {(m.subject_id && subjectName.get(m.subject_id)) || "科目なし"}・1周で +{formatPoints(m.lap_points)}
              </span>
              {m.current_page >= m.total_pages && (
                <form action={startNextLap}>
                  <input type="hidden" name="material_id" value={m.id} />
                  <button className="btn-sub">{m.laps + 1}周目を始める</button>
                </form>
              )}
            </p>
          </div>
        ))}
      </section>
      <section className="card">
        <h2 className="h2">教材を登録</h2>
        <MaterialForm subjects={subjects} back="/child/materials" />
      </section>
    </>
  );
}
