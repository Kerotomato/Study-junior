import { Flash, type SearchParams } from "@/components/Flash";
import { GradeTabs, ZkaiProgress, ZkaiTable } from "@/components/ZkaiTable";
import { requireChild } from "@/lib/auth";
import { todayJst } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { pickGrade, remainingThisMonth, yearStartOfGrade } from "@/lib/zkai";
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

  if (current === null) {
    return (
      <section className="card text-center text-sm">
        <h2 className="h2">Z会チェックリスト</h2>
        <p>学年がまだ設定されていません。親に「家族・アカウント」で学年を設定してもらってください。</p>
      </section>
    );
  }

  const grade = pickGrade((await searchParams).grade, current);
  const yearStart = yearStartOfGrade(grade, current, today);
  const isCurrent = grade === current;
  const active = checks.filter((c) => !c.revoked_at);

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card">
        <h2 className="h2">Z会チェックリスト</h2>
        <GradeTabs selected={grade} current={current} href={(g) => `/child/zkai?grade=${g}`} />
        {isCurrent && <ZkaiProgress remaining={remainingThisMonth(active, current, today).length} />}
        {grade > current ? (
          <p className="text-sm text-stone-500">{grade}年になったらチェックできます。</p>
        ) : (
          <ZkaiTable
            grade={grade}
            yearStart={yearStart}
            checks={checks.filter((c) => c.grade === grade)}
            points={points}
            today={today}
            currentMonth={isCurrent ? Number(today.slice(5, 7)) : null}
            editable
          />
        )}
        <p className="mt-3 text-xs text-stone-500">
          マスを押すとチェック（✅）が付き、教科ごとのポイントがもらえます。もう一度押すと外れて、そのポイントは取り消されます。
          先の月はまだチェックできません。
        </p>
      </section>
    </>
  );
}
