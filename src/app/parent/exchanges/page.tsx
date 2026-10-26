import { approveExchange, rejectExchange } from "@/app/actions/exchange";
import { ExchangeStatus } from "@/components/ExchangeStatus";
import { Flash, type SearchParams } from "@/components/Flash";
import { requireParent } from "@/lib/auth";
import { balanceOf } from "@/lib/awards";
import { formatJstDateTime } from "@/lib/dates";
import { familyChildren } from "@/lib/family";
import { formatPoints } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ExchangeRequest } from "@/lib/types";

export default async function ExchangesPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireParent();
  const supabase = await createClient();
  const kids = await familyChildren(supabase, me.family_id);
  const { data } = await supabase
    .from("exchange_requests")
    .select("*")
    .in(
      "child_id",
      kids.map((k) => k.id),
    )
    .order("created_at", { ascending: false })
    .limit(50);
  const requests = (data ?? []) as ExchangeRequest[];
  const pending = requests.filter((r) => r.status === "pending");
  const done = requests.filter((r) => r.status !== "pending");
  const childName = new Map(kids.map((k) => [k.id, k.name]));
  const balances = new Map(
    await Promise.all([...new Set(pending.map((r) => r.child_id))].map(async (id) => [id, await balanceOf(supabase, id)] as const)),
  );

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card mb-4">
        <h2 className="h2">承認待ち</h2>
        {pending.length === 0 && <p className="text-sm text-stone-500">承認待ちの申請はありません</p>}
        <ul className="space-y-3">
          {pending.map((r) => (
            <li key={r.id} className="rounded-xl bg-stone-50 p-3">
              <p className="mb-2">
                <span className="font-bold">{childName.get(r.child_id)}</span>：{formatPoints(r.points)}（{r.points.toLocaleString("ja-JP")}円）
                <span className="block text-xs text-stone-500">
                  {formatJstDateTime(r.created_at)}・残高 {formatPoints(balances.get(r.child_id) ?? 0)}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <form action={approveExchange}>
                  <input type="hidden" name="request_id" value={r.id} />
                  <button className="btn">承認</button>
                </form>
                <form action={rejectExchange} className="flex flex-1 gap-2">
                  <input type="hidden" name="request_id" value={r.id} />
                  <input className="input text-sm" name="reason" placeholder="却下の理由（本人に通知）" required />
                  <button className="btn-danger shrink-0">却下</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="h2">処理済み</h2>
        {done.length === 0 && <p className="text-sm text-stone-500">まだありません</p>}
        <ul className="divide-y divide-stone-100 text-sm">
          {done.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span>
                <span className="text-xs text-stone-500">{formatJstDateTime(r.created_at)}</span> {childName.get(r.child_id)}{" "}
                {formatPoints(r.points)}
                {r.reason && <span className="text-xs text-stone-500">（{r.reason}）</span>}
              </span>
              <ExchangeStatus status={r.status} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
