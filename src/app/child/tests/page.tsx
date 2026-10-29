import { createTestGoal, deleteTestGoal, submitTestResult } from "@/app/actions/tests";
import { Flash, type SearchParams } from "@/components/Flash";
import { requireChild, requireUserId } from "@/lib/auth";
import { formatJstDateTime } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import { describeTestGoal } from "@/lib/points";
import { createClient } from "@/lib/supabase/server";
import type { TestGoal, TestResult } from "@/lib/types";

export default async function TestsPage({ searchParams }: { searchParams: SearchParams }) {
  const [supabase, userId] = await Promise.all([createClient(), requireUserId()]);
  const [, { data: goalRows }, { data: resultRows }] = await Promise.all([
    requireChild(),
    supabase.from("test_goals").select("*").eq("child_id", userId).order("created_at"),
    supabase.from("test_results").select("*").eq("child_id", userId).order("created_at", { ascending: false }).limit(30),
  ]);
  const goals = (goalRows ?? []) as TestGoal[];
  const results = (resultRows ?? []) as TestResult[];
  const goalName = new Map(goals.map((g) => [g.id, g.name]));
  const open = goals.filter((g) => !g.achieved_at);
  const achieved = goals.filter((g) => g.achieved_at);

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card mb-4">
        <h2 className="h2">テスト結果を入力</h2>
        {open.length === 0 && <p className="text-sm text-stone-500">いま挑戦中の目標はありません。下で目標を作りましょう。</p>}
        <ul className="space-y-3">
          {open.map((g) => (
            <li key={g.id} className="rounded-xl bg-stone-50 p-3">
              <p className="mb-2 font-bold">
                {g.name}
                <span className="ml-2 text-sm font-normal text-stone-500">
                  {describeTestGoal(g)}で +{formatPoints(g.points)}
                </span>
              </p>
              <form action={submitTestResult} className="flex gap-2">
                <input type="hidden" name="goal_id" value={g.id} />
                {g.condition_type === "min_score" ? (
                  <input className="input" name="score" type="number" min={0} placeholder="点数" aria-label="点数" required />
                ) : (
                  <select className="input" name="passed" defaultValue="yes" aria-label="結果">
                    <option value="yes">合格</option>
                    <option value="no">不合格</option>
                  </select>
                )}
                <button className="btn shrink-0">送信</button>
              </form>
              <form action={deleteTestGoal} className="mt-2 text-right">
                <input type="hidden" name="goal_id" value={g.id} />
                <button className="text-xs text-stone-500 underline">この目標を取り下げる</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mb-4">
        <h2 className="h2">目標を作る</h2>
        <form action={createTestGoal} className="space-y-2">
          <input className="input" name="name" placeholder="例：2学期期末 数学、英検3級" aria-label="目標の名前" required />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" name="condition_type" defaultValue="min_score" aria-label="条件">
              <option value="min_score">点数が○点以上</option>
              <option value="pass">合格したら</option>
            </select>
            <input className="input" name="min_score" type="number" min={0} placeholder="目標点（点数の場合）" aria-label="目標点" />
          </div>
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-sm font-bold text-stone-600" htmlFor="goal-points">
              達成したら
            </label>
            <input className="input" id="goal-points" name="points" type="number" min={0} max={1000000} defaultValue={1000} required />
            <span className="shrink-0 text-sm">pt</span>
          </div>
          <button className="btn w-full">目標を追加</button>
        </form>
        <p className="mt-2 text-xs text-stone-500">例：数学80点以上 → 1,000pt、英検3級合格 → 3,000pt</p>
      </section>

      {achieved.length > 0 && (
        <section className="card mb-4">
          <h2 className="h2">達成した目標</h2>
          <ul className="space-y-1 text-sm">
            {achieved.map((g) => (
              <li key={g.id}>
                🏆 {g.name}（+{formatPoints(g.points)}）
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.length > 0 && (
        <section className="card">
          <h2 className="h2">これまでの結果</h2>
          <ul className="divide-y divide-stone-100 text-sm">
            {results.map((r) => (
              <li key={r.id} className="flex justify-between py-2">
                <span>
                  <span className="text-xs text-stone-500">{formatJstDateTime(r.created_at)}</span> {goalName.get(r.goal_id)}
                </span>
                <span className={r.passed ? "font-bold text-green-700" : "text-stone-500"}>
                  {r.score !== null && `${r.score}点 `}
                  {r.passed ? "達成" : "未達成"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
