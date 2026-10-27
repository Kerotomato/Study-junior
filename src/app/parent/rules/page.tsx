import { updateRules } from "@/app/actions/rules";
import { Flash, type SearchParams } from "@/components/Flash";
import { requireParent } from "@/lib/auth";
import { familyRules } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

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
  const rules = await familyRules(await createClient(), me.family_id);

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
            <NumberField name="test_points" label="テスト目標の達成ボーナス" unit="pt" value={rules.test_points} />
          </div>
          <button className="btn w-full">保存する</button>
        </form>
        <p className="mt-3 text-xs text-stone-500">
          テスト目標は子どもが自分で作り、達成するとここで決めた額が入ります（作ったときの額で固定）。
          ワーク1周ボーナスは子どもごとの詳細画面で教材ごとに設定します。
        </p>
      </section>

    </>
  );
}
