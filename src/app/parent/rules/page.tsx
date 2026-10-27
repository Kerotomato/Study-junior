import { updateRules } from "@/app/actions/rules";
import { updateZkaiPoints } from "@/app/actions/zkai";
import { Flash, type SearchParams } from "@/components/Flash";
import { requireParent } from "@/lib/auth";
import { familyRules } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { ZKAI_POINT_STEP, ZKAI_SUBJECTS } from "@/lib/zkai";
import { zkaiPoints } from "@/lib/zkaiData";

function NumberField({
  name,
  label,
  unit,
  value,
  min = 0,
  step = 1,
}: {
  name: string;
  label: string;
  unit: string;
  value: number;
  min?: number;
  /** 矢印で増減する幅。入力できるのもこの倍数だけになる */
  step?: number;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input className="input" id={name} name={name} type="number" min={min} step={step} defaultValue={value} required />
        <span className="shrink-0 text-sm">{unit}</span>
      </div>
    </div>
  );
}

export default async function RulesPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireParent();
  const supabase = await createClient();
  const [rules, zkai] = await Promise.all([familyRules(supabase, me.family_id), zkaiPoints(supabase, me.family_id)]);

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
        <p className="mt-3 text-xs text-stone-500">
          テスト目標とその達成ポイントは子どもが自分で決めます（子どもの詳細画面で確認・取り下げできます）。
          ワーク1周ボーナスは子どもごとの詳細画面で教材ごとに設定します。
        </p>
      </section>

      <section className="card">
        <h2 className="h2">Z会のポイント</h2>
        <p className="mb-3 text-xs text-stone-500">
          教科ごとに、1回分（1か月の1教科）のチェックでもらえるポイントです。{ZKAI_POINT_STEP}pt単位で設定します。子どもは変更できません。
          変更は、これから付けるチェックから反映されます。
        </p>
        <form action={updateZkaiPoints} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ZKAI_SUBJECTS.map((subject) => (
              <NumberField
                key={subject}
                name={`zkai_${subject}`}
                label={subject}
                unit="pt"
                // 以前に50の倍数以外で保存した値は、近い50の倍数で表示する（そのままだとブラウザが保存を止めるため）
                value={Math.round(zkai[subject] / ZKAI_POINT_STEP) * ZKAI_POINT_STEP}
                step={ZKAI_POINT_STEP}
              />
            ))}
          </div>
          <button className="btn w-full">保存する</button>
        </form>
      </section>
    </>
  );
}
