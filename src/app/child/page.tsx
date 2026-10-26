import { carryOverTask, completeTask, dropTask } from "@/app/actions/tasks";
import { Flash, type SearchParams } from "@/components/Flash";
import { ProgressBar } from "@/components/ProgressBar";
import { Stat } from "@/components/Stat";
import { TaskForm } from "@/components/TaskForm";
import { requireChild } from "@/lib/auth";
import { formatJpDate, todayJst } from "@/lib/dates";
import { formatHours, formatPoints } from "@/lib/format";
import { childMaterials, childSummary, familyRules } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/types";

export default async function ChildHome({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireChild();
  const supabase = await createClient();
  const today = todayJst();
  const [summary, rules, materials, { data: taskRows }] = await Promise.all([
    childSummary(supabase, me.id),
    familyRules(supabase, me.family_id),
    childMaterials(supabase, me.id),
    supabase.from("tasks").select("*").eq("child_id", me.id).lte("date", today).order("created_at"),
  ]);
  const tasks = (taskRows ?? []) as Task[];
  const todays = tasks.filter((t) => t.date === today);
  const leftover = tasks.filter((t) => t.date < today && !t.done);
  const weekLeft = Math.max(0, rules.weekly_minutes - summary.weekMinutes);
  const materialName = new Map(materials.map((m) => [m.id, m.name]));

  return (
    <>
      <Flash searchParams={searchParams} />

      <section className="card mb-4">
        <h2 className="h2">今日のタスク</h2>
        {leftover.length > 0 && (
          <div className="mb-3 rounded-xl bg-amber-100 p-3">
            <p className="mb-2 text-sm font-bold">終わっていないタスクがあります。今日に持ち越しますか？</p>
            <ul className="space-y-2">
              {leftover.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">
                    {t.title}
                    <span className="ml-1 text-stone-500">{formatJpDate(t.date)}</span>
                  </span>
                  <form action={carryOverTask}>
                    <input type="hidden" name="task_id" value={t.id} />
                    <button className="btn-sub">持ち越す</button>
                  </form>
                  <form action={dropTask}>
                    <input type="hidden" name="task_id" value={t.id} />
                    <button className="btn-sub">やめる</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
        {todays.length === 0 ? (
          <p className="mb-3 text-sm text-stone-500">まだタスクがありません</p>
        ) : (
          <ul className="mb-3 space-y-2">
            {todays.map((t) => (
              <li key={t.id} className="flex items-center gap-3">
                {t.done ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-white" aria-label="完了">
                    ✓
                  </span>
                ) : (
                  <form action={completeTask}>
                    <input type="hidden" name="task_id" value={t.id} />
                    <button className="h-7 w-7 shrink-0 rounded-full border-2 border-stone-300" aria-label={`「${t.title}」を完了にする`} />
                  </form>
                )}
                <span className={t.done ? "text-stone-400 line-through" : ""}>
                  {t.title}
                  {t.material_id && t.pages_to !== null && (
                    <span className="ml-1 text-xs text-stone-500">
                      （{materialName.get(t.material_id)} p.{t.pages_to}まで）
                    </span>
                  )}
                  {t.created_by !== me.id && <span className="ml-1 text-xs text-brand-dark">親から</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <TaskForm materials={materials} back="/child" />
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <Stat label="今月のポイント" value={formatPoints(summary.monthPoints)} sub={`残高 ${formatPoints(summary.balance)}`} />
        <Stat label="連続日数" value={`${summary.streak}日`} sub={`${rules.streak_days}日ごとに +${formatPoints(rules.streak_points)}`} />
        <Stat
          label="週目標までの残り"
          value={weekLeft === 0 ? "達成！" : formatHours(weekLeft)}
          sub={`今週 ${formatHours(summary.weekMinutes)}／${formatHours(rules.weekly_minutes)}`}
        />
        <Stat label="1分あたり" value={`${rules.weekday_rate}pt`} sub={`土日・祝日は${rules.holiday_rate}pt`} />
      </section>

      {materials.length > 0 && (
        <section className="card space-y-3">
          <h2 className="h2">教材の進捗</h2>
          {materials.map((m) => (
            <ProgressBar key={m.id} material={m} />
          ))}
        </section>
      )}
    </>
  );
}
