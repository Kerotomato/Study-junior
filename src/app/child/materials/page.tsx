import { startNextLap } from "@/app/actions/materials";
import { Flash, type SearchParams } from "@/components/Flash";
import { MaterialForm } from "@/components/MaterialForm";
import { ProgressBar } from "@/components/ProgressBar";
import { requireChild } from "@/lib/auth";
import { formatPoints } from "@/lib/format";
import { groupMaterialsBySubject } from "@/lib/labels";
import { childMaterials, familySubjects } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function MaterialsPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireChild();
  const supabase = await createClient();
  const [subjects, materials] = await Promise.all([familySubjects(supabase, me.family_id), childMaterials(supabase, me.id)]);

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card mb-4 space-y-4">
        <h2 className="h2">教材と進捗</h2>
        {materials.length === 0 && <p className="text-sm text-stone-500">まだ教材がありません</p>}
        {groupMaterialsBySubject(materials, subjects).map((group) => (
          <div key={group.key}>
            <h3 className="mb-2 border-b border-stone-200 pb-1 text-sm font-bold text-stone-600">{group.subject}</h3>
            <div className="space-y-3">
              {group.materials.map((m) => (
                <div key={m.id} className="space-y-1">
                  <ProgressBar material={m} />
                  <p className="flex items-center justify-between text-xs text-stone-500">
                    <span>1周で +{formatPoints(m.lap_points)}</span>
                    {m.current_page >= m.total_pages && (
                      <form action={startNextLap}>
                        <input type="hidden" name="material_id" value={m.id} />
                        <button className="btn-sub">{m.laps + 1}周目を始める</button>
                      </form>
                    )}
                  </p>
                </div>
              ))}
            </div>
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
