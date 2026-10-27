import type { ExchangeRequest } from "@/lib/types";

const LABEL = { pending: "受け渡し中", completed: "完了", cancelled: "取り消し" } as const;
const STYLE = {
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-stone-200 text-stone-600",
} as const;

export function ExchangeStatus({ status }: { status: ExchangeRequest["status"] }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STYLE[status]}`}>{LABEL[status]}</span>;
}

/** 「渡した（親）」「貰った（子ども）」の状態。チェックできる側には actions でボタンを渡す */
export function ExchangeChecks({
  request,
  givenAction,
  receivedAction,
}: {
  request: ExchangeRequest;
  givenAction?: React.ReactNode;
  receivedAction?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {request.given_at ? <Checked label="渡した（親）" /> : (givenAction ?? <Unchecked label="渡した（親）" />)}
      {request.received_at ? <Checked label="貰った（子ども）" /> : (receivedAction ?? <Unchecked label="貰った（子ども）" />)}
    </div>
  );
}

function Checked({ label }: { label: string }) {
  return <span className="rounded-xl bg-green-100 px-3 py-2 font-bold text-green-800">✅ {label}</span>;
}

function Unchecked({ label }: { label: string }) {
  return <span className="rounded-xl bg-stone-100 px-3 py-2 text-stone-500">⬜ {label}</span>;
}
