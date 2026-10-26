import { formatJstDateTime } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import { LEDGER_KIND_LABEL, type LedgerEntry } from "@/lib/types";

export function LedgerList({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-stone-500">まだポイントの動きがありません</p>;
  return (
    <ul className="divide-y divide-stone-100 text-sm">
      {entries.map((e) => (
        <li key={e.id} className="flex justify-between gap-2 py-2">
          <span>
            <span className="text-xs text-stone-500">{formatJstDateTime(e.created_at)}</span> {LEDGER_KIND_LABEL[e.kind]}
            {e.note && <span className="text-stone-500">（{e.note}）</span>}
          </span>
          <span className={`shrink-0 font-bold ${e.amount < 0 ? "text-red-700" : "text-green-700"}`}>
            {e.amount > 0 ? "+" : ""}
            {formatPoints(e.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}
