import { Flash, type SearchParams } from "@/components/Flash";
import { GradeTabs, ZkaiProgress, ZkaiTable } from "@/components/ZkaiTable";
import { requireChild, requireUserId } from "@/lib/auth";
import { todayJst } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { pickGrade, remainingThisMonth, zkaiRows } from "@/lib/zkai";
import { childCurrentGrade, zkaiChecks, zkaiItems, zkaiPoints } from "@/lib/zkaiData";

export default async function ZkaiPage({ searchParams }: { searchParams: SearchParams }) {
  const [supabase, userId] = await Promise.all([createClient(), requireUserId()]);
  const today = todayJst();
  const [, current, checks, points, items] = await Promise.all([
    requireChild(),
    childCurrentGrade(supabase, userId, today),
    zkaiChecks(supabase, userId),
    zkaiPoints(supabase),
    zkaiItems(supabase, userId),
  ]);

  // どの学年の表もいつでも見られ、どのマスもいつでもチェックできる
  const grade = pickGrade((await searchParams).grade, current ?? 1);
  const isCurrent = grade === current;
  const rows = zkaiRows(
    points,
    items.filter((i) => !i.archived_at),
  );
  const active = checks.filter((c) => !c.revoked_at);

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card">
        <h2 className="h2">Z会チェックリスト</h2>
        <GradeTabs selected={grade} current={current} href={(g) => `/child/zkai?grade=${g}`} />
        {current !== null && isCurrent && (
          <ZkaiProgress remaining={remainingThisMonth(active, rows, current, today).length} total={rows.length} />
        )}
        <ZkaiTable
          grade={grade}
          checks={checks.filter((c) => c.grade === grade)}
          rows={rows}
          currentMonth={isCurrent || current === null ? Number(today.slice(5, 7)) : null}
          editable
        />
        <p className="mt-3 text-xs text-stone-500">
          マスを押すとチェック（✅）が付き、ポイントがもらえます。もう一度押すと外れて、そのポイントは取り消されます。
          どの学年・どの月のマスも、いつでもチェックできます。教科のあとの行は、親が追加した教材です。
        </p>
      </section>
    </>
  );
}
