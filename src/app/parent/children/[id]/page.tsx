import Link from "next/link";
import { updateLapPoints } from "@/app/actions/materials";
import { deleteTestGoal } from "@/app/actions/tests";
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
import { groupMaterialsBySubject, taskLabel } from "@/lib/labels";
import { describeTestGoal } from "@/lib/points";
import { childMaterials, childSummary, familySubjects } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { LedgerEntry, StudyLog, Task, TestGoal } from "@/lib/types";

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
  const [summary, subjects, materials, { data: logs }, { data: ledger }, { data: tasks }, { data: goals }] = await Promise.all([
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
    supabase.from("test_goals").select("*").eq("child_id", child.id).order("created_at"),
  ]);

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">{child.name}</h1>
        <Link href={`/parent/zkai?child=${child.id}`} className="btn-sub">
          📘 Z会を見る
        </Link>
      </div>
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
              {t.done ? "✓" : "・"} {taskLabel(t, materials, subjects)}
            </li>
          ))}
        </ul>
        <TaskForm subjects={subjects} materials={materials} back={back} childId={child.id} />
      </section>

      <section className="card mb-4">
        <h2 className="h2">勉強の記録（60日分）</h2>
        <p className="mb-3 text-xs text-stone-500">
          手入力の記録は理由を入れて却下できます（ポイントを取り消して本人に通知）。タイマーの記録も不審なときは削除できます。
        </p>
        <StudyLogList logs={(logs ?? []) as StudyLog[]} subjects={subjects} materials={materials} mode="parent" />
      </section>

      <section className="card mb-4 space-y-4">
        <h2 className="h2">教材</h2>
        <MaterialForm subjects={subjects} back={back} childId={child.id} />
        {groupMaterialsBySubject(materials, subjects).map((group) => (
          <div key={group.key} className="space-y-3">
            <h3 className="border-b border-stone-200 pb-1 text-sm font-bold text-stone-600">{group.subject}</h3>
            {group.materials.map((m) => (
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
          </div>
        ))}
      </section>

      <section className="card mb-4">
        <h2 className="h2">テスト目標（本人が設定）</h2>
        {(goals ?? []).length === 0 && <p className="text-sm text-stone-500">まだ目標がありません</p>}
        <ul className="divide-y divide-stone-100 text-sm">
          {((goals ?? []) as TestGoal[]).map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                {g.name}（{describeTestGoal(g)}・{formatPoints(g.points)}）{g.achieved_at && " 🏆達成"}
              </span>
              {!g.achieved_at && (
                <form action={deleteTestGoal}>
                  <input type="hidden" name="goal_id" value={g.id} />
                  <button className="btn-sub">取り下げ</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="h2">ポイントの動き</h2>
        <LedgerList entries={(ledger ?? []) as LedgerEntry[]} />
      </section>
    </>
  );
}
