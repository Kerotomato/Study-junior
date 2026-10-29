import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { familyChildren } from "@/lib/family";
import { formatHours, formatPoints } from "@/lib/format";
import { EMPTY_SUMMARY, visibleChildSummaries } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ParentHome() {
  const supabase = await createClient();
  // 子どもの人数に関係なく、一覧と集計を同時に取る（集計は RLS で家族の子ども全員分）
  const [, kids, summaryById] = await Promise.all([requireParent(), familyChildren(supabase), visibleChildSummaries(supabase)]);
  const summaries = kids.map((k) => summaryById.get(k.id) ?? EMPTY_SUMMARY);

  if (kids.length === 0) {
    return (
      <section className="card text-center">
        <p className="mb-3">まだ子どもが登録されていません</p>
        <Link className="btn" href="/parent/family">
          子どもを追加する
        </Link>
      </section>
    );
  }

  return (
    <ul className="space-y-3">
      {kids.map((k, i) => (
        <li key={k.id}>
          <Link href={`/parent/children/${k.id}`} className="card flex items-center justify-between">
            <span className="text-lg font-bold">{k.name}</span>
            <span className="grid grid-cols-3 gap-4 text-right text-sm">
              <span>
                <span className="block text-xs text-stone-500">今月</span>
                {formatPoints(summaries[i].monthPoints)}
              </span>
              <span>
                <span className="block text-xs text-stone-500">今週の勉強</span>
                {formatHours(summaries[i].weekMinutes)}
              </span>
              <span>
                <span className="block text-xs text-stone-500">残高</span>
                {formatPoints(summaries[i].balance)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
