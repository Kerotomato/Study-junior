import { carryOverTask, completeTask, dropTask } from "@/app/actions/tasks";
import { Flash, type SearchParams } from "@/components/Flash";
import { ProgressBar } from "@/components/ProgressBar";
import { Stat } from "@/components/Stat";
import { TaskForm } from "@/components/TaskForm";
import { requireChild, requireUserId } from "@/lib/auth";
import { formatJpDate, todayJst } from "@/lib/dates";
import { formatHours, formatPoints } from "@/lib/format";
import { pageRange, taskLabel } from "@/lib/labels";
import { childMaterials, childSummary, familyRules, familySubjects } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { remainingThisMonth, zkaiRows } from "@/lib/zkai";
import { childCurrentGrade, zkaiChecks, zkaiItems, zkaiPoints } from "@/lib/zkaiData";
import Link from "next/link";
import type { Task } from "@/lib/types";

export default async function ChildHome({ searchParams }: { searchParams: SearchParams }) {
  const [supabase, userId] = await Promise.all([createClient(), requireUserId()]);
  const today = todayJst();
  // 役割の確認（requireChild）と画面のデータの取得を同時に行う
  const [me, summary, rules, subjects, materials, { data: taskRows }, grade, checks, zkaiPointRules, items] = await Promise.all([
    requireChild(),
    childSummary(supabase, userId),
    familyRules(supabase),
    familySubjects(supabase),
    childMaterials(supabase, userId),
    supabase.from("tasks").select("*").eq("child_id", userId).lte("date", today).order("created_at"),
    childCurrentGrade(supabase, userId, today),
    zkaiChecks(supabase, userId),
    zkaiPoints(supabase),
    zkaiItems(supabase, userId),
  ]);
  // 今の学年が表の範囲（1〜3年）のときだけ、今月のZ会の残りを出す
  const zkaiLeft =
    grade !== null && grade >= 1 && grade <= 3
      ? remainingThisMonth(
          checks.filter((c) => !c.revoked_at),
          zkaiRows(
            zkaiPointRules,
            items.filter((i) => !i.archived_at),
          ),
          grade,
          today,
        ).length
      : 0;
  const tasks = (taskRows ?? []) as Task[];
  const todays = tasks.filter((t) => t.date === today);
  const leftover = tasks.filter((t) => t.date < today && !t.done);
  const weekLeft = Math.max(0, rules.weekly_minutes - summary.weekMinutes);

  return (
    <>
      <Flash searchParams={searchParams} />

      <section className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="現在のポイント" value={formatPoints(summary.balance)} />
        <Stat label="連続日数" value={`${summary.streak}日`} />
        <Stat label="今日の学習時間" value={formatHours(summary.todayMinutes)} />
      </section>

      {zkaiLeft > 0 && (
        <Link href="/child/zkai" className="mb-3 block rounded-xl bg-white px-4 py-2 text-sm ring-1 ring-stone-200">
          📘 Z会 今月あと<span className="font-bold">{zkaiLeft}教科</span>
        </Link>
      )}

      <section className="card mb-4">
        <h2 className="h2">今日のタスク</h2>
        {leftover.length > 0 && (
          <div className="mb-3 rounded-xl bg-amber-100 p-3">
            <p className="mb-2 text-sm font-bold">終わっていないタスクがあります。今日に持ち越しますか？</p>
            <ul className="space-y-2">
              {leftover.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">
                    {taskLabel(t, materials, subjects)}
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
                    <button
                      className="h-7 w-7 shrink-0 rounded-full border-2 border-stone-300"
                      aria-label={`「${taskLabel(t, materials, subjects)}」を完了にする`}
                    />
                  </form>
                )}
                <span className={t.done ? "text-stone-400 line-through" : ""}>
                  {taskLabel(t, materials, subjects)}
                  {t.title && t.material_id && (t.pages_from !== null || t.pages_to !== null) && (
                    <span className="ml-1 text-xs text-stone-500">（{pageRange(t.pages_from, t.pages_to)}）</span>
                  )}
                  {t.created_by !== me.id && <span className="ml-1 text-xs text-brand-dark">親から</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <TaskForm subjects={subjects} materials={materials} back="/child" />
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <Stat label="今月のポイント" value={formatPoints(summary.monthPoints)} />
        <Stat
          label="週目標までの残り"
          value={weekLeft === 0 ? "達成！" : formatHours(weekLeft)}
          sub={`今週 ${formatHours(summary.weekMinutes)}／${formatHours(rules.weekly_minutes)}`}
        />
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
