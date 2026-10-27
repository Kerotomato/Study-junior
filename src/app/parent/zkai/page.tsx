import Link from "next/link";
import { revokeZkaiCheck } from "@/app/actions/zkai";
import { Flash, type SearchParams } from "@/components/Flash";
import { GradeTabs, ZkaiProgress, ZkaiTable } from "@/components/ZkaiTable";
import { requireParent } from "@/lib/auth";
import { formatJstDateTime, todayJst, zkaiMonthLabel } from "@/lib/dates";
import { familyChildren } from "@/lib/family";
import { formatPoints } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ZKAI_MONTHS, ZKAI_SUBJECTS, pickGrade, remainingThisMonth, yearStartOfGrade, zkaiYearStart } from "@/lib/zkai";
import { childCurrentGrade, zkaiChecks, zkaiPoints } from "@/lib/zkaiData";

export default async function ParentZkaiPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireParent();
  const supabase = await createClient();
  const params = await searchParams;
  const kids = await familyChildren(supabase, me.family_id);
  if (kids.length === 0) {
    return <p className="card text-sm">まだ子どもが登録されていません。</p>;
  }
  const child = kids.find((k) => k.id === params.child) ?? kids[0];
  const today = todayJst();
  const [current, checks, points] = await Promise.all([
    childCurrentGrade(supabase, child.id, today),
    zkaiChecks(supabase, child.id),
    zkaiPoints(supabase, me.family_id),
  ]);

  return (
    <>
      <Flash searchParams={searchParams} />
      {kids.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {kids.map((k) => (
            <Link
              key={k.id}
              href={`/parent/zkai?child=${k.id}`}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${k.id === child.id ? "bg-stone-700 text-white" : "bg-white text-stone-600"}`}
            >
              {k.name}
            </Link>
          ))}
        </div>
      )}
      <ZkaiParentView
        childId={child.id}
        childName={child.name}
        current={current}
        grade={pickGrade(params.grade, current ?? 1)}
        checks={checks}
        points={points}
        today={today}
      />
    </>
  );
}

function ZkaiParentView({
  childId,
  childName,
  current,
  grade,
  checks,
  points,
  today,
}: {
  childId: string;
  childName: string;
  /** 今の学年。未設定なら null（表は見られる） */
  current: number | null;
  grade: number;
  checks: Awaited<ReturnType<typeof zkaiChecks>>;
  points: Awaited<ReturnType<typeof zkaiPoints>>;
  today: string;
}) {
  const isCurrent = grade === current;
  const gradeChecks = checks.filter((c) => c.grade === grade);
  // 取り消せるのは有効なチェック。表と同じ順（月→教科）に並べる
  const active = gradeChecks
    .filter((c) => !c.revoked_at)
    .sort(
      (a, b) =>
        ZKAI_MONTHS.indexOf(a.month as (typeof ZKAI_MONTHS)[number]) - ZKAI_MONTHS.indexOf(b.month as (typeof ZKAI_MONTHS)[number]) ||
        ZKAI_SUBJECTS.indexOf(a.subject as (typeof ZKAI_SUBJECTS)[number]) - ZKAI_SUBJECTS.indexOf(b.subject as (typeof ZKAI_SUBJECTS)[number]),
    );

  return (
    <>
      <section className="card mb-4">
        <h2 className="h2">{childName}さんのZ会</h2>
        <GradeTabs selected={grade} current={current} href={(g) => `/parent/zkai?child=${childId}&grade=${g}`} />
        {current === null && (
          <p className="mb-3 rounded-xl bg-amber-100 p-3 text-sm">
            学年がまだ設定されていないため、子どもはチェックできません。
            <Link className="ml-1 font-bold text-brand-dark underline" href="/parent/family">
              学年を設定する
            </Link>
          </p>
        )}
        {current !== null && isCurrent && (
          <ZkaiProgress remaining={remainingThisMonth(checks.filter((c) => !c.revoked_at), current, today).length} />
        )}
        <ZkaiTable
          grade={grade}
          yearStart={current === null ? zkaiYearStart(today) : yearStartOfGrade(grade, current, today)}
          checks={gradeChecks}
          points={points}
          today={today}
          currentMonth={isCurrent || current === null ? Number(today.slice(5, 7)) : null}
          editable={false}
        />
        <p className="mt-3 text-xs text-stone-500">チェックは子どもが付けます。ポイントは「ルール設定」で教科ごとに決められます。</p>
      </section>

      <section className="card">
        <h2 className="h2">チェックの取り消し（{grade}年）</h2>
        <p className="mb-3 text-xs text-stone-500">理由を入れて取り消すと、そのポイントを取り消して本人に通知します。</p>
        {active.length === 0 && <p className="text-sm text-stone-500">取り消せるチェックはありません</p>}
        <ul className="divide-y divide-stone-100 text-sm">
          {active.map((c) => (
            <li key={c.id} className="py-2">
              <details>
                <summary className="flex cursor-pointer items-center justify-between gap-2">
                  <span>
                    ✅ {zkaiMonthLabel(c.month)} {c.subject}（{formatPoints(c.points)}）
                    <span className="ml-1 text-xs text-stone-400">{formatJstDateTime(c.checked_at)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-red-700">取り消す</span>
                </summary>
                <form action={revokeZkaiCheck} className="mt-2 flex gap-2">
                  <input type="hidden" name="check_id" value={c.id} />
                  <input className="input text-sm" name="reason" placeholder="取り消しの理由（本人に通知されます）" aria-label="取り消しの理由" required />
                  <button className="btn-danger shrink-0">取り消す</button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
