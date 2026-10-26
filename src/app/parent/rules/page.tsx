import { updateRules } from "@/app/actions/rules";
import { createTestGoal, deleteTestGoal } from "@/app/actions/tests";
import { Flash, type SearchParams } from "@/components/Flash";
import { requireParent } from "@/lib/auth";
import { familyChildren } from "@/lib/family";
import { formatPoints } from "@/lib/format";
import { describeTestGoal } from "@/lib/points";
import { familyRules } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { TestGoal } from "@/lib/types";

function NumberField({ name, label, unit, value, min = 0 }: { name: string; label: string; unit: string; value: number; min?: number }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input className="input" id={name} name={name} type="number" min={min} defaultValue={value} required />
        <span className="shrink-0 text-sm">{unit}</span>
      </div>
    </div>
  );
}

export default async function RulesPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireParent();
  const supabase = await createClient();
  const [rules, kids] = await Promise.all([familyRules(supabase, me.family_id), familyChildren(supabase, me.family_id)]);
  const { data } = await supabase
    .from("test_goals")
    .select("*")
    .in(
      "child_id",
      kids.map((k) => k.id),
    )
    .order("created_at");
  const goals = (data ?? []) as TestGoal[];
  const childName = new Map(kids.map((k) => [k.id, k.name]));

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card mb-4">
        <h2 className="h2">レート・ボーナス</h2>
        <p className="mb-3 text-xs text-stone-500">1pt＝1円で固定です。祝日は土日と同じ休日レートになります。</p>
        <form action={updateRules} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <NumberField name="weekday_rate" label="平日 1分あたり" unit="pt" value={rules.weekday_rate} />
            <NumberField name="holiday_rate" label="土日・祝日 1分あたり" unit="pt" value={rules.holiday_rate} />
            <NumberField name="streak_days" label="連続記録ボーナスの日数" unit="日" value={rules.streak_days} min={1} />
            <NumberField name="streak_points" label="連続記録ボーナス" unit="pt" value={rules.streak_points} />
            <NumberField name="weekly_hours" label="週の目標（月〜日）" unit="時間以上" value={Math.round(rules.weekly_minutes / 60)} min={1} />
            <NumberField name="weekly_points" label="週の目標達成ボーナス" unit="pt" value={rules.weekly_points} />
          </div>
          <button className="btn w-full">保存する</button>
        </form>
        <p className="mt-3 text-xs text-stone-500">ワーク1周ボーナスは子どもごとの詳細画面で教材ごとに設定します。</p>
      </section>

      <section className="card mb-4">
        <h2 className="h2">テスト目標</h2>
        {goals.length === 0 && <p className="mb-3 text-sm text-stone-500">まだ目標がありません</p>}
        <ul className="mb-4 divide-y divide-stone-100 text-sm">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                <span className="text-stone-500">{childName.get(g.child_id)}：</span>
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

        {kids.length > 0 && (
          <form action={createTestGoal} className="space-y-2 rounded-xl bg-stone-50 p-3">
            <p className="text-sm font-bold">目標を追加</p>
            <select className="input" name="child_id" aria-label="子ども" required>
              {kids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            <input className="input" name="name" placeholder="例：2学期期末 数学、英検3級" required />
            <div className="grid grid-cols-2 gap-2">
              <select className="input" name="condition_type" defaultValue="min_score" aria-label="条件">
                <option value="min_score">点数が○点以上</option>
                <option value="pass">合格したら</option>
              </select>
              <input className="input" name="min_score" type="number" min={0} placeholder="目標点（点数の場合）" aria-label="目標点" />
            </div>
            <div className="flex items-center gap-2">
              <input className="input" name="points" type="number" min={0} defaultValue={1000} aria-label="ポイント" required />
              <span className="shrink-0 text-sm">pt</span>
            </div>
            <button className="btn w-full">追加する</button>
          </form>
        )}
      </section>
    </>
  );
}
