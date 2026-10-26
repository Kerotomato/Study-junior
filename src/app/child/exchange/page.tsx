import { requestExchange } from "@/app/actions/exchange";
import { ExchangeStatus } from "@/components/ExchangeStatus";
import { Flash, type SearchParams } from "@/components/Flash";
import { requireChild } from "@/lib/auth";
import { availablePoints, balanceOf } from "@/lib/awards";
import { formatJstDateTime } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ExchangeRequest } from "@/lib/types";

export default async function ExchangePage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireChild();
  const supabase = await createClient();
  const [balance, available, { data }] = await Promise.all([
    balanceOf(supabase, me.id),
    availablePoints(supabase, me.id),
    supabase.from("exchange_requests").select("*").eq("child_id", me.id).order("created_at", { ascending: false }).limit(30),
  ]);
  const requests = (data ?? []) as ExchangeRequest[];

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card mb-4">
        <h2 className="h2">ポイント交換を申請</h2>
        <p className="mb-1 text-3xl font-bold">{formatPoints(balance)}</p>
        <p className="mb-4 text-sm text-stone-500">
          1pt＝1円。いまは {formatPoints(Math.max(0, available))} まで申請できます（承認待ちの分を除く）
        </p>
        <form action={requestExchange} className="flex gap-2">
          <input
            className="input"
            name="points"
            type="number"
            min={1}
            max={Math.max(1, available)}
            placeholder="交換するポイント"
            aria-label="交換するポイント"
            required
          />
          <button className="btn shrink-0" disabled={available < 1}>
            申請する
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="h2">申請の履歴</h2>
        {requests.length === 0 && <p className="text-sm text-stone-500">まだ申請していません</p>}
        <ul className="divide-y divide-stone-100 text-sm">
          {requests.map((r) => (
            <li key={r.id} className="py-2">
              <div className="flex items-center justify-between">
                <span>
                  <span className="text-xs text-stone-500">{formatJstDateTime(r.created_at)}</span> {formatPoints(r.points)}
                </span>
                <ExchangeStatus status={r.status} />
              </div>
              {r.status === "rejected" && r.reason && <p className="text-xs text-stone-500">理由：{r.reason}</p>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
