import { updateLapPoints } from "@/app/actions/materials";
import { Flash, type SearchParams } from "@/components/Flash";
import { LedgerList } from "@/components/LedgerList";
import { MaterialForm } from "@/components/MaterialForm";
import { ProgressBar } from "@/components/ProgressBar";
import { Stat } from "@/components/Stat";
import { StudyLogList } from "@/components/StudyLogList";
import { TaskForm } from "@/components/TaskForm";
import { requireChildOfFamily, requireParent } from "@/lib/auth";
import { addDays, todayJst } from "@/lib/dates";
import { formatHours, formatPoints } from "@/lib/format";
import { childMaterials, childSummary, familySubjects } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { LedgerEntry, StudyLog, Task } from "@/lib/types";

export default async function ChildDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const me = await requireParent();
  const child = await requireChildOfFamily(me, (await params).id);
  const supabase = await createClient();
  const today = todayJst();
  const back = `/parent/children/${child.id}`;
  const [summary, subjects, materials, { data: logs }, { data: ledger }, { data: tasks }] = await Promise.all([
    childSummary(supabase, child.id),
    familySubjects(supabase, me.family_id),
    childMaterials(supabase, child.id),
    supabase
      .from("study_logs")
      .select("*")
      .eq("child_id", child.id)
      .gte("study_date", addDays(today, -60))
      .order("study_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("point_ledger").select("*").eq("child_id", child.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("tasks").select("*").eq("child_id", child.id).eq("date", today).order("created_at"),
  ]);

  return (
    <>
      <h1 className="mb-3 text-xl font-bold">{child.name}</h1>
      <Flash searchParams={searchParams} />

      <section className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="今月" value={formatPoints(summary.monthPoints)} />
        <Stat label="今週の勉強" value={formatHours(summary.weekMinutes)} />
        <Stat label="残高" value={formatPoints(summary.balance)} sub={`連続${summary.streak}日`} />
      </section>

      <section className="card mb-4">
        <h2 className="h2">今日のタスク</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {((tasks ?? []) as Task[]).map((t) => (
            <li key={t.id} className={t.done ? "text-stone-400 line-through" : ""}>
              {t.done ? "✓" : "・"} {t.title}
            </li>
          ))}
        </ul>
        <TaskForm materials={materials} back={back} childId={child.id} />
      </section>

      <section className="card mb-4">
        <h2 className="h2">勉強の記録（60日分）</h2>
        <StudyLogList logs={(logs ?? []) as StudyLog[]} subjects={subjects} materials={materials} canDelete />
      </section>

      <section className="card mb-4 space-y-4">
        <h2 className="h2">教材</h2>
        {materials.map((m) => (
          <div key={m.id} className="space-y-1">
            <ProgressBar material={m} />
            <form action={updateLapPoints} className="flex items-center gap-2 text-sm">
              <input type="hidden" name="child_id" value={child.id} />
              <input type="hidden" name="material_id" value={m.id} />
              <label htmlFor={`lap-${m.id}`} className="shrink-0 text-stone-500">
                1周ボーナス
              </label>
              <input className="input w-28" id={`lap-${m.id}`} name="lap_points" type="number" min={0} defaultValue={m.lap_points} />
              <span>pt</span>
              <button className="btn-sub">保存</button>
            </form>
          </div>
        ))}
        <MaterialForm subjects={subjects} back={back} childId={child.id} />
      </section>

      <section className="card">
        <h2 className="h2">ポイントの動き</h2>
        <LedgerList entries={(ledger ?? []) as LedgerEntry[]} />
      </section>
    </>
  );
}
