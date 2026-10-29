import { markExchangeGiven } from "@/app/actions/exchange";
import { ExchangeStatus } from "@/components/ExchangeStatus";
import { Flash, type SearchParams } from "@/components/Flash";
import { requireParent } from "@/lib/auth";
import { formatJstDateTime } from "@/lib/dates";
import { familyChildren } from "@/lib/family";
import { formatPoints } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ExchangeRequest } from "@/lib/types";

export default async function ExchangesPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  // 交換の一覧は RLS で自分の家族の子どもの分だけが返るので、子どもの一覧を待たずに同時に取る
  const [, kids, { data }] = await Promise.all([
    requireParent(),
    familyChildren(supabase),
    supabase.from("exchange_requests").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  const requests = (data ?? []) as ExchangeRequest[];
  const pending = requests.filter((r) => r.status === "pending");
  const past = requests.filter((r) => r.status !== "pending");
  const childName = new Map(kids.map((k) => [k.id, k.name]));

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card mb-4">
        <h2 className="h2">渡し待ちの交換</h2>
        <p className="mb-3 text-xs text-stone-500">
          承認は不要です。渡したら「渡した」にチェックしてください。その時点で交換完了になり、ポイントが減ります。
        </p>
        {pending.length === 0 && <p className="text-sm text-stone-500">渡し待ちの交換はありません</p>}
        <ul className="space-y-3">
          {pending.map((r) => (
            <li key={r.id} className="rounded-xl bg-stone-50 p-3">
              <p className="mb-2">
                <span className="font-bold">{childName.get(r.child_id)}</span>：{formatPoints(r.points)}（
                {r.points.toLocaleString("ja-JP")}円）
                <span className="block text-xs text-stone-500">{formatJstDateTime(r.created_at)}に請求</span>
              </p>
              <form action={markExchangeGiven}>
                <input type="hidden" name="request_id" value={r.id} />
                <button className="btn">⬜ 渡した</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="h2">完了・取り消し</h2>
        {past.length === 0 && <p className="text-sm text-stone-500">まだありません</p>}
        <ul className="divide-y divide-stone-100 text-sm">
          {past.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span>
                <span className="text-xs text-stone-500">{formatJstDateTime(r.completed_at ?? r.cancelled_at ?? r.created_at)}</span>{" "}
                {childName.get(r.child_id)} {formatPoints(r.points)}
              </span>
              <ExchangeStatus status={r.status} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
