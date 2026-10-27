import { cancelExchange, markExchangeReceived, requestExchange } from "@/app/actions/exchange";
import { ExchangeChecks, ExchangeStatus } from "@/components/ExchangeStatus";
import { Flash, type SearchParams } from "@/components/Flash";
import { LedgerList } from "@/components/LedgerList";
import { requireChild } from "@/lib/auth";
import { availablePoints, balanceOf } from "@/lib/awards";
import { formatJstDateTime } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ExchangeRequest, LedgerEntry } from "@/lib/types";

export default async function ExchangePage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireChild();
  const supabase = await createClient();
  const [balance, available, { data }, { data: ledger }] = await Promise.all([
    balanceOf(supabase, me.id),
    availablePoints(supabase, me.id),
    supabase.from("exchange_requests").select("*").eq("child_id", me.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("point_ledger").select("*").eq("child_id", me.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const requests = (data ?? []) as ExchangeRequest[];
  const pending = requests.filter((r) => r.status === "pending");
  const past = requests.filter((r) => r.status !== "pending");

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card mb-4">
        <h2 className="h2">ポイント交換を請求</h2>
        <p className="mb-1 text-3xl font-bold">{formatPoints(balance)}</p>
        <p className="mb-4 text-sm text-stone-500">
          1pt＝1円。いまは {formatPoints(Math.max(0, available))} まで請求できます（受け渡し中の分を除く）
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
            請求する
          </button>
        </form>
        <p className="mt-2 text-xs text-stone-500">
          請求すると親に通知が届きます。親が「渡した」、あなたが「貰った」にチェックすると交換完了で、そのときにポイントが減ります。
        </p>
      </section>

      {pending.length > 0 && (
        <section className="card mb-4">
          <h2 className="h2">受け渡し中</h2>
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="rounded-xl bg-stone-50 p-3">
                <p className="mb-2 flex items-center justify-between">
                  <span className="font-bold">{formatPoints(r.points)}</span>
                  <span className="text-xs text-stone-500">{formatJstDateTime(r.created_at)}に請求</span>
                </p>
                <ExchangeChecks
                  request={r}
                  receivedAction={
                    <form action={markExchangeReceived}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <button className="btn">⬜ 貰った</button>
                    </form>
                  }
                />
                {!r.given_at && (
                  <form action={cancelExchange} className="mt-2 text-right">
                    <input type="hidden" name="request_id" value={r.id} />
                    <button className="text-xs text-stone-500 underline">請求を取り消す</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mb-4">
        <h2 className="h2">交換の履歴</h2>
        {past.length === 0 && <p className="text-sm text-stone-500">まだ完了した交換はありません</p>}
        <ul className="divide-y divide-stone-100 text-sm">
          {past.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span>
                <span className="text-xs text-stone-500">{formatJstDateTime(r.completed_at ?? r.cancelled_at ?? r.created_at)}</span>{" "}
                {formatPoints(r.points)}
              </span>
              <ExchangeStatus status={r.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="h2">ポイントの動き</h2>
        <p className="mb-2 text-xs text-stone-500">獲得・取り消し・記録の修正・交換の一覧です（新しい順に50件）</p>
        <LedgerList entries={(ledger ?? []) as LedgerEntry[]} />
      </section>
    </>
  );
}
