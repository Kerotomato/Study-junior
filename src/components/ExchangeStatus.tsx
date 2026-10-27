import type { ExchangeRequest } from "@/lib/types";

const LABEL = { pending: "渡し待ち", completed: "完了", cancelled: "取り消し" } as const;
const STYLE = {
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-stone-200 text-stone-600",
} as const;

export function ExchangeStatus({ status }: { status: ExchangeRequest["status"] }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STYLE[status]}`}>{LABEL[status]}</span>;
}
