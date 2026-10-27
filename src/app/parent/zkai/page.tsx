import Link from "next/link";
import { addZkaiItem, archiveZkaiItem, revokeZkaiCheck, updateZkaiItemPoints } from "@/app/actions/zkai";
import { Flash, type SearchParams } from "@/components/Flash";
import { GradeTabs, ZkaiProgress, ZkaiTable } from "@/components/ZkaiTable";
import { requireParent } from "@/lib/auth";
import { formatJstDateTime, todayJst, zkaiMonthLabel } from "@/lib/dates";
import { familyChildren } from "@/lib/family";
import { formatPoints } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ZkaiCheck, ZkaiItem } from "@/lib/types";
import { ZKAI_MONTHS, ZKAI_POINT_STEP, type ZkaiRow, pickGrade, remainingThisMonth, zkaiRowKey, zkaiRows } from "@/lib/zkai";
import { childCurrentGrade, zkaiChecks, zkaiItems, zkaiPoints } from "@/lib/zkaiData";

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
  const [current, checks, points, items] = await Promise.all([
    childCurrentGrade(supabase, child.id, today),
    zkaiChecks(supabase, child.id),
    zkaiPoints(supabase, me.family_id),
    zkaiItems(supabase, child.id),
  ]);
  const grade = pickGrade(params.grade, current ?? 1);
  const isCurrent = grade === current;
  const shownItems = items.filter((i) => !i.archived_at);
  const rows = zkaiRows(points, shownItems);
  const gradeChecks = checks.filter((c) => c.grade === grade);

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

      <section className="card mb-4">
        <h2 className="h2">{child.name}さんのZ会</h2>
        <GradeTabs selected={grade} current={current} href={(g) => `/parent/zkai?child=${child.id}&grade=${g}`} />
        {current === null && (
          <p className="mb-3 rounded-xl bg-amber-100 p-3 text-sm">
            学年がまだ設定されていません。子どもが選んだ学年のタブでチェックすると、今年度の学年として記録されます。
            <Link className="ml-1 font-bold text-brand-dark underline" href="/parent/family">
              学年を設定する
            </Link>
          </p>
        )}
        {current !== null && isCurrent && (
          <ZkaiProgress
            remaining={remainingThisMonth(
              checks.filter((c) => !c.revoked_at),
              rows,
              current,
              today,
            ).length}
            total={rows.length}
          />
        )}
        <ZkaiTable
          grade={grade}
          checks={gradeChecks}
          rows={rows}
          currentMonth={isCurrent || current === null ? Number(today.slice(5, 7)) : null}
          editable={false}
        />
        <p className="mt-3 text-xs text-stone-500">
          チェックは子どもが付けます。6教科のポイントは「ルール設定」で、追加した教材のポイントは下で決められます。
        </p>
      </section>

      <ZkaiItemsSection childId={child.id} items={shownItems} />
      <RevokeSection grade={grade} checks={gradeChecks} rows={rows} items={items} />
    </>
  );
}

/** 親が Z会の教材（6教科以外の行）を追加・ポイント変更・表から外す */
function ZkaiItemsSection({ childId, items }: { childId: string; items: ZkaiItem[] }) {
  return (
    <section className="card mb-4">
      <h2 className="h2">Z会の教材を追加</h2>
      <p className="mb-3 text-xs text-stone-500">
        6教科のほかに、チェックリストに行を追加できます（例：プラス 数学、定期テスト対策）。ポイントは{ZKAI_POINT_STEP}pt単位です。
      </p>
      {items.length > 0 && (
        <ul className="mb-4 divide-y divide-stone-100 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1 font-bold">{item.name}</span>
              <form action={updateZkaiItemPoints} className="flex items-center gap-1">
                <input type="hidden" name="item_id" value={item.id} />
                <input
                  className="input w-24"
                  name="points"
                  type="number"
                  min={0}
                  step={ZKAI_POINT_STEP}
                  defaultValue={item.points}
                  aria-label={`${item.name}のポイント`}
                  required
                />
                <span>pt</span>
                <button className="btn-sub">保存</button>
              </form>
              <form action={archiveZkaiItem}>
                <input type="hidden" name="item_id" value={item.id} />
                <button className="text-xs text-stone-500 underline">表から外す</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={addZkaiItem} className="space-y-2 rounded-xl bg-stone-50 p-3">
        <input type="hidden" name="child_id" value={childId} />
        <input className="input" name="name" maxLength={30} placeholder="教材の名前（例：プラス 数学）" aria-label="教材の名前" required />
        <div className="flex items-center gap-2">
          <label className="shrink-0 text-sm font-bold text-stone-600" htmlFor="zkai-item-points">
            1回分
          </label>
          <input
            className="input"
            id="zkai-item-points"
            name="points"
            type="number"
            min={0}
            step={ZKAI_POINT_STEP}
            defaultValue={300}
            required
          />
          <span className="shrink-0 text-sm">pt</span>
        </div>
        <button className="btn w-full">チェックリストに追加</button>
      </form>
    </section>
  );
}

/** 有効なチェックを、表と同じ順（月→行）に並べて、理由つきで取り消せるようにする */
function RevokeSection({ grade, checks, rows, items }: { grade: number; checks: ZkaiCheck[]; rows: ZkaiRow[]; items: ZkaiItem[] }) {
  const rowOrder = new Map(rows.map((r, i) => [r.key, i]));
  // 表から外した教材のチェックも取り消せるように、名前は外したものも含めて引く
  const itemName = new Map(items.map((i) => [i.id, i.name]));
  const active = checks
    .filter((c) => !c.revoked_at)
    .sort(
      (a, b) =>
        ZKAI_MONTHS.indexOf(a.month as (typeof ZKAI_MONTHS)[number]) - ZKAI_MONTHS.indexOf(b.month as (typeof ZKAI_MONTHS)[number]) ||
        (rowOrder.get(zkaiRowKey(a)) ?? rows.length) - (rowOrder.get(zkaiRowKey(b)) ?? rows.length),
    );

  return (
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
                  ✅ {zkaiMonthLabel(c.month)} {c.subject ?? itemName.get(c.item_id ?? "") ?? "教材"}（{formatPoints(c.points)}）
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
  );
}
