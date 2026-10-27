import Link from "next/link";
import { toggleZkaiCheck } from "@/app/actions/zkai";
import { zkaiMonthLabel } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import type { ZkaiCheck } from "@/lib/types";
import { ScrollToCurrent } from "./ScrollToCurrent";
import { ZKAI_MONTHS, ZKAI_SUBJECTS, isZkaiMonthOpen, type ZkaiSubject } from "@/lib/zkai";

/**
 * Z会チェックリストの表（行が教科、列が3月始まり〜翌2月）。
 * editable なら子どもがマスを押してチェックを付け外しできる。親は表示のみ（取り消しは表の下の一覧から）。
 */
export function ZkaiTable({
  grade,
  yearStart,
  checks,
  points,
  today,
  currentMonth,
  editable,
}: {
  grade: number;
  yearStart: number;
  /** この学年のチェック（取り消し済みも含む） */
  checks: ZkaiCheck[];
  points: Record<ZkaiSubject, number>;
  today: string;
  /** 今月の列を強調する（この表が今の年度のときだけ） */
  currentMonth: number | null;
  editable: boolean;
}) {
  const active = new Map(checks.filter((c) => !c.revoked_at).map((c) => [`${c.month}:${c.subject}`, c]));
  // 親が取り消したマス（まだチェックし直していないもの）には、最新の取り消し理由を出す
  const revokedByParent = new Map<string, ZkaiCheck>();
  for (const c of checks) {
    const key = `${c.month}:${c.subject}`;
    if (c.revoked_at && c.revoke_reason && !active.has(key) && !revokedByParent.has(key)) revokedByParent.set(key, c);
  }

  return (
    <ScrollToCurrent className="-mx-4 overflow-x-auto px-4">
      <table className="w-full border-separate border-spacing-0 text-center text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-xs text-stone-500">教科</th>
            {ZKAI_MONTHS.map((m) => (
              <th
                key={m}
                data-current={m === currentMonth ? "" : undefined}
                className={`min-w-10 px-1 py-1 text-xs ${m === currentMonth ? "rounded-t-lg bg-amber-200 font-bold text-amber-900" : "text-stone-500"}`}
              >
                {zkaiMonthLabel(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ZKAI_SUBJECTS.map((subject) => (
            <tr key={subject}>
              <th className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-left font-bold">
                {subject}
                <span className="block text-[10px] font-normal text-stone-400">{formatPoints(points[subject])}</span>
              </th>
              {ZKAI_MONTHS.map((month) => {
                const key = `${month}:${subject}`;
                const checked = active.has(key);
                const revoked = revokedByParent.get(key);
                const open = isZkaiMonthOpen(yearStart, month, today);
                const highlight = month === currentMonth ? "bg-amber-100" : "";
                const label = `${grade}年 ${zkaiMonthLabel(month)} ${subject}`;
                return (
                  <td key={month} className={`border-t border-stone-100 p-0.5 ${highlight}`}>
                    {editable && open ? (
                      <form action={toggleZkaiCheck}>
                        <input type="hidden" name="grade" value={grade} />
                        <input type="hidden" name="month" value={month} />
                        <input type="hidden" name="subject" value={subject} />
                        <button
                          className={`h-9 w-9 rounded-lg text-lg ${checked ? "bg-green-100" : "border-2 border-stone-300 bg-white"}`}
                          aria-label={checked ? `${label}のチェックを外す` : `${label}をチェックする`}
                          aria-pressed={checked}
                          title={revoked ? `親が取り消し：${revoked.revoke_reason}` : undefined}
                        >
                          {checked ? "✅" : revoked ? <span className="text-xs text-red-600">取消</span> : ""}
                        </button>
                      </form>
                    ) : (
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-lg ${open ? "" : "bg-stone-100 text-stone-300"}`}
                        title={revoked ? `取り消し：${revoked.revoke_reason}` : undefined}
                      >
                        {checked ? "✅" : revoked ? <span className="text-xs text-red-600">取消</span> : open ? "⬜" : "－"}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollToCurrent>
  );
}

/** 学年の切り替えタブ */
export function GradeTabs({
  selected,
  current,
  href,
}: {
  selected: number;
  /** 今の学年。未設定なら null（「（今）」を出さない） */
  current: number | null;
  href: (grade: number) => string;
}) {
  return (
    <div className="mb-3 flex gap-2" role="tablist">
      {[1, 2, 3].map((g) => (
        <Link
          key={g}
          href={href(g)}
          role="tab"
          aria-selected={g === selected}
          className={`rounded-full px-4 py-1.5 text-sm font-bold ${g === selected ? "bg-brand text-white" : "bg-stone-100 text-stone-600"}`}
        >
          {g}年{g === current && <span className="ml-1 text-xs">（今）</span>}
        </Link>
      ))}
    </div>
  );
}

export function ZkaiProgress({ remaining }: { remaining: number }) {
  const total = ZKAI_SUBJECTS.length;
  const doneCount = total - remaining;
  return (
    <div className="mb-3">
      <p className="mb-1 text-sm font-bold">
        今月 {doneCount}/{total}教科完了{remaining === 0 && " 🎉"}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-green-500" style={{ width: `${(doneCount / total) * 100}%` }} />
      </div>
    </div>
  );
}
