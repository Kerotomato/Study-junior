import type { ExchangeRequest } from "@/lib/types";

const LABEL = { pending: "承認待ち", approved: "承認", rejected: "却下" } as const;
const STYLE = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-stone-200 text-stone-600",
} as const;

export function ExchangeStatus({ status }: { status: ExchangeRequest["status"] }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STYLE[status]}`}>{LABEL[status]}</span>;
}
