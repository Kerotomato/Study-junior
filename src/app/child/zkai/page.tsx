import { Flash, type SearchParams } from "@/components/Flash";
import { GradeTabs, ZkaiProgress, ZkaiTable } from "@/components/ZkaiTable";
import { requireChild } from "@/lib/auth";
import { todayJst } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { pickGrade, remainingThisMonth } from "@/lib/zkai";
import { childCurrentGrade, zkaiChecks, zkaiPoints } from "@/lib/zkaiData";

export default async function ZkaiPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireChild();
  const supabase = await createClient();
  const today = todayJst();
  const [current, checks, points] = await Promise.all([
    childCurrentGrade(supabase, me.id, today),
    zkaiChecks(supabase, me.id),
    zkaiPoints(supabase, me.family_id),
  ]);

  // どの学年の表もいつでも見られ、どのマスもいつでもチェックできる（学年が未設定なら見るだけ）
  const grade = pickGrade((await searchParams).grade, current ?? 1);
  const isCurrent = grade === current;
  const active = checks.filter((c) => !c.revoked_at);

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card">
        <h2 className="h2">Z会チェックリスト</h2>
        <GradeTabs selected={grade} current={current} href={(g) => `/child/zkai?grade=${g}`} />
        {current === null && (
          <p className="mb-3 rounded-xl bg-amber-100 p-3 text-sm">
            学年がまだ設定されていないので、表を見ることだけできます。チェックするには、親に「家族・アカウント」で学年を設定してもらってください。
          </p>
        )}
        {current !== null && isCurrent && <ZkaiProgress remaining={remainingThisMonth(active, current, today).length} />}
        <ZkaiTable
          grade={grade}
          checks={checks.filter((c) => c.grade === grade)}
          points={points}
          currentMonth={isCurrent || current === null ? Number(today.slice(5, 7)) : null}
          editable={current !== null}
        />
        <p className="mt-3 text-xs text-stone-500">
          マスを押すとチェック（✅）が付き、教科ごとのポイントがもらえます。もう一度押すと外れて、そのポイントは取り消されます。
          どの学年・どの月のマスも、いつでもチェックできます。
        </p>
      </section>
    </>
  );
}
